import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";

// GET /api/b2b/pim/product-types/[id]/products - Get products for a product type
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session?.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { ProductType: ProductTypeModel, PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);
    const { id: productTypeId } = await params;

    const productType = await ProductTypeModel.findOne({
      product_type_id: productTypeId,
      // No wholesaler_id - database provides isolation
    }).lean();

    if (!productType) {
      return NextResponse.json({ error: "Product type not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {
      // No wholesaler_id - database provides isolation
      isCurrent: true,
      "product_type.id": productTypeId,
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
        { entity_code: { $regex: search, $options: "i" } },
      ];
    }

    const [products, total] = await Promise.all([
      PIMProductModel.find(query)
        .select("entity_code sku name image status quantity")
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
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
    console.error("Error fetching product type products:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch products" },
      { status: 500 }
    );
  }
}

// POST /api/b2b/pim/product-types/[id]/products - Bulk associate/disassociate products
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session?.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { ProductType: ProductTypeModel, PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);
    const { id: productTypeId } = await params;

    const body = await req.json();
    const { entity_codes, action } = body as {
      entity_codes?: string[];
      action?: "add" | "remove";
    };

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

    const productType = await ProductTypeModel.findOne({
      product_type_id: productTypeId,
      // No wholesaler_id - database provides isolation
    }).lean();

    if (!productType) {
      return NextResponse.json({ error: "Product type not found" }, { status: 404 });
    }

    if (action === "add") {
      const productTypeData = {
        id: productTypeId,
        name: productType.name,
        slug: productType.slug,
      };

      const result = await PIMProductModel.updateMany(
        {
          entity_code: { $in: entity_codes },
          // No wholesaler_id - database provides isolation
          isCurrent: true,
        },
        { $set: { product_type: productTypeData } }
      );

      const productCount = await PIMProductModel.countDocuments({
        // No wholesaler_id - database provides isolation
        isCurrent: true,
        "product_type.id": productTypeId,
      });

      await ProductTypeModel.updateOne(
        { product_type_id: productTypeId }, // No wholesaler_id - database provides isolation
        { $set: { product_count: productCount } }
      );

      return NextResponse.json({
        message: `Successfully associated ${result.modifiedCount} product(s)`,
        modified: result.modifiedCount,
      });
    }

    const result = await PIMProductModel.updateMany(
      {
        entity_code: { $in: entity_codes },
        // No wholesaler_id - database provides isolation
        isCurrent: true,
        "product_type.id": productTypeId,
      },
      { $unset: { product_type: "" } }
    );

    const productCount = await PIMProductModel.countDocuments({
      // No wholesaler_id - database provides isolation
      isCurrent: true,
      "product_type.id": productTypeId,
    });

    // No wholesaler_id - database provides isolation
    await ProductTypeModel.updateOne(
      { product_type_id: productTypeId },
      { $set: { product_count: productCount } }
    );

    return NextResponse.json({
      message: `Successfully removed ${result.modifiedCount} product(s)`,
      modified: result.modifiedCount,
    });
  } catch (error: any) {
    console.error("Error updating product type products:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update products" },
      { status: 500 }
    );
  }
}
