import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { ProductTypeModel } from "@/lib/db/models/product-type";
import { PIMProductModel } from "@/lib/db/models/pim-product";

/**
 * PATCH /api/b2b/pim/product-types/[productTypeId]
 * Update a product type
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { productTypeId: string } }
) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { productTypeId } = params;
    const body = await req.json();
    const { name, slug, description, features, display_order, is_active } = body;

    // Check if product type exists and belongs to wholesaler
    const productType = await ProductTypeModel.findOne({
      product_type_id: productTypeId,
      wholesaler_id: session.userId,
    });

    if (!productType) {
      return NextResponse.json(
        { error: "Product type not found" },
        { status: 404 }
      );
    }

    // If slug is changing, check for duplicates
    if (slug && slug !== productType.slug) {
      const existing = await ProductTypeModel.findOne({
        wholesaler_id: session.userId,
        slug,
        product_type_id: { $ne: productTypeId },
      });

      if (existing) {
        return NextResponse.json(
          { error: "A product type with this slug already exists" },
          { status: 400 }
        );
      }
    }

    // Update product type
    const updateData: any = {
      updated_at: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (description !== undefined) updateData.description = description;
    if (features !== undefined) updateData.features = features;
    if (display_order !== undefined) updateData.display_order = display_order;
    if (is_active !== undefined) updateData.is_active = is_active;

    const updatedProductType = await ProductTypeModel.findOneAndUpdate(
      { product_type_id: productTypeId, wholesaler_id: session.userId },
      updateData,
      { new: true }
    );

    return NextResponse.json({ productType: updatedProductType });
  } catch (error) {
    console.error("Error updating product type:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/b2b/pim/product-types/[productTypeId]
 * Delete a product type
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { productTypeId: string } }
) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { productTypeId } = params;

    // Check if product type exists and belongs to wholesaler
    const productType = await ProductTypeModel.findOne({
      product_type_id: productTypeId,
      wholesaler_id: session.userId,
    });

    if (!productType) {
      return NextResponse.json(
        { error: "Product type not found" },
        { status: 404 }
      );
    }

    // Check if product type has products
    const productCount = await PIMProductModel.countDocuments({
      wholesaler_id: session.userId,
      isCurrent: true,
      "product_type.id": productTypeId,
    });

    if (productCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete product type with ${productCount} products. Please reassign them first.`,
        },
        { status: 400 }
      );
    }

    // Delete product type
    await ProductTypeModel.deleteOne({
      product_type_id: productTypeId,
      wholesaler_id: session.userId,
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
