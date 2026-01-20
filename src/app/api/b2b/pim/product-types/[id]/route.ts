import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import { connectWithModels } from "@/lib/db/connection";

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
 * GET /api/b2b/pim/product-types/[id]
 * Fetch a single product type
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.statusCode || 401 }
      );
    }

    const { ProductType: ProductTypeModel, PIMProduct: PIMProductModel } = auth.models;
    const { id } = await params;

    const productType = await ProductTypeModel.findOne({
      product_type_id: id,
      // No wholesaler_id - database provides isolation
    }).lean();

    if (!productType) {
      return NextResponse.json(
        { error: "Product type not found" },
        { status: 404 }
      );
    }

    const productCount = await PIMProductModel.countDocuments({
      // No wholesaler_id - database provides isolation
      isCurrent: true,
      "product_type.id": id,
    });

    return NextResponse.json({
      productType: {
        ...productType,
        product_count: productCount,
      },
    });
  } catch (error) {
    console.error("Error fetching product type:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/b2b/pim/product-types/[id]
 * Update a product type
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.statusCode || 401 }
      );
    }

    const { ProductType: ProductTypeModel } = auth.models;
    const { id } = await params;

    const body = await req.json();
    const { name, slug, description, features, display_order, is_active } = body;

    const productType = await ProductTypeModel.findOne({
      product_type_id: id,
      // No wholesaler_id - database provides isolation
    });

    if (!productType) {
      return NextResponse.json(
        { error: "Product type not found" },
        { status: 404 }
      );
    }

    if (slug && slug !== productType.slug) {
      const existing = await ProductTypeModel.findOne({
        // No wholesaler_id - database provides isolation
        slug,
        product_type_id: { $ne: id },
      });

      if (existing) {
        return NextResponse.json(
          { error: "A product type with this slug already exists" },
          { status: 400 }
        );
      }
    }

    if (name !== undefined) productType.name = name;
    if (slug !== undefined) productType.slug = slug;
    if (description !== undefined) productType.description = description;
    if (features !== undefined) productType.features = features;
    if (display_order !== undefined) productType.display_order = display_order;
    if (is_active !== undefined) productType.is_active = is_active;
    productType.updated_at = new Date();

    await productType.save();

    return NextResponse.json({
      productType,
      message: "Product type updated successfully",
    });
  } catch (error) {
    console.error("Error updating product type:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/b2b/pim/product-types/[id]
 * Delete a product type
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.statusCode || 401 }
      );
    }

    const { ProductType: ProductTypeModel, PIMProduct: PIMProductModel } = auth.models;
    const { id } = await params;

    const productType = await ProductTypeModel.findOne({
      product_type_id: id,
      // No wholesaler_id - database provides isolation
    });

    if (!productType) {
      return NextResponse.json(
        { error: "Product type not found" },
        { status: 404 }
      );
    }

    const productCount = await PIMProductModel.countDocuments({
      // No wholesaler_id - database provides isolation
      isCurrent: true,
      "product_type.id": id,
    });

    if (productCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete product type with ${productCount} products. Please reassign them first.`,
        },
        { status: 400 }
      );
    }

    await ProductTypeModel.deleteOne({
      product_type_id: id,
      // No wholesaler_id - database provides isolation
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting product type:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
