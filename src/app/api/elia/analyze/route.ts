/**
 * POST /api/elia/analyze
 * Step 3: Analyze and reorder products using Claude AI
 *
 * B2B sends:
 * - entity_codes with ERP price/stock data (minimal)
 * - intent (sort_by, stock_filter, attributes)
 *
 * PIM fetches product details from Solr (name, brand, model, attributes),
 * then sends merged data to Claude for intelligent analysis.
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeProducts } from '@/lib/elia/claude.service';
import { EliaIntentExtraction } from '@/lib/types/elia';
import { searchProducts } from '@/lib/search';

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

interface ProductErpData {
  entity_code: string;

  // ERP Price Data (from B2B)
  price?: number;

  // ERP Stock Data (from B2B)
  availability?: number;
}

interface AnalyzeRequest {
  /** Products with ERP data from B2B (minimal: entity_code + price + stock) */
  products: ProductErpData[];

  /** Full intent from Step 1 (EliaIntentExtraction) */
  intent: EliaIntentExtraction;

  /** Language for response (default: 'it') */
  language?: string;

  /** Total products found in Solr (from Step 2) - for pagination info */
  total_found?: number;
}

interface AnalyzeResponse {
  success: boolean;
  data: {
    products: Array<{
      entity_code: string;
      attribute_match_score: number;
      match_reasons: string[];
      ranking_reason?: string;
    }>;
    total_count: number;
    /** Products sent to Claude for analysis (max 10) */
    analyzed_count: number;
    /** Products received from B2B for analysis */
    received_count: number;
    /** Total products found in Solr (from Step 2) */
    total_found: number;
    summary: string;
  };
}

// ============================================
// DIRECT SEARCH (no HTTP overhead)
// ============================================

interface SolrProductDetails {
  entity_code: string;
  name?: string;
  brand_name?: string;
  model?: string;
  attributes?: Record<string, unknown>;
  technical_specifications?: Record<string, unknown>[];
  category_path?: string[];
}

/**
 * Fetch product details from Solr by entity_codes
 * Uses searchProducts directly (no HTTP overhead)
 * Returns: name, brand, model, attributes
 */
async function fetchProductsFromSolr(
  entityCodes: string[],
  language: string = 'it',
  tenantDb?: string
): Promise<Map<string, SolrProductDetails>> {
  if (entityCodes.length === 0) {
    return new Map();
  }

  try {
    // Call searchProducts directly (no HTTP overhead)
    const result = await searchProducts({
      lang: language,
      rows: entityCodes.length,
      filters: {
        entity_code: entityCodes,
      },
      include_faceting: true,
      group_variants: false,
      tenantDb, // Pass tenant database
    });

    const products = new Map<string, SolrProductDetails>();

    for (const doc of result.data.results || []) {
      const entityCode = doc.entity_code || doc.id;

      // Extract attributes from the product (object format: { slug: { key, label, value } })
      // Pass full attribute objects to Claude for better context
      const attributes: Record<string, unknown> = {};
      if (doc.attributes && typeof doc.attributes === 'object') {
        for (const [slug, attr] of Object.entries(doc.attributes as unknown as Record<string, { key: string; label: string; value: unknown }>)) {
          if (attr && attr.value !== undefined) {
            attributes[slug] = attr; // Full object { key, label, value }
          }
        }
      }

      // Extract technical specifications from the product
      const technicalSpecs: Record<string, unknown>[] = [];
      if (doc.technical_specifications && Array.isArray(doc.technical_specifications)) {
        for (const spec of doc.technical_specifications) {
          if (spec && typeof spec === 'object') {
            technicalSpecs.push(spec);
          }
        }
      }

      products.set(entityCode, {
        entity_code: entityCode,
        name: Array.isArray(doc.name) ? doc.name[0] : doc.name,
        brand_name: doc.brand?.label,
        model: doc.product_model?.trim(),
        attributes,
        technical_specifications: technicalSpecs.length > 0 ? technicalSpecs : undefined,
        category_path: doc.category?.breadcrumb,
      });
    }

    return products;
  } catch (error) {
    console.error('[ELIA Analyze] Search error:', error);
    return new Map();
  }
}

/**
 * Merge ERP data with Solr product details
 */
function mergeProductData(
  erpProducts: ProductErpData[],
  solrProducts: Map<string, SolrProductDetails>
): Record<string, unknown>[] {
  return erpProducts.map(erp => {
    const solr = solrProducts.get(erp.entity_code);

    const merged: Record<string, unknown> = {
      entity_code: erp.entity_code,
    };

    // From ERP (B2B) - only add if defined
    if (erp.price !== undefined) merged.price = erp.price;
    if (erp.availability !== undefined) merged.availability = erp.availability;

    // From Solr (PIM) - only add if defined
    if (solr?.name) merged.name = solr.name;
    if (solr?.brand_name) merged.brand_name = solr.brand_name;
    if (solr?.model) merged.model = solr.model;
    if (solr?.attributes && Object.keys(solr.attributes).length > 0) {
      merged.attributes = solr.attributes;
    }
    if (solr?.technical_specifications && solr.technical_specifications.length > 0) {
      merged.technical_specifications = solr.technical_specifications;
    }
    if (solr?.category_path) merged.category_path = solr.category_path;

    return merged;
  });
}

// ============================================
// MAIN HANDLER
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Get tenant-specific Solr collection from headers (set by middleware)
    const tenantDb = request.headers.get('x-resolved-tenant-db');
    if (!tenantDb) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tenant not specified',
          code: 'NO_TENANT',
          details: {
            message: 'Tenant must be provided via X-API-Key header',
          },
        },
        { status: 400 }
      );
    }

    const body: AnalyzeRequest = await request.json();
    const { products, intent, language = 'it', total_found } = body;

    // Validate input
    if (!products || !Array.isArray(products)) {
      return NextResponse.json(
        {
          success: false,
          error: 'products array is required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    if (!intent) {
      return NextResponse.json(
        {
          success: false,
          error: 'intent object is required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    // Limit products to avoid Claude timeout (max 10 for analysis)
    const MAX_PRODUCTS_FOR_ANALYSIS = 10;
    const limitedProducts = products.slice(0, MAX_PRODUCTS_FOR_ANALYSIS);
    const originalCount = products.length;

    // Extract from full intent (Step 1 format - new 5-array structure)
    const sort_by = intent.sort_by || 'relevance';
    const stock_filter = intent.stock_filter || 'any';
    const user_message = intent.user_message;

    // Extract product terms (for logging)
    const productTerms = intent.product_exact?.map(t => t.term) || [];
    // Extract attribute terms (for Claude context)
    const attributeTerms = [
      ...(intent.attribute_exact?.map(t => t.term) || []),
      ...(intent.attribute_synonyms?.map(t => t.term) || []),
    ];
    // Extract spec terms (for Claude context)
    const specTerms = [
      ...(intent.spec_exact?.map(t => t.term) || []),
      ...(intent.spec_synonyms?.map(t => t.term) || []),
    ];

    console.log(`[ELIA Analyze] Processing ${limitedProducts.length}/${originalCount} products (max ${MAX_PRODUCTS_FOR_ANALYSIS})`);
    console.log(`[ELIA Analyze] Intent type: ${intent.intent_type}, Sort: ${sort_by}, Stock: ${stock_filter}`);
    console.log(`[ELIA Analyze] Product terms:`, productTerms);
    console.log(`[ELIA Analyze] Attribute terms:`, attributeTerms);
    console.log(`[ELIA Analyze] Spec terms:`, specTerms);

    // Step 1: Extract entity_codes (only for limited products)
    const entityCodes = limitedProducts.map(p => p.entity_code);

    // Step 2: Fetch product details from Solr (name, brand, model, attributes, technical_specifications)
    console.log(`[ELIA Analyze] Fetching ${entityCodes.length} products from Solr...`);
    const solrProducts = await fetchProductsFromSolr(entityCodes, language, tenantDb);
    const productsWithSpecs = Array.from(solrProducts.values()).filter(p => p.technical_specifications && p.technical_specifications.length > 0).length;
    console.log(`[ELIA Analyze] Fetched ${solrProducts.size} products from Solr (${productsWithSpecs} with technical_specifications)`);

    // Step 3: Merge ERP + Solr data
    const mergedProducts = mergeProductData(limitedProducts, solrProducts);

    // Step 4: Call Claude to analyze and reorder products with full intent
    const analysisResult = await analyzeProducts({
      products: mergedProducts,
      intent: {
        sort_by,
        stock_filter,
        // Pass attribute and spec terms as context for Claude analysis
        attributes: { terms: attributeTerms },
        specs: { terms: specTerms },
      },
      user_message,
      language,
    });

    console.log(`[ELIA Analyze] Claude returned ${analysisResult.total_count} products`);

    // Sort products by attribute_match_score (highest first)
    const sortedProducts = [...analysisResult.products].sort(
      (a, b) => b.attribute_match_score - a.attribute_match_score
    );

    return NextResponse.json({
      success: true,
      data: {
        products: sortedProducts,
        total_count: analysisResult.total_count,
        analyzed_count: limitedProducts.length,
        received_count: originalCount,
        total_found: total_found ?? originalCount,
        summary: analysisResult.summary,
      },
    } as AnalyzeResponse);
  } catch (error) {
    console.error('[ELIA Analyze] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Analysis failed',
        code: 'INTERNAL_ERROR',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/elia/analyze
 * Get endpoint info
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      service: 'elia-analyze',
      description: 'Step 3: Analyze and reorder products using Claude AI',
      note: 'B2B sends minimal ERP data (entity_code + price + stock), PIM fetches product details from Solr',
      usage: {
        method: 'POST',
        body: {
          products: [
            {
              entity_code: 'required - product code',
              price: 'ERP price (optional)',
              availability: 'ERP stock quantity (optional)',
            },
          ],
          intent: 'Full intent from Step 1 (EliaIntentExtraction)',
          intent_example: {
            intent_type: 'ricerca | confronto | consiglio | specifico',
            product_exact: [{ term: 'caldaia', precision: 1.0 }],
            product_synonyms: [{ term: 'scaldabagno', precision: 0.85 }],
            attribute_exact: [{ term: 'economica', precision: 1.0 }],
            attribute_synonyms: [{ term: 'risparmio', precision: 0.8 }],
            attribute_related: [{ term: 'efficiente', precision: 0.5 }],
            spec_exact: [{ term: '24kW', precision: 1.0 }],
            spec_synonyms: [{ term: '24 kW', precision: 0.9 }],
            spec_related: [{ term: 'alta potenza', precision: 0.5 }],
            sort_by: 'price_asc | price_desc | quality | relevance',
            stock_filter: 'any | in_stock | available_soon',
            user_message: 'AI-generated message',
            confidence: 0.95,
          },
          language: 'Response language: it | en (default: it)',
          total_found: 'Total products from Solr Step 2 (optional)',
        },
        response: {
          total_count: 'Products after Claude filtering',
          received_count: 'Products received for analysis (e.g., 10)',
          total_found: 'Total products in Solr (e.g., 150)',
        },
      },
      timestamp: new Date().toISOString(),
    },
  });
}
