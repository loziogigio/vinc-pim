import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import { connectWithModels } from "@/lib/db/connection";
import { nanoid } from "nanoid";

/**
 * Authenticate request via session or API key
 * Returns tenant-specific models from connection pool
 */
async function authenticateRequest(req: NextRequest): Promise<{
  authenticated: boolean;
  tenantId?: string;
  tenantDb?: string;
  models?: Awaited<ReturnType<typeof connectWithModels>>;
  error?: string;
  statusCode?: number;
}> {
  const authMethod = req.headers.get("x-auth-method");
  let tenantId: string;
  let tenantDb: string;

  if (authMethod === "api-key") {
    const apiKeyResult = await verifyAPIKeyFromRequest(req, "product-types");
    if (!apiKeyResult.authenticated) {
      return {
        authenticated: false,
        error: apiKeyResult.error,
        statusCode: apiKeyResult.statusCode,
      };
    }
    tenantId = apiKeyResult.tenantId!;
    tenantDb = apiKeyResult.tenantDb!;
  } else {
    const session = await getB2BSession();
    if (!session || !session.isLoggedIn || !session.tenantId) {
      return { authenticated: false, error: "Unauthorized", statusCode: 401 };
    }
    tenantId = session.tenantId;
    tenantDb = `vinc-${session.tenantId}`;
  }

  // Get tenant-specific models from connection pool
  const models = await connectWithModels(tenantDb);

  return {
    authenticated: true,
    tenantId,
    tenantDb,
    models,
  };
}

/**
 * GET /api/b2b/pim/product-types
 * Get all product types
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.statusCode || 401 }
      );
    }

    const { ProductType: ProductTypeModel, PIMProduct: PIMProductModel } = auth.models;

    const searchParams = req.nextUrl.searchParams;
    const includeInactive = searchParams.get("include_inactive") === "true";

    // Build query - no wholesaler_id, database provides isolation
    const query: any = {};

    if (!includeInactive) {
      query.is_active = true;
    }

    const productTypes = await ProductTypeModel.find(query)
      .sort({ display_order: 1, name: 1 })
      .lean();

    // Update product counts for each product type
    const productTypeIds = productTypes.map((pt) => pt.product_type_id);
    // Support both legacy "id" and new "product_type_id" field names
    const productCounts = await PIMProductModel.aggregate([
      {
        $match: {
          // No wholesaler_id - database provides isolation
          isCurrent: true,
          $or: [
            { "product_type.product_type_id": { $in: productTypeIds } },
            { "product_type.id": { $in: productTypeIds } },
          ],
        },
      },
      {
        $group: {
          // Use coalesce-like logic to get the ID from either field
          _id: { $ifNull: ["$product_type.product_type_id", "$product_type.id"] },
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
    const auth = await authenticateRequest(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.statusCode || 401 }
      );
    }

    const { ProductType: ProductTypeModel } = auth.models;

    const body = await req.json();
    const { code, name, slug, description, technical_specifications, display_order } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      );
    }

    // Check if slug already exists (no wholesaler_id - database provides isolation)
    const existingSlug = await ProductTypeModel.findOne({ slug });

    if (existingSlug) {
      return NextResponse.json(
        { error: "A product type with this slug already exists" },
        { status: 400 }
      );
    }

    // If code provided, check uniqueness
    if (code) {
      const existingCode = await ProductTypeModel.findOne({ code });
      if (existingCode) {
        return NextResponse.json(
          { error: "A product type with this code already exists" },
          { status: 400 }
        );
      }
    }

    const productType = await ProductTypeModel.create({
      product_type_id: nanoid(12),
      code: code || undefined,
      // No wholesaler_id - database provides isolation
      name,
      slug,
      description,
      technical_specifications: technical_specifications || [],
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

/**
 * DELETE /api/b2b/pim/product-types
 * Bulk delete product types
 *
 * Body options:
 * - { delete_all: true } - Delete all product types (skips those with products)
 * - { product_type_ids: ["id1", "id2"] } - Delete specific product types by IDs
 * - { force: true } - Force delete even if products are assigned (clears product_type from products)
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.statusCode || 401 }
      );
    }

    const { ProductType: ProductTypeModel, PIMProduct: PIMProductModel } = auth.models;

    const body = await req.json().catch(() => ({}));
    const { delete_all, product_type_ids, force } = body;

    if (!delete_all && (!product_type_ids || !Array.isArray(product_type_ids))) {
      return NextResponse.json(
        { error: "Either delete_all: true or product_type_ids array is required" },
        { status: 400 }
      );
    }

    // Get product types with products assigned (support both field names)
    const productCounts = await PIMProductModel.aggregate([
      {
        $match: {
          isCurrent: true,
          $or: [
            { "product_type.product_type_id": { $exists: true, $ne: null } },
            { "product_type.id": { $exists: true, $ne: null } },
          ],
        },
      },
      {
        $group: {
          _id: { $ifNull: ["$product_type.product_type_id", "$product_type.id"] },
          count: { $sum: 1 },
        },
      },
    ]);

    const typesWithProducts = new Map(productCounts.map((c) => [c._id, c.count]));

    let typesToDelete: string[];

    if (delete_all) {
      // Get all product type IDs
      const allTypes = await ProductTypeModel.find({}).select("product_type_id").lean();
      typesToDelete = allTypes.map((pt: { product_type_id: string }) => pt.product_type_id);
    } else {
      typesToDelete = product_type_ids;
    }

    // If not forcing, filter out types with products
    let skipped = 0;
    let skippedIds: string[] = [];

    if (!force) {
      skippedIds = typesToDelete.filter((id: string) => typesWithProducts.has(id));
      skipped = skippedIds.length;
      typesToDelete = typesToDelete.filter((id: string) => !typesWithProducts.has(id));
    } else {
      // Force mode: clear product_type from products first (support both field names)
      await PIMProductModel.updateMany(
        {
          $or: [
            { "product_type.product_type_id": { $in: typesToDelete } },
            { "product_type.id": { $in: typesToDelete } },
          ],
        },
        { $unset: { product_type: "" } }
      );
    }

    // Delete product types
    const result = await ProductTypeModel.deleteMany({
      product_type_id: { $in: typesToDelete },
    });

    return NextResponse.json({
      success: true,
      deleted: result.deletedCount,
      skipped,
      skipped_reason: skipped > 0 ? "Product types have products assigned (use force: true to override)" : undefined,
    });
  } catch (error) {
    console.error("Error bulk deleting product types:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
