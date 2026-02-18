import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { nanoid } from "nanoid";

// GET /api/b2b/pim/brands - List all brands with filtering (session + API key auth)
export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb } = auth;
    const { Brand: BrandModel } = await connectWithModels(tenantDb);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const isActive = searchParams.get("is_active");
    const hasLogo = searchParams.get("has_logo");
    const sortBy = searchParams.get("sort_by") || "created_at";
    const sortOrder = searchParams.get("sort_order") || "desc";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Build query - no wholesaler_id, database provides isolation
    const query: any = {};

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

    if (hasLogo === "true") {
      query.logo_url = { $exists: true, $nin: [null, ""] };
    } else if (hasLogo === "false") {
      query.$and = [
        ...(query.$and || []),
        { $or: [{ logo_url: { $exists: false } }, { logo_url: null }, { logo_url: "" }] },
      ];
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;

    let brands;
    let total: number;

    if (sortBy === "image_label") {
      // Compound sort: brands with image first, then without, alphabetically within each group
      const pipeline: any[] = [];
      if (Object.keys(query).length > 0) {
        pipeline.push({ $match: query });
      }
      pipeline.push(
        {
          $addFields: {
            _has_logo: {
              $cond: [
                { $and: [{ $gt: ["$logo_url", null] }, { $ne: ["$logo_url", ""] }] },
                1,
                0,
              ],
            },
          },
        },
        { $sort: { _has_logo: sortOrder === "asc" ? 1 : -1, label: 1 } },
        { $skip: skip },
        { $limit: limit },
        { $project: { _has_logo: 0 } }
      );

      [brands, total] = await Promise.all([
        BrandModel.aggregate(pipeline),
        BrandModel.countDocuments(query),
      ]);
    } else {
      const sort: any = {};
      sort[sortBy] = sortOrder === "asc" ? 1 : -1;

      [brands, total] = await Promise.all([
        BrandModel.find(query).sort(sort).skip(skip).limit(limit).lean(),
        BrandModel.countDocuments(query),
      ]);
    }

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
    if (!session || !session.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { Brand: BrandModel } = await connectWithModels(tenantDb);

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

    // Check if slug already exists (no wholesaler_id - database provides isolation)
    const existingBrand = await BrandModel.findOne({
      slug: finalSlug,
    });

    if (existingBrand) {
      return NextResponse.json(
        { error: "A brand with this slug already exists" },
        { status: 409 }
      );
    }

    // Create brand - no wholesaler_id, database provides isolation
    const brand = await BrandModel.create({
      brand_id: nanoid(12),
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
