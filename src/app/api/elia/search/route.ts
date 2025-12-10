/**
 * POST /api/elia/search
 * Step 2: 24-level cascade search using intent from Step 1
 *
 * Accepts:
 * - intent: Full EliaIntentExtraction from Step 1
 * - language: 'it' | 'en' (default: 'it')
 * - limit: Max results (default: 20)
 *
 * Returns:
 * - intent: Full intent (pass to Step 3)
 * - products: Search results from cascade
 * - total_found: Total matching products in Solr
 * - search_info: Cascade search metadata (level 0-23)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cascadeSearch } from '@/lib/elia/search.service';
import { getCascadeLevelName } from '@/lib/elia/intent.service';
import { EliaIntentExtraction, getEliaConfig } from '@/lib/types/elia';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { intent, language = 'it', limit } = body as {
      intent: EliaIntentExtraction;
      language?: string;
      limit?: number;
    };

    // Validate intent - check for product_exact (new structure)
    if (!intent || !intent.product_exact || intent.product_exact.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'intent object with product_exact is required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    // Execute 24-level cascade search with full intent
    const searchResult = await cascadeSearch(intent, {
      language,
      maxResults: limit || 20,
    });

    const durationMs = Date.now() - startTime;

    // Generate search ID
    const searchId = `elia_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    return NextResponse.json({
      success: true,
      data: {
        search_id: searchId,
        // Full intent - B2B passes this to Step 3 analyze
        intent,
        // Search metadata
        search_info: {
          matched_level: searchResult.matched_level,
          matched_level_name: getCascadeLevelName(searchResult.matched_level),
          matched_search_text: searchResult.matched_search_text,
        },
        // Products from cascade search
        products: searchResult.products,
        total_found: searchResult.total_count,
        matched_products: searchResult.matched_products,
        matched_attributes: searchResult.matched_attributes,
        performance: {
          total_ms: durationMs,
        },
      },
    });
  } catch (error) {
    console.error('ELIA search error:', error);

    const errorMessage = (error as Error).message;

    return NextResponse.json(
      {
        success: false,
        error: 'Search failed',
        code: 'SEARCH_FAILED',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/elia/search
 * Get search configuration info
 */
export async function GET() {
  const config = getEliaConfig();

  return NextResponse.json({
    success: true,
    data: {
      service: 'elia-search',
      config: {
        minResults: config.minResults,
        minQueryLength: config.minQueryLength,
        maxQueryLength: config.maxQueryLength,
      },
      endpoints: {
        search: 'POST /api/elia/search',
        intent: 'POST /api/elia/intent',
      },
      timestamp: new Date().toISOString(),
    },
  });
}
