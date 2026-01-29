/**
 * User Tag Members API
 *
 * GET    /api/b2b/user-tags/[id]/users - List users with this tag
 * POST   /api/b2b/user-tags/[id]/users - Add users to tag
 * DELETE /api/b2b/user-tags/[id]/users - Remove users from tag
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";

// ============================================
// GET - List users with this tag
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
    const { UserTag, PortalUser } = await connectWithModels(tenantDb);

    // Verify tag exists
    const tag = await UserTag.findOne({ tag_id: id }).lean();
    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Get pagination params
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const skip = (page - 1) * limit;

    // Find users with this tag
    const query = { "tags.tag_id": id };
    const [users, total] = await Promise.all([
      PortalUser.find(query)
        .select("portal_user_id username email is_active tags created_at")
        .skip(skip)
        .limit(limit)
        .sort({ username: 1 })
        .lean(),
      PortalUser.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      users: users.map((u) => ({
        portal_user_id: u.portal_user_id,
        username: u.username,
        email: u.email,
        is_active: u.is_active,
        created_at: u.created_at,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching tag users:", error);
    return NextResponse.json(
      { error: "Failed to fetch tag users" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Add users to tag
// ============================================

interface AddUsersPayload {
  user_ids: string[];
}

export async function POST(
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
    const payload: AddUsersPayload = await req.json();
    const { UserTag, PortalUser } = await connectWithModels(tenantDb);

    // Validate
    if (!Array.isArray(payload.user_ids) || payload.user_ids.length === 0) {
      return NextResponse.json(
        { error: "user_ids array is required" },
        { status: 400 }
      );
    }

    // Verify tag exists
    const tag = await UserTag.findOne({ tag_id: id });
    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Prepare tag reference to embed
    const tagRef = {
      tag_id: tag.tag_id,
      name: tag.name,
      slug: tag.slug,
      color: tag.color,
    };

    // Add tag to users (only if they don't already have it)
    const result = await PortalUser.updateMany(
      {
        portal_user_id: { $in: payload.user_ids },
        "tags.tag_id": { $ne: id }, // Don't add if already has tag
      },
      { $push: { tags: tagRef } }
    );

    // Update user_count on the tag
    const newCount = await PortalUser.countDocuments({ "tags.tag_id": id });
    tag.user_count = newCount;
    await tag.save();

    return NextResponse.json({
      success: true,
      added: result.modifiedCount,
      total_users: newCount,
      message: `Added ${result.modifiedCount} user(s) to tag`,
    });
  } catch (error) {
    console.error("Error adding users to tag:", error);
    return NextResponse.json(
      { error: "Failed to add users to tag" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Remove users from tag
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

    // Get user_ids from query params (for batch delete)
    const { searchParams } = new URL(req.url);
    const userIdsParam = searchParams.get("user_ids");

    if (!userIdsParam) {
      return NextResponse.json(
        { error: "user_ids query parameter is required" },
        { status: 400 }
      );
    }

    const userIds = userIdsParam.split(",").filter(Boolean);
    if (userIds.length === 0) {
      return NextResponse.json(
        { error: "At least one user_id is required" },
        { status: 400 }
      );
    }

    // Verify tag exists
    const tag = await UserTag.findOne({ tag_id: id });
    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Remove tag from users
    const result = await PortalUser.updateMany(
      { portal_user_id: { $in: userIds } },
      { $pull: { tags: { tag_id: id } } }
    );

    // Update user_count on the tag
    const newCount = await PortalUser.countDocuments({ "tags.tag_id": id });
    tag.user_count = newCount;
    await tag.save();

    return NextResponse.json({
      success: true,
      removed: result.modifiedCount,
      total_users: newCount,
      message: `Removed ${result.modifiedCount} user(s) from tag`,
    });
  } catch (error) {
    console.error("Error removing users from tag:", error);
    return NextResponse.json(
      { error: "Failed to remove users from tag" },
      { status: 500 }
    );
  }
}
