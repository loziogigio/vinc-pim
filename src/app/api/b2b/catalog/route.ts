import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";

/**
 * B2B Catalog API - Proxies to customer_web search API
 *
 * This endpoint uses the same search API that customer_web uses,
 * ensuring consistent product data between the admin portal and frontend.
 *
 * Search API: POST /search/search (from customer_web)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getB2BSession();

    if (!session.isLoggedIn) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const filter = searchParams.get("filter") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    // Calculate start position for pagination
    const start = (page - 1) * limit;

    // Build search parameters for customer_web API
    // Format matches what customer_web expects
    const searchBody: any = {
      start,
      rows: limit,
      search: {},
      filters: {},
    };

    // Add text search query if provided
    if (query) {
      // Search across SKU, title, and description
      searchBody.search.q = query;
    }

    // Add filters if provided
    // TODO: Map filters to customer_web search format
    // These will need to match the actual filter structure from customer_web
    if (filter) {
      searchBody.filters.status = filter;
    }

    // Call customer_web B2B search API
    // Uses the same endpoint as customer_web: NEXT_PUBLIC_B2B_PUBLIC_REST_API_ENDPOINT
    const b2bApiEndpoint = process.env.B2B_API_ENDPOINT || "https://b2b.hidros.com/api/v1";
    const searchApiUrl = `${b2bApiEndpoint}/search/search`;

    const response = await fetch(searchApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Forward session/auth if needed
        // TODO: Add authentication headers from session
      },
      body: JSON.stringify(searchBody),
    });

    if (!response.ok) {
      throw new Error(`Search API returned ${response.status}`);
    }

    const data = await response.json();

    // Transform response to match B2B catalog format
    // customer_web returns: { results: [], numFound: number }
    // We need: { products: [], pagination: {} }

    const products = (data.results || []).map((product: any) => ({
      _id: product.sku || product.id, // Use SKU as ID
      sku: product.sku,
      title: product.name || product.title,
      description: product.description || "",
      category: product.category_name || product.category || "",
      status: determineProductStatus(product),
      images: product.images || [],
      updatedAt: product.updated_at || product.updatedAt || new Date().toISOString(),
      lastSyncedAt: product.last_synced_at || new Date().toISOString(),
    }));

    const total = data.numFound || 0;

    return NextResponse.json({
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Catalog fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch catalog" },
      { status: 500 }
    );
  }
}

/**
 * Determine product enhancement status based on available data
 */
function determineProductStatus(product: any): string {
  // Check if product has rich content/media
  const hasImages = (product.images || []).length > 0;
  const hasDescription = !!product.description;
  const hasCategories = !!product.category || !!product.category_name;

  if (!hasImages) {
    return "missing_data";
  }

  if (!hasDescription || !hasCategories) {
    return "needs_attention";
  }

  // Check if product has enhanced content (media blocks, etc.)
  // This would require checking ProductTemplate in MongoDB
  // For now, return not_enhanced
  return "not_enhanced";
}
