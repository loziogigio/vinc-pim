import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { nanoid } from "nanoid";
import { invalidateCategoryCache } from "@/lib/services/category.service";
import {
  getEnabledLocaleCodes,
  buildMultilangSearchOr,
} from "@/lib/search/multilang-search";

/**
 * GET /api/b2b/pim/categories
 * Get all categories with hierarchy
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb } = auth;
    const {
      Category: CategoryModel,
      PIMProduct: PIMProductModel,
      Language: LanguageModel,
    } = await connectWithModels(tenantDb);

    const searchParams = req.nextUrl.searchParams;
    const parentId = searchParams.get("parent_id");
    const includeInactive = searchParams.get("include_inactive") === "true";
    const channelFilter = searchParams.get("channel");
    const search = searchParams.get("search")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(
      200,
      Math.max(1, parseInt(searchParams.get("limit") || "100") || 100),
    );

    // Build query - no wholesaler_id, database provides isolation
    const query: any = {};

    // Only filter by parent_id if explicitly provided in query params
    if (searchParams.has("parent_id")) {
      const parentIdValue = searchParams.get("parent_id");
      if (parentIdValue === "null" || parentIdValue === "") {
        // Explicitly requesting root categories
        query.parent_id = null;
      } else {
        query.parent_id = parentIdValue;
      }
    }
    // Otherwise, don't filter by parent_id (return all categories)

    if (!includeInactive) {
      query.is_active = true;
    }

    // Channel filter: find roots with matching channel, then include their descendants
    if (channelFilter) {
      const rootsWithChannel = await CategoryModel.find({
        channel_code: channelFilter,
        $or: [{ parent_id: null }, { parent_id: { $exists: false } }],
      })
        .select("category_id")
        .lean();

      const rootIds = rootsWithChannel.map((r: any) => r.category_id);

      if (rootIds.length === 0) {
        return NextResponse.json({ categories: [] });
      }

      // Match root categories OR children whose path includes a matching root
      query.$or = [
        { category_id: { $in: rootIds } },
        { path: { $in: rootIds } },
      ];
    }

    // Server-side search across the multilingual name + slug + external_code.
    if (search) {
      const codes = await getEnabledLocaleCodes(LanguageModel);
      const searchOr = buildMultilangSearchOr(search, codes, {
        plainFields: ["slug", "external_code"],
      });
      if (query.$or) {
        // Combine the channel-root $or with the search $or via $and.
        query.$and = [{ $or: query.$or }, { $or: searchOr }];
        delete query.$or;
      } else {
        query.$or = searchOr;
      }
    }

    // Root-category filter (top-level: no parent_id) for server-side count.
    // Restrict the same query to top-level categories without clobbering any
    // existing $or (channel/search) — combine via $and.
    const rootCondition = {
      $or: [{ parent_id: null }, { parent_id: { $exists: false } }],
    };
    const { $or: queryOr, $and: queryAnd, ...queryRest } = query;
    const rootQuery: any = { ...queryRest, $and: [...(queryAnd || [])] };
    if (queryOr) rootQuery.$and.push({ $or: queryOr });
    rootQuery.$and.push(rootCondition);

    const [categories, total, rootCount] = await Promise.all([
      CategoryModel.find(query)
        .sort({ display_order: 1, name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CategoryModel.countDocuments(query),
      CategoryModel.countDocuments(rootQuery),
    ]);

    // Update product counts for each category
    const categoryIds = categories.map((c) => c.category_id);
    const productCounts = await PIMProductModel.aggregate([
      {
        $match: {
          // No wholesaler_id - database provides isolation
          isCurrent: true,
          "category.category_id": { $in: categoryIds },
        },
      },
      {
        $group: {
          _id: "$category.category_id",
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = new Map(productCounts.map((c) => [c._id, c.count]));

    const categoriesWithCounts = categories.map((cat) => ({
      ...cat,
      product_count: countMap.get(cat.category_id) || 0,
    }));

    return NextResponse.json({
      categories: categoriesWithCounts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      root_count: rootCount,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/b2b/pim/categories
 * Create a new category
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb } = auth;
    const { Category: CategoryModel } = await connectWithModels(tenantDb);

    const body = await req.json();
    const {
      name,
      slug,
      description,
      parent_id,
      hero_image,
      mobile_hero_image,
      item_icon,
      seo,
      display_order,
      channel_code,
      external_code,
    } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 },
      );
    }

    // Root categories must have a channel_code
    if (!parent_id && !channel_code) {
      return NextResponse.json(
        { error: "Root categories must be assigned to a sales channel" },
        { status: 400 },
      );
    }

    // Check if slug already exists (no wholesaler_id - database provides isolation)
    const existing = await CategoryModel.findOne({
      slug,
    });

    if (existing) {
      return NextResponse.json(
        { error: "A category with this slug already exists" },
        { status: 400 },
      );
    }

    // Calculate level and path based on parent
    let level = 0;
    let path: string[] = [];

    if (parent_id) {
      const parent = await CategoryModel.findOne({
        category_id: parent_id,
        // No wholesaler_id - database provides isolation
      });

      if (!parent) {
        return NextResponse.json(
          { error: "Parent category not found" },
          { status: 404 },
        );
      }

      level = parent.level + 1;
      path = [...parent.path, parent.category_id];
    }

    const category = await CategoryModel.create({
      category_id: nanoid(12),
      external_code: external_code?.trim() || undefined,
      name,
      slug,
      description,
      parent_id,
      level,
      path,
      hero_image,
      mobile_hero_image,
      item_icon,
      seo: seo || {},
      display_order: display_order || 0,
      is_active: true,
      product_count: 0,
      // Only set channel_code on root categories
      ...(!parent_id && channel_code ? { channel_code } : {}),
    });

    // Invalidate B2C category cache
    invalidateCategoryCache(tenantDb).catch(() => {});

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
