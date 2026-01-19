import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";

/**
 * GET /api/public/collections/[id]/products
 * Public endpoint to get paginated products for a collection
 * No authentication required
 *
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 24, max: 100)
 * - sort: "name" | "created_at" | "price" (default: "created_at")
 * - order: "asc" | "desc" (default: "desc")
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantDb = req.headers.get("x-resolved-tenant-db");
    if (!tenantDb) {
      return NextResponse.json(
        { error: "Tenant not resolved" },
        { status: 400 }
      );
    }

    const { Collection: CollectionModel, PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

    const { id } = await params;
    const { searchParams } = new URL(req.url);

    // Parse pagination params
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "24", 10)));
    const skip = (page - 1) * limit;

    // Parse sort params
    const sort = searchParams.get("sort") || "created_at";
    const order = searchParams.get("order") || "desc";

    // Try to find collection by collection_id first, then by slug
    const collection = await CollectionModel.findOne({
      $or: [{ collection_id: id }, { slug: id }],
      is_active: true,
    }).lean() as any;

    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    // Build query for products in this collection
    const query = {
      isCurrent: true,
      status: "published",
      "collections.collection_id": collection.collection_id,
    };

    // Build sort object
    const validSortFields = ["name", "created_at", "price"];
    const sortField = validSortFields.includes(sort) ? sort : "created_at";
    const sortOrder = order === "asc" ? 1 : -1;
    const sortObj: Record<string, 1 | -1> = { [sortField]: sortOrder };

    // Get products with pagination
    const [products, total] = await Promise.all([
      PIMProductModel.find(query)
        .select("entity_code sku name description image images price quantity status brand category created_at")
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean() as any,
      PIMProductModel.countDocuments(query),
    ]);

    // Transform products for public consumption
    const publicProducts = products.map((product: any) => ({
      entity_code: product.entity_code,
      sku: product.sku,
      name: product.name,
      description: product.description || null,
      image: product.image || null,
      images: product.images || [],
      price: product.price || null,
      quantity: product.quantity || 0,
      brand: product.brand || null,
      category: product.category || null,
      created_at: product.created_at,
    }));

    return NextResponse.json({
      success: true,
      collection: {
        id: collection.collection_id,
        name: collection.name,
        slug: collection.slug,
      },
      products: publicProducts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching public collection products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
