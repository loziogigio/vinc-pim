import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { ProductTypeModel } from "@/lib/db/models/product-type";
import { PIMProductModel } from "@/lib/db/models/pim-product";

/**
 * GET /api/b2b/pim/product-types/[id]
 * Fetch a single product type
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session?.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
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
    const session = await getB2BSession();
    if (!session?.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
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
    const session = await getB2BSession();
    if (!session?.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
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
