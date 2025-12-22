import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connection";
import { CollectionModel } from "@/lib/db/models/collection";

/**
 * GET /api/public/collections
 * Public endpoint to get all active collections for storefront rendering
 * No authentication required
 *
 * Query params:
 * - sort: "created_at" | "name" | "display_order" (default: "display_order")
 * - order: "asc" | "desc" (default: "asc")
 * - limit: number (optional, default: all)
 */
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const sort = searchParams.get("sort") || "display_order";
    const order = searchParams.get("order") || "asc";
    const limitParam = searchParams.get("limit");

    // Only fetch active collections
    const query = { is_active: true };

    // Build sort object
    const validSortFields = ["created_at", "name", "display_order"];
    const sortField = validSortFields.includes(sort) ? sort : "display_order";
    const sortOrder = order === "desc" ? -1 : 1;
    const sortObj: Record<string, 1 | -1> = { [sortField]: sortOrder };

    // Build query
    let queryBuilder = CollectionModel.find(query)
      .select("collection_id name slug description hero_image product_count display_order created_at")
      .sort(sortObj);

    // Apply limit if provided
    if (limitParam) {
      const limit = parseInt(limitParam, 10);
      if (!isNaN(limit) && limit > 0) {
        queryBuilder = queryBuilder.limit(limit);
      }
    }

    const collections = await queryBuilder.lean();

    // Transform for public consumption
    const publicCollections = collections.map((collection: any) => ({
      id: collection.collection_id,
      name: collection.name,
      slug: collection.slug,
      description: collection.description || null,
      hero_image: collection.hero_image || null,
      product_count: collection.product_count || 0,
      display_order: collection.display_order,
      created_at: collection.created_at,
    }));

    return NextResponse.json({
      success: true,
      collections: publicCollections,
      total: publicCollections.length,
    });
  } catch (error) {
    console.error("Error fetching public collections:", error);
    return NextResponse.json(
      { error: "Failed to fetch collections" },
      { status: 500 }
    );
  }
}
