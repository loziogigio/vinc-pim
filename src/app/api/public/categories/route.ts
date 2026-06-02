import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";

/**
 * GET /api/public/categories
 * Public endpoint to get the active category tree for storefront rendering.
 * No authentication required (tenant resolved via x-resolved-tenant-db header).
 *
 * Query params:
 * - channel: filter to categories belonging to a channel (matches root
 *   categories with channel_code and all of their descendants via path)
 * - include_inactive=true: include is_active=false categories (default false)
 *
 * Response: { success, categories: <tree>, flat: <list> }
 */
export async function GET(req: NextRequest) {
  try {
    const tenantDb = req.headers.get("x-resolved-tenant-db");
    if (!tenantDb) {
      return NextResponse.json(
        { error: "Tenant not resolved" },
        { status: 400 }
      );
    }

    const { Category: CategoryModel } = await connectWithModels(tenantDb);

    const { searchParams } = new URL(req.url);
    const channel = searchParams.get("channel");
    const includeInactive = searchParams.get("include_inactive") === "true";

    const query: any = {};
    if (!includeInactive) query.is_active = true;

    // Channel filter: find roots with matching channel_code, then include
    // their descendants (whose path[] contains a matching root id).
    if (channel) {
      const rootsWithChannel = await CategoryModel.find({
        channel_code: channel,
        $or: [{ parent_id: null }, { parent_id: { $exists: false } }],
      })
        .select("category_id")
        .lean();

      const rootIds = rootsWithChannel.map((r: any) => r.category_id);

      if (rootIds.length === 0) {
        return NextResponse.json({
          success: true,
          categories: [],
          flat: [],
        });
      }

      query.$or = [
        { category_id: { $in: rootIds } },
        { path: { $in: rootIds } },
      ];
    }

    const categories = await CategoryModel.find(query)
      .sort({ display_order: 1, name: 1 })
      .lean();

    // Shape each node for public consumption (drop SEO internals, mongoose
    // metadata, etc.). `children: []` is filled in by buildTree below.
    const shape = (c: any) => ({
      category_id: c.category_id,
      // ERP group code (e.g. "01A17") used to filter products by erp_group.
      external_code: c.external_code ?? null,
      name: c.name,
      slug: c.slug,
      description: c.description ?? null,
      parent_id: c.parent_id ?? null,
      level: c.level ?? 0,
      path: Array.isArray(c.path) ? c.path : [],
      // `item_icon` is the small square shown on category cards / menu rows;
      // `hero_image` is the wide banner shown at the top of a category page.
      item_icon: c.item_icon ?? null,
      hero_image: c.hero_image ?? null,
      mobile_hero_image: c.mobile_hero_image ?? null,
      display_order: c.display_order ?? 0,
      channel_code: c.channel_code ?? null,
      product_count: c.product_count ?? 0,
      children: [] as any[],
    });

    const flat = categories.map(shape);
    const byId = new Map(flat.map((n) => [n.category_id, n]));
    const tree: any[] = [];
    for (const node of flat) {
      const parent = node.parent_id ? byId.get(node.parent_id) : undefined;
      if (parent) {
        parent.children.push(node);
      } else {
        tree.push(node);
      }
    }

    return NextResponse.json({
      success: true,
      categories: tree,
      flat,
    });
  } catch (error) {
    console.error("Error fetching public categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
