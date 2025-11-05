import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { BrandModel } from "@/lib/db/models/brand";
import { nanoid } from "nanoid";

// GET /api/b2b/pim/brands - List all brands with filtering
export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const isActive = searchParams.get("is_active");
    const sortBy = searchParams.get("sort_by") || "created_at";
    const sortOrder = searchParams.get("sort_order") || "desc";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Build query
    const query: any = { wholesaler_id: session.userId };

    if (search) {
      query.$or = [
        { label: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (isActive !== null && isActive !== undefined && isActive !== "") {
      query.is_active = isActive === "true";
    }

    // Build sort
    const sort: any = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const [brands, total] = await Promise.all([
      BrandModel.find(query).sort(sort).skip(skip).limit(limit).lean(),
      BrandModel.countDocuments(query),
    ]);

    return NextResponse.json({
      brands,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching brands:", error);
    return NextResponse.json(
      { error: "Failed to fetch brands" },
      { status: 500 }
    );
  }
}

// POST /api/b2b/pim/brands - Create new brand
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await req.json();
    const { label, slug, description, logo_url, website_url, is_active, display_order } = body;

    // Validation
    if (!label || !label.trim()) {
      return NextResponse.json(
        { error: "Label is required" },
        { status: 400 }
      );
    }

    // Generate slug if not provided
    let finalSlug = slug;
    if (!finalSlug) {
      finalSlug = label
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }

    // Check if slug already exists for this wholesaler
    const existingBrand = await BrandModel.findOne({
      wholesaler_id: session.userId,
      slug: finalSlug,
    });

    if (existingBrand) {
      return NextResponse.json(
        { error: "A brand with this slug already exists" },
        { status: 409 }
      );
    }

    // Create brand
    const brand = await BrandModel.create({
      brand_id: nanoid(12),
      wholesaler_id: session.userId,
      label: label.trim(),
      slug: finalSlug,
      description: description?.trim() || undefined,
      logo_url: logo_url?.trim() || undefined,
      website_url: website_url?.trim() || undefined,
      is_active: is_active !== undefined ? is_active : true,
      display_order: display_order || 0,
      product_count: 0,
    });

    return NextResponse.json(
      { brand, message: "Brand created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating brand:", error);
    return NextResponse.json(
      { error: "Failed to create brand" },
      { status: 500 }
    );
  }
}
