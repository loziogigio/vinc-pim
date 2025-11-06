import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { CollectionModel } from "@/lib/db/models/collection";
import { PIMProductModel } from "@/lib/db/models/pim-product";
import { nanoid } from "nanoid";

/**
 * GET /api/b2b/pim/collections
 * Get all collections
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();

    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const searchParams = req.nextUrl.searchParams;
    const includeInactive = searchParams.get("include_inactive") === "true";

    // Build query
    const query: any = {
      wholesaler_id: session.userId,
    };

    if (!includeInactive) {
      query.is_active = true;
    }

    const collections = await CollectionModel.find(query)
      .sort({ display_order: 1, name: 1 })
      .lean();

    // Update product counts for each collection
    const collectionIds = collections.map((c) => c.collection_id);
    const productCounts = collectionIds.length
      ? await PIMProductModel.aggregate([
          {
            $match: {
              wholesaler_id: session.userId,
              isCurrent: true,
              "collections.id": { $in: collectionIds },
            },
          },
          { $unwind: "$collections" },
          {
            $match: {
              "collections.id": { $in: collectionIds },
            },
          },
          {
            $group: {
              _id: "$collections.id",
              count: { $sum: 1 },
            },
          },
        ])
      : [];

    const countMap = new Map(productCounts.map((c) => [c._id, c.count]));

    const collectionsWithCounts = collections.map((col) => ({
      ...col,
      product_count: countMap.get(col.collection_id) || 0,
    }));

    return NextResponse.json({ collections: collectionsWithCounts });
  } catch (error) {
    console.error("Error fetching collections:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/b2b/pim/collections
 * Create a new collection
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await req.json();
    const { name, slug, description, hero_image, seo, display_order } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      );
    }

    // Check if slug already exists for this wholesaler
    const existing = await CollectionModel.findOne({
      wholesaler_id: session.userId,
      slug,
    });

    if (existing) {
      return NextResponse.json(
        { error: "A collection with this slug already exists" },
        { status: 400 }
      );
    }

    const collection = await CollectionModel.create({
      collection_id: nanoid(12),
      wholesaler_id: session.userId,
      name,
      slug,
      description,
      hero_image,
      seo: seo || {},
      display_order: display_order || 0,
      is_active: true,
      product_count: 0,
    });

    return NextResponse.json({ collection }, { status: 201 });
  } catch (error) {
    console.error("Error creating collection:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
