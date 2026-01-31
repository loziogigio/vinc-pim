/**
 * POST /api/b2b/search/preview
 * Search preview for internal B2B use (campaign builder, etc.)
 * Uses session authentication - no API key required
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { searchProducts, SolrError } from "@/lib/search/search.service";
import { isSolrEnabled } from "@/config/project.config";

export async function POST(request: NextRequest) {
  try {
    // Verify B2B session
    const session = await getB2BSession();
    if (!session?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if Solr is enabled
    if (!isSolrEnabled()) {
      return NextResponse.json(
        { error: "Search is not available", code: "SOLR_DISABLED" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const tenantDb = `vinc-${session.tenantId}`;

    // Execute search with minimal options for preview
    const result = await searchProducts({
      text: body.text || undefined,
      lang: body.lang || "it",
      start: 0,
      rows: body.rows || 6,
      filters: body.filters || {},
      include_faceting: false,
      include_variants: false,
      tenantDb,
    });

    // Return simplified preview response with image fallbacks
    return NextResponse.json({
      success: true,
      items: result.data.results.map((product) => ({
        id: product.entity_code || product.sku,
        sku: product.sku,
        name: product.name,
        image: {
          thumbnail: product.image?.thumbnail || product.cover_image_url,
          url: product.image?.original || product.cover_image_url,
        },
      })),
      total: result.data.numFound,
    });
  } catch (error) {
    if (error instanceof SolrError) {
      console.error("[Search Preview] Solr error:", error.message);
      return NextResponse.json(
        { error: "Search failed", details: error.message },
        { status: error.statusCode >= 400 ? error.statusCode : 500 }
      );
    }

    console.error("[Search Preview] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
