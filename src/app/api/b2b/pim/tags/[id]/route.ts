import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { TagModel } from "@/lib/db/models/tag";
import { PIMProductModel } from "@/lib/db/models/pim-product";

// GET /api/b2b/pim/tags/[id] - Fetch single tag
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

    const tag = await TagModel.findOne({
      tag_id: id,
      // No wholesaler_id - database provides isolation
    }).lean();

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    const productCount = await PIMProductModel.countDocuments({
      // No wholesaler_id - database provides isolation
      isCurrent: true,
      "tag.id": id,
    });

    return NextResponse.json({
      tag: {
        ...tag,
        product_count: productCount,
      },
    });
  } catch (error) {
    console.error("Error fetching tag:", error);
    return NextResponse.json(
      { error: "Failed to fetch tag" },
      { status: 500 }
    );
  }
}

// PATCH /api/b2b/pim/tags/[id] - Update tag
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
    const { name, slug, description, color, is_active, display_order } = body;

    const tag = await TagModel.findOne({
      tag_id: id,
      // No wholesaler_id - database provides isolation
    });

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    if (slug && slug !== tag.slug) {
      const conflict = await TagModel.findOne({
        // No wholesaler_id - database provides isolation
        slug,
        tag_id: { $ne: id },
      });

      if (conflict) {
        return NextResponse.json(
          { error: "A tag with this slug already exists" },
          { status: 409 }
        );
      }
    }

    if (name !== undefined) tag.name = name.trim();
    if (slug !== undefined) tag.slug = slug.trim();
    if (description !== undefined) tag.description = description?.trim() || undefined;
    if (color !== undefined) tag.color = color?.trim() || undefined;
    if (is_active !== undefined) tag.is_active = Boolean(is_active);
    if (display_order !== undefined) tag.display_order = display_order;
    tag.updated_at = new Date();

    await tag.save();

    return NextResponse.json({
      tag,
      message: "Tag updated successfully",
    });
  } catch (error) {
    console.error("Error updating tag:", error);
    return NextResponse.json(
      { error: "Failed to update tag" },
      { status: 500 }
    );
  }
}

// DELETE /api/b2b/pim/tags/[id] - Delete tag
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

    const productCount = await PIMProductModel.countDocuments({
      // No wholesaler_id - database provides isolation
      isCurrent: true,
      "tag.id": id,
    });

    if (productCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete tag with ${productCount} associated products. Remove the tag from those products first.`,
        },
        { status: 400 }
      );
    }

    const result = await TagModel.deleteOne({
      tag_id: id,
      // No wholesaler_id - database provides isolation
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting tag:", error);
    return NextResponse.json(
      { error: "Failed to delete tag" },
      { status: 500 }
    );
  }
}
