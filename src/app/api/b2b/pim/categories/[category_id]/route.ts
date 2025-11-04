import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { CategoryModel } from "@/lib/db/models/category";
import { PIMProductModel } from "@/lib/db/models/pim-product";

/**
 * GET /api/b2b/pim/categories/[category_id]
 * Get a single category with details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ category_id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { category_id } = await params;

    const category = await CategoryModel.findOne({
      category_id,
      wholesaler_id: session.userId,
    }).lean();

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Get product count
    const productCount = await PIMProductModel.countDocuments({
      wholesaler_id: session.userId,
      isCurrent: true,
      "category.id": category_id,
    });

    // Get child categories count
    const childCount = await CategoryModel.countDocuments({
      wholesaler_id: session.userId,
      parent_id: category_id,
    });

    return NextResponse.json({
      category: {
        ...category,
        product_count: productCount,
        child_count: childCount,
      },
    });
  } catch (error) {
    console.error("Error fetching category:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/b2b/pim/categories/[category_id]
 * Update a category
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ category_id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { category_id } = await params;
    const body = await req.json();

    const allowedFields = [
      "name",
      "slug",
      "description",
      "parent_id",
      "hero_image",
      "seo",
      "display_order",
      "is_active",
    ];

    const updateData: any = { updated_at: new Date() };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // If parent_id is changing, recalculate level and path
    if (body.parent_id !== undefined) {
      if (body.parent_id) {
        const parent = await CategoryModel.findOne({
          category_id: body.parent_id,
          wholesaler_id: session.userId,
        });

        if (!parent) {
          return NextResponse.json(
            { error: "Parent category not found" },
            { status: 404 }
          );
        }

        // Check for circular reference
        if (parent.path.includes(category_id) || parent.category_id === category_id) {
          return NextResponse.json(
            { error: "Cannot set a child category as parent" },
            { status: 400 }
          );
        }

        updateData.level = parent.level + 1;
        updateData.path = [...parent.path, parent.category_id];
      } else {
        // Moving to root level
        updateData.level = 0;
        updateData.path = [];
      }
    }

    const category = await CategoryModel.findOneAndUpdate(
      { category_id, wholesaler_id: session.userId },
      updateData,
      { new: true }
    ).lean();

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ category });
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/b2b/pim/categories/[category_id]
 * Delete a category (soft delete)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ category_id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { category_id } = await params;

    // Check if category has products
    const productCount = await PIMProductModel.countDocuments({
      wholesaler_id: session.userId,
      isCurrent: true,
      "category.id": category_id,
    });

    if (productCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete category with ${productCount} active products. Please reassign products first.`,
        },
        { status: 400 }
      );
    }

    // Check if category has children
    const childCount = await CategoryModel.countDocuments({
      wholesaler_id: session.userId,
      parent_id: category_id,
    });

    if (childCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete category with ${childCount} child categories. Please delete or reassign children first.`,
        },
        { status: 400 }
      );
    }

    // Soft delete
    const category = await CategoryModel.findOneAndUpdate(
      { category_id, wholesaler_id: session.userId },
      { is_active: false, updated_at: new Date() },
      { new: true }
    );

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
