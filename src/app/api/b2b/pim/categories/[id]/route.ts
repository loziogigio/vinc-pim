import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { CategoryModel } from "@/lib/db/models/category";
import { PIMProductModel } from "@/lib/db/models/pim-product";

/**
 * GET /api/b2b/pim/categories/[id]
 * Fetch a single category with product and child counts
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

    const category = await CategoryModel.findOne({
      category_id: id,
      wholesaler_id: session.userId,
    }).lean();

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    const [productCount, childCount] = await Promise.all([
      PIMProductModel.countDocuments({
        wholesaler_id: session.userId,
        isCurrent: true,
        "category.id": id,
      }),
      CategoryModel.countDocuments({
        wholesaler_id: session.userId,
        parent_id: id,
      }),
    ]);

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
 * PATCH /api/b2b/pim/categories/[id]
 * Update a category
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
    const {
      name,
      slug,
      description,
      parent_id,
      hero_image,
      seo,
      display_order,
      is_active,
    } = body;

    const category = await CategoryModel.findOne({
      category_id: id,
      wholesaler_id: session.userId,
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // If slug is changing, check duplicates
    if (slug && slug !== category.slug) {
      const existing = await CategoryModel.findOne({
        wholesaler_id: session.userId,
        slug,
        category_id: { $ne: id },
      });

      if (existing) {
        return NextResponse.json(
          { error: "A category with this slug already exists" },
          { status: 400 }
        );
      }
    }

    const updateData: any = {
      updated_at: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (description !== undefined) updateData.description = description;
    if (hero_image !== undefined) updateData.hero_image = hero_image;
    if (seo !== undefined) updateData.seo = seo;
    if (display_order !== undefined) updateData.display_order = display_order;
    if (is_active !== undefined) updateData.is_active = is_active;

    if (parent_id !== undefined) {
      const newParentId = parent_id || null;
      updateData.parent_id = newParentId;

      if (newParentId) {
        if (newParentId === id) {
          return NextResponse.json(
            { error: "A category cannot be its own parent" },
            { status: 400 }
          );
        }

        const parent = await CategoryModel.findOne({
          category_id: newParentId,
          wholesaler_id: session.userId,
        }).lean();

        if (!parent) {
          return NextResponse.json(
            { error: "Parent category not found" },
            { status: 404 }
          );
        }

        if (parent.path.includes(id)) {
          return NextResponse.json(
            { error: "Cannot set a child category as parent" },
            { status: 400 }
          );
        }

        updateData.level = parent.level + 1;
        updateData.path = [...parent.path, parent.category_id];
      } else {
        updateData.level = 0;
        updateData.path = [];
      }
    }

    const updatedCategory = await CategoryModel.findOneAndUpdate(
      { category_id: id, wholesaler_id: session.userId },
      updateData,
      { new: true }
    );

    return NextResponse.json({ category: updatedCategory });
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/b2b/pim/categories/[id]
 * Soft delete a category
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

    const [productCount, childCount] = await Promise.all([
      PIMProductModel.countDocuments({
        wholesaler_id: session.userId,
        isCurrent: true,
        "category.id": id,
      }),
      CategoryModel.countDocuments({
        wholesaler_id: session.userId,
        parent_id: id,
      }),
    ]);

    if (productCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete category with ${productCount} active products. Please reassign products first.`,
        },
        { status: 400 }
      );
    }

    if (childCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete category with ${childCount} child categories. Please delete or reassign children first.`,
        },
        { status: 400 }
      );
    }

    const category = await CategoryModel.findOneAndUpdate(
      { category_id: id, wholesaler_id: session.userId },
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
