/**
 * User Tags API
 *
 * GET  /api/b2b/user-tags - List all user tags
 * POST /api/b2b/user-tags - Create a new user tag
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";

// ============================================
// GET - List all user tags
// ============================================

export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { UserTag } = await connectWithModels(tenantDb);

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("include_inactive") === "true";

    const query = includeInactive ? {} : { is_active: true };
    const tags = await UserTag.find(query).sort({ name: 1 }).lean();

    return NextResponse.json({
      success: true,
      tags,
    });
  } catch (error) {
    console.error("Error fetching user tags:", error);
    return NextResponse.json(
      { error: "Failed to fetch user tags" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Create a new user tag
// ============================================

interface CreateUserTagPayload {
  name: string;
  description?: string;
  color?: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const payload: CreateUserTagPayload = await req.json();
    const { UserTag } = await connectWithModels(tenantDb);

    // Validate required fields
    if (!payload.name?.trim()) {
      return NextResponse.json(
        { error: "Tag name is required" },
        { status: 400 }
      );
    }

    // Check for duplicate name (slug will be generated from name)
    const existingByName = await UserTag.findOne({
      name: { $regex: new RegExp(`^${payload.name.trim()}$`, "i") },
    });
    if (existingByName) {
      return NextResponse.json(
        { error: "A tag with this name already exists" },
        { status: 400 }
      );
    }

    // Create the tag
    const tag = new UserTag({
      name: payload.name.trim(),
      description: payload.description?.trim(),
      color: payload.color?.trim(),
      created_by: session.user?.id || session.user?.email,
    });

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
        created_at: tag.created_at,
      },
      message: "User tag created",
    });
  } catch (error) {
    console.error("Error creating user tag:", error);

    // Handle duplicate slug error
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json(
        { error: "A tag with this name already exists" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create user tag" },
      { status: 500 }
    );
  }
}
