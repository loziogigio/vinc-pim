import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connection";
import { CollectionModel } from "@/lib/db/models/collection";

/**
 * GET /api/public/collections/[id]
 * Public endpoint to get a single collection by ID or slug
 * No authentication required
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();

    const { id } = await params;

    // Try to find by collection_id first, then by slug
    const collection = await CollectionModel.findOne({
      $or: [{ collection_id: id }, { slug: id }],
      is_active: true,
    })
      .select("collection_id name slug description hero_image seo product_count display_order created_at")
      .lean() as any;

    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    // Transform for public consumption
    const publicCollection = {
      id: collection.collection_id,
      name: collection.name,
      slug: collection.slug,
      description: collection.description || null,
      hero_image: collection.hero_image || null,
      seo: collection.seo || {},
      product_count: collection.product_count || 0,
      display_order: collection.display_order,
      created_at: collection.created_at,
    };

    return NextResponse.json({
      success: true,
      collection: publicCollection,
    });
  } catch (error) {
    console.error("Error fetching public collection:", error);
    return NextResponse.json(
      { error: "Failed to fetch collection" },
      { status: 500 }
    );
  }
}
