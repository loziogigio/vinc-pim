import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { ProductTypeModel } from "@/lib/db/models/product-type";
import { PIMProductModel } from "@/lib/db/models/pim-product";
import { nanoid } from "nanoid";

/**
 * GET /api/b2b/pim/product-types
 * Get all product types
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

    const productTypes = await ProductTypeModel.find(query)
      .sort({ display_order: 1, name: 1 })
      .lean();

    // Update product counts for each product type
    const productTypeIds = productTypes.map((pt) => pt.product_type_id);
    const productCounts = await PIMProductModel.aggregate([
      {
        $match: {
          wholesaler_id: session.userId,
          isCurrent: true,
          "product_type.id": { $in: productTypeIds },
        },
      },
      {
        $group: {
          _id: "$product_type.id",
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = new Map(productCounts.map((c) => [c._id, c.count]));

    const productTypesWithCounts = productTypes.map((pt) => ({
      ...pt,
      product_count: countMap.get(pt.product_type_id) || 0,
    }));

    return NextResponse.json({ productTypes: productTypesWithCounts });
  } catch (error) {
    console.error("Error fetching product types:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/b2b/pim/product-types
 * Create a new product type
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await req.json();
    const { name, slug, description, features, display_order } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      );
    }

    // Check if slug already exists for this wholesaler
    const existing = await ProductTypeModel.findOne({
      wholesaler_id: session.userId,
      slug,
    });

    if (existing) {
      return NextResponse.json(
        { error: "A product type with this slug already exists" },
        { status: 400 }
      );
    }

    const productType = await ProductTypeModel.create({
      product_type_id: nanoid(12),
      wholesaler_id: session.userId,
      name,
      slug,
      description,
      features: features || [],
      display_order: display_order || 0,
      is_active: true,
      product_count: 0,
    });

    return NextResponse.json({ productType }, { status: 201 });
  } catch (error) {
    console.error("Error creating product type:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
