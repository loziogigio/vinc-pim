import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { buildCategoryEmbedding } from "@/lib/services/category.service";
import { buildProductSearchConditions } from "@/lib/search/product-search";

// GET /api/b2b/pim/categories/[id]/products - Get products for a category
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb } = auth;
    const { Category: CategoryModel, PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);
    const { id: categoryId } = await params;

    const category = await CategoryModel.findOne({
      category_id: categoryId,
    }).lean();

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {
      isCurrent: true,
      "category.category_id": categoryId,
    };

    if (search) {
      query.$or = await buildProductSearchConditions(search, tenantDb);
    }

    const [products, total] = await Promise.all([
      PIMProductModel.find(query)
        .select("entity_code sku name image images status quantity")
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
    console.error("Error fetching category products:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch products" },
      { status: 500 }
    );
  }
}

// POST /api/b2b/pim/categories/[id]/products - Bulk associate/disassociate products
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb } = auth;
    const { Category: CategoryModel, PIMProduct: PIMProductModel, Language: LanguageModel } = await connectWithModels(tenantDb);
    const { id: categoryId } = await params;

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

    const category = await CategoryModel.findOne({
      category_id: categoryId,
    }).lean();

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    if (action === "add") {
      const categoryData = await buildCategoryEmbedding({
        category,
        CategoryModel,
        LanguageModel,
      });

      const result = await PIMProductModel.updateMany(
        {
          entity_code: { $in: entity_codes },
          isCurrent: true,
        },
        { $set: { category: categoryData } }
      );

      const productCount = await PIMProductModel.countDocuments({
        isCurrent: true,
        "category.category_id": categoryId,
      });

      await CategoryModel.updateOne(
        { category_id: categoryId },
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
        isCurrent: true,
        "category.category_id": categoryId,
      },
      { $unset: { category: "" } }
    );

    const productCount = await PIMProductModel.countDocuments({
      isCurrent: true,
      "category.category_id": categoryId,
    });

    await CategoryModel.updateOne(
      { category_id: categoryId },
      { $set: { product_count: productCount } }
    );

    return NextResponse.json({
      message: `Successfully removed ${result.modifiedCount} product(s)`,
      modified: result.modifiedCount,
    });
  } catch (error: any) {
    console.error("Error updating category products:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update products" },
      { status: 500 }
    );
  }
}
