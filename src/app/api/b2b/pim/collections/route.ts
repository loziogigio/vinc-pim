import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { nanoid } from "nanoid";
import {
  getEnabledLocaleCodes,
  buildMultilangSearchOr,
} from "@/lib/search/multilang-search";

/**
 * GET /api/b2b/pim/collections
 * Get all collections
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();

    if (!session.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const {
      Collection: CollectionModel,
      PIMProduct: PIMProductModel,
      Language: LanguageModel,
    } = await connectWithModels(tenantDb);

    const searchParams = req.nextUrl.searchParams;
    const includeInactive = searchParams.get("include_inactive") === "true";
    const search = searchParams.get("search")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(
      200,
      Math.max(1, parseInt(searchParams.get("limit") || "100") || 100),
    );

    // Build query - no wholesaler_id, database provides isolation
    const query: any = {};

    if (!includeInactive) {
      query.is_active = true;
    }

    // Server-side search across the name + slug.
    if (search) {
      const codes = await getEnabledLocaleCodes(LanguageModel);
      query.$or = buildMultilangSearchOr(search, codes, {
        plainFields: ["name", "slug"],
      });
    }

    const [collections, total] = await Promise.all([
      CollectionModel.find(query)
        .sort({ display_order: 1, name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CollectionModel.countDocuments(query),
    ]);

    // Update product counts for each collection
    const collectionIds = collections.map((c) => c.collection_id);
    const productCounts = collectionIds.length
      ? await PIMProductModel.aggregate([
          {
            $match: {
              // No wholesaler_id - database provides isolation
              isCurrent: true,
              "collections.collection_id": { $in: collectionIds },
            },
          },
          { $unwind: "$collections" },
          {
            $match: {
              "collections.collection_id": { $in: collectionIds },
            },
          },
          {
            $group: {
              _id: "$collections.collection_id",
              count: { $sum: 1 },
            },
          },
        ])
      : [];

    const countMap = new Map(productCounts.map((c) => [c._id, c.count]));

    const collectionsWithCounts = collections.map((col) => ({
      ...col,
      product_count: countMap.get(col.collection_id) || 0,
    }));

    return NextResponse.json({
      collections: collectionsWithCounts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching collections:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/b2b/pim/collections
 * Create a new collection
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { Collection: CollectionModel } = await connectWithModels(tenantDb);

    const body = await req.json();
    const {
      name,
      slug,
      locale,
      description,
      hero_image,
      mobile_hero_image,
      seo,
      display_order,
    } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 },
      );
    }

    // Check if slug already exists (no wholesaler_id - database provides isolation)
    const existing = await CollectionModel.findOne({
      slug,
    });

    if (existing) {
      return NextResponse.json(
        { error: "A collection with this slug already exists" },
        { status: 400 },
      );
    }

    const collection = await CollectionModel.create({
      collection_id: nanoid(12),
      // No wholesaler_id - database provides isolation
      name,
      slug,
      locale: locale || "it",
      description,
      hero_image,
      mobile_hero_image,
      seo: seo || {},
      display_order: display_order || 0,
      is_active: true,
      product_count: 0,
    });

    return NextResponse.json({ collection }, { status: 201 });
  } catch (error) {
    console.error("Error creating collection:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
