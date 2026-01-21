import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import { getSolrConfig, isSolrEnabled } from "@/config/project.config";
import { buildSearchQuery } from "@/lib/search/query-builder";
import type { SearchRequest } from "@/lib/types/search";

/**
 * POST /api/b2b/search
 *
 * Search products with optional filtering and faceting via Solr.
 * Supports both B2B session auth and API key auth.
 *
 * Request body:
 * {
 *   "query": "*",                    // Search text (default: "*" for all)
 *   "filters": {                     // Optional filters
 *     "product_type_json": "*Pompe*",
 *     "spec_col_s": "Grigio",
 *     "spec_mat_s": "Ottone"
 *   },
 *   "facets": ["spec_col_s", "spec_mat_s", "spec_tip_s"],  // Optional facet fields
 *   "limit": 20,                     // Results per page (default: 20, max: 100)
 *   "page": 1,                       // Page number (default: 1)
 *   "lang": "it"                     // Language for text fields (default: "it")
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Check if Solr is enabled
    if (!isSolrEnabled()) {
      return NextResponse.json(
        { error: "Search is not enabled" },
        { status: 503 }
      );
    }

    // Authenticate - support both B2B session and API key
    const authMethod = request.headers.get("x-auth-method");
    let tenantDb: string;

    if (authMethod === "api-key") {
      const apiKeyResult = await verifyAPIKeyFromRequest(request, "read");
      if (!apiKeyResult.authenticated) {
        return NextResponse.json(
          { error: apiKeyResult.error || "Unauthorized" },
          { status: apiKeyResult.statusCode || 401 }
        );
      }
      tenantDb = apiKeyResult.tenantDb!;
    } else {
      // B2B session auth
      const session = await getB2BSession();
      if (!session || !session.isLoggedIn || !session.tenantId) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
      tenantDb = `vinc-${session.tenantId}`;
    }

    // Parse request body
    const body = await request.json();
    const {
      query = "*",
      filters = {},
      facets = [],
      limit = 20,
      page = 1,
      lang = "it",
    } = body;

    // Build Solr query
    const solrConfig = getSolrConfig();
    const solrCore = tenantDb; // Same as tenant DB name

    // Convert to SearchRequest format
    const searchRequest: SearchRequest = {
      text: query === "*" ? undefined : query,
      filters: filters,
      facet_fields: facets.length > 0 ? facets : undefined,
      start: (page - 1) * limit,
      rows: Math.min(limit, 100), // Max 100 per page
      lang,
    };

    // Build the Solr JSON query
    const solrQuery = buildSearchQuery(searchRequest);

    // Execute Solr query
    const solrResponse = await fetch(
      `${solrConfig.url}/${solrCore}/query`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(solrQuery),
      }
    );

    if (!solrResponse.ok) {
      const errorText = await solrResponse.text();
      console.error("Solr query error:", errorText);
      return NextResponse.json(
        { error: "Search service error" },
        { status: 503 }
      );
    }

    const solrData = await solrResponse.json();

    // Extract results
    const docs = solrData.response?.docs || [];
    const total = solrData.response?.numFound || 0;

    // Extract facets if requested
    const facetResults: Record<string, { buckets: { val: string; count: number }[] }> = {};
    if (solrData.facets && facets.length > 0) {
      for (const facetField of facets) {
        if (solrData.facets[facetField]) {
          facetResults[facetField] = {
            buckets: solrData.facets[facetField].buckets || [],
          };
        }
      }
    }

    // Return response
    return NextResponse.json({
      total,
      products: docs,
      facets: Object.keys(facetResults).length > 0 ? facetResults : undefined,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });

  } catch (error) {
    console.error("B2B search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
