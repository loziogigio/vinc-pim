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
    const productCounts = await PIMProductModel.aggregate([
      {
        $match: {
          // No wholesaler_id - database provides isolation
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
    const auth = await authenticateRequest(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.statusCode || 401 }
      );
    }

    const { ProductType: ProductTypeModel } = auth.models;

    const body = await req.json();
    const { name, slug, description, features, display_order } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      );
    }

    // Check if slug already exists (no wholesaler_id - database provides isolation)
    const existing = await ProductTypeModel.findOne({
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
      // No wholesaler_id - database provides isolation
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
