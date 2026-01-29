/**
 * Single User Tag API
 *
 * GET    /api/b2b/user-tags/[id] - Get a single tag
 * PUT    /api/b2b/user-tags/[id] - Update a tag
 * DELETE /api/b2b/user-tags/[id] - Delete a tag
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";

// ============================================
// GET - Get single tag
// ============================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tenantDb = `vinc-${session.tenantId}`;
    const { UserTag } = await connectWithModels(tenantDb);

    const tag = await UserTag.findOne({ tag_id: id }).lean();

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    return NextResponse.json({ tag });
  } catch (error) {
    console.error("Error fetching user tag:", error);
    return NextResponse.json(
      { error: "Failed to fetch user tag" },
      { status: 500 }
    );
  }
}

// ============================================
// PUT - Update tag
// ============================================

interface UpdateUserTagPayload {
  name?: string;
  description?: string;
  color?: string;
  is_active?: boolean;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tenantDb = `vinc-${session.tenantId}`;
    const payload: UpdateUserTagPayload = await req.json();
    const { UserTag } = await connectWithModels(tenantDb);

    // Find tag
    const tag = await UserTag.findOne({ tag_id: id });

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Update fields
    if (payload.name !== undefined) {
      const trimmedName = payload.name.trim();
      if (!trimmedName) {
        return NextResponse.json(
          { error: "Tag name cannot be empty" },
          { status: 400 }
        );
      }

      // Check for duplicate name (excluding current tag)
      const existingByName = await UserTag.findOne({
        tag_id: { $ne: id },
        name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
      });
      if (existingByName) {
        return NextResponse.json(
          { error: "A tag with this name already exists" },
          { status: 400 }
        );
      }

      tag.name = trimmedName;
    }

    if (payload.description !== undefined) {
      tag.description = payload.description?.trim() || undefined;
    }

    if (payload.color !== undefined) {
      tag.color = payload.color?.trim() || undefined;
    }

    if (payload.is_active !== undefined) {
      tag.is_active = payload.is_active;
    }

    tag.updated_by = session.user?.id || session.user?.email;

    await tag.save();

    return NextResponse.json({
      success: true,
      tag: {
        tag_id: tag.tag_id,
        name: tag.name,
        slug: tag.slug,
        description: tag.description,
        color: tag.color,
        is_active: tag.is_active,
        user_count: tag.user_count,
        updated_at: tag.updated_at,
      },
      message: "User tag updated",
    });
  } catch (error) {
    console.error("Error updating user tag:", error);

    // Handle duplicate slug error
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json(
        { error: "A tag with this name already exists" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update user tag" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Delete tag
// ============================================

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tenantDb = `vinc-${session.tenantId}`;
    const { UserTag, PortalUser } = await connectWithModels(tenantDb);

    const tag = await UserTag.findOne({ tag_id: id });

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Remove tag from all portal users
    await PortalUser.updateMany(
      { "tags.tag_id": id },
      { $pull: { tags: { tag_id: id } } }
    );

    // Delete the tag
    await UserTag.deleteOne({ tag_id: id });

    return NextResponse.json({
      success: true,
      message: "User tag deleted",
    });
  } catch (error) {
    console.error("Error deleting user tag:", error);
    return NextResponse.json(
      { error: "Failed to delete user tag" },
      { status: 500 }
    );
  }
}
