import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { PIMProductModel } from "@/lib/db/models/pim-product";
import { CollectionModel } from "@/lib/db/models/collection";

// GET /api/b2b/pim/collections/[collectionId]/products - Get products for a collection
export async function GET(
  req: NextRequest,
  { params }: { params: { collectionId: string } }
) {
  try {
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Verify collection belongs to this wholesaler
    const collection = await CollectionModel.findOne({
      collection_id: params.collectionId,
      wholesaler_id: session.userId,
    }).lean() as any;

    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    // Build query - products that have this collection in their collections array
    const query: any = {
      wholesaler_id: session.userId,
      isCurrent: true,
      "collections.id": params.collectionId,
    };

    // Add search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
        { entity_code: { $regex: search, $options: "i" } },
      ];
    }

    // Get products
    const [products, total] = await Promise.all([
      PIMProductModel.find(query)
        .select("entity_code sku name image status quantity")
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean() as any,
      PIMProductModel.countDocuments(query),
    ]);

    return NextResponse.json({
      products,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Error fetching collection products:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch products" },
      { status: 500 }
    );
  }
}

// POST /api/b2b/pim/collections/[collectionId]/products - Bulk associate/disassociate products
export async function POST(
  req: NextRequest,
  { params }: { params: { collectionId: string } }
) {
  try {
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await req.json();
    const { entity_codes, action } = body;

    if (!entity_codes || !Array.isArray(entity_codes) || entity_codes.length === 0) {
      return NextResponse.json(
        { error: "entity_codes array is required" },
        { status: 400 }
      );
    }

    if (!action || !["add", "remove"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'add' or 'remove'" },
        { status: 400 }
      );
    }

    // Verify collection belongs to this wholesaler
    const collection = await CollectionModel.findOne({
      collection_id: params.collectionId,
      wholesaler_id: session.userId,
    }).lean() as any;

    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    if (action === "add") {
      // Add collection to products' collections array
      const collectionData = {
        id: params.collectionId,
        name: collection.name,
        slug: collection.slug,
      };

      const result = await PIMProductModel.updateMany(
        {
          entity_code: { $in: entity_codes },
          wholesaler_id: session.userId,
          isCurrent: true,
          "collections.id": { $ne: params.collectionId }, // Only if not already in array
        },
        { $push: { collections: collectionData } }
      );

      // Update collection product count
      const productCount = await PIMProductModel.countDocuments({
        wholesaler_id: session.userId,
        isCurrent: true,
        "collections.id": params.collectionId,
      });

      await CollectionModel.updateOne(
        { collection_id: params.collectionId, wholesaler_id: session.userId },
        { $set: { product_count: productCount } }
      );

      return NextResponse.json({
        message: `Successfully associated ${result.modifiedCount} product(s)`,
        modified: result.modifiedCount,
      });
    } else {
      // Remove collection from products' collections array
      const result = await PIMProductModel.updateMany(
        {
          entity_code: { $in: entity_codes },
          wholesaler_id: session.userId,
          isCurrent: true,
          "collections.id": params.collectionId,
        },
        { $pull: { collections: { id: params.collectionId } } }
      );

      // Update collection product count
      const productCount = await PIMProductModel.countDocuments({
        wholesaler_id: session.userId,
        isCurrent: true,
        "collections.id": params.collectionId,
      });

      await CollectionModel.updateOne(
        { collection_id: params.collectionId, wholesaler_id: session.userId },
        { $set: { product_count: productCount } }
      );

      return NextResponse.json({
        message: `Successfully removed ${result.modifiedCount} product(s)`,
        modified: result.modifiedCount,
      });
    }
  } catch (error: any) {
    console.error("Error updating collection products:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update products" },
      { status: 500 }
    );
  }
}
