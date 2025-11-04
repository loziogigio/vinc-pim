import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { CategoryModel } from "@/lib/db/models/category";
import { PIMProductModel } from "@/lib/db/models/pim-product";
import { nanoid } from "nanoid";

/**
 * GET /api/b2b/pim/categories
 * Get all categories with hierarchy
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const searchParams = req.nextUrl.searchParams;
    const parentId = searchParams.get("parent_id");
    const includeInactive = searchParams.get("include_inactive") === "true";

    // Build query
    const query: any = {
      wholesaler_id: session.userId,
    };

    if (parentId) {
      query.parent_id = parentId;
    } else if (parentId === null) {
      // Get root categories only
      query.parent_id = { $exists: false };
    }

    if (!includeInactive) {
      query.is_active = true;
    }

    const categories = await CategoryModel.find(query)
      .sort({ display_order: 1, name: 1 })
      .lean();

    // Update product counts for each category
    const categoryIds = categories.map((c) => c.category_id);
    const productCounts = await PIMProductModel.aggregate([
      {
        $match: {
          wholesaler_id: session.userId,
          isCurrent: true,
          "category.id": { $in: categoryIds },
        },
      },
      {
        $group: {
          _id: "$category.id",
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = new Map(productCounts.map((c) => [c._id, c.count]));

    const categoriesWithCounts = categories.map((cat) => ({
      ...cat,
      product_count: countMap.get(cat.category_id) || 0,
    }));

    return NextResponse.json({ categories: categoriesWithCounts });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/b2b/pim/categories
 * Create a new category
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await req.json();
    const { name, slug, description, parent_id, hero_image, seo, display_order } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      );
    }

    // Check if slug already exists for this wholesaler
    const existing = await CategoryModel.findOne({
      wholesaler_id: session.userId,
      slug,
    });

    if (existing) {
      return NextResponse.json(
        { error: "A category with this slug already exists" },
        { status: 400 }
      );
    }

    // Calculate level and path based on parent
    let level = 0;
    let path: string[] = [];

    if (parent_id) {
      const parent = await CategoryModel.findOne({
        category_id: parent_id,
        wholesaler_id: session.userId,
      });

      if (!parent) {
        return NextResponse.json(
          { error: "Parent category not found" },
          { status: 404 }
        );
      }

      level = parent.level + 1;
      path = [...parent.path, parent.category_id];
    }

    const category = await CategoryModel.create({
      category_id: nanoid(12),
      wholesaler_id: session.userId,
      name,
      slug,
      description,
      parent_id,
      level,
      path,
      hero_image,
      seo: seo || {},
      display_order: display_order || 0,
      is_active: true,
      product_count: 0,
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
