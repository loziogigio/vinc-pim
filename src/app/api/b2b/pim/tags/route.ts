import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { TagModel } from "@/lib/db/models/tag";
import { nanoid } from "nanoid";

// GET /api/b2b/pim/tags - List tags
export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session?.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const isActive = searchParams.get("is_active");
    const includeInactive = searchParams.get("include_inactive") === "true";
    const sortBy = searchParams.get("sort_by") || "display_order";
    const sortOrder = searchParams.get("sort_order") === "desc" ? -1 : 1;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    // Build query - no wholesaler_id, database provides isolation
    const query: Record<string, unknown> = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (!includeInactive && (isActive === null || isActive === undefined)) {
      query.is_active = true;
    } else if (isActive !== null && isActive !== undefined && isActive !== "") {
      query.is_active = isActive === "true";
    }

    const sort: Record<string, number> = { [sortBy]: sortOrder };

    const skip = (page - 1) * limit;
    const [tags, total] = await Promise.all([
      TagModel.find(query).sort(sort).skip(skip).limit(limit).lean(),
      TagModel.countDocuments(query),
    ]);

    return NextResponse.json({
      tags,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching tags:", error);
    return NextResponse.json(
      { error: "Failed to fetch tags" },
      { status: 500 }
    );
  }
}

// POST /api/b2b/pim/tags - Create tag
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session?.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await req.json();
    const { name, slug, description, color, is_active, display_order } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    let finalSlug = slug;
    if (!finalSlug) {
      finalSlug = name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }

    // Check if slug already exists (no wholesaler_id - database provides isolation)
    const existingTag = await TagModel.findOne({
      slug: finalSlug,
    });

    if (existingTag) {
      return NextResponse.json(
        { error: "A tag with this slug already exists" },
        { status: 409 }
      );
    }

    // Create tag - no wholesaler_id, database provides isolation
    const tag = await TagModel.create({
      tag_id: nanoid(12),
      name: name.trim(),
      slug: finalSlug,
      description: description?.trim() || undefined,
      color: color?.trim() || undefined,
      is_active: is_active !== undefined ? Boolean(is_active) : true,
      display_order: display_order || 0,
      product_count: 0,
    });

    return NextResponse.json(
      { tag, message: "Tag created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating tag:", error);
    return NextResponse.json(
      { error: "Failed to create tag" },
      { status: 500 }
    );
  }
}
