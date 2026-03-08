import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { MenuLocation } from "@/lib/db/models/menu";

/**
 * GET /api/public/menu
 * Public endpoint to get menu items for storefront rendering
 * No authentication required
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

    const { MenuItem: MenuItemModel } = await connectWithModels(tenantDb);

    const { searchParams } = new URL(req.url);
    const location = searchParams.get("location") as MenuLocation | null;
    const channel = searchParams.get("channel") || "default";

    // Build query - only active items with valid time bounds
    const now = new Date();
    const query: any = {
      channel,
      is_active: true,
      $or: [
        { start_date: { $exists: false }, end_date: { $exists: false } },
        { start_date: null, end_date: null },
        { start_date: { $lte: now }, end_date: { $exists: false } },
        { start_date: { $lte: now }, end_date: null },
        { start_date: { $exists: false }, end_date: { $gte: now } },
        { start_date: null, end_date: { $gte: now } },
        { start_date: { $lte: now }, end_date: { $gte: now } },
      ],
    };

    if (location) {
      query.location = location;
    }

    const menuItems = await MenuItemModel.find(query)
      .sort({ parent_id: 1, position: 1 })
      .lean();

    // Resolve URLs for entity-based types that only store reference_id
    // Bulk-fetch product slugs for "product" type items
    const productItems = menuItems.filter((i: any) => i.type === "product" && i.reference_id);
    const productSlugs: Record<string, string> = {};
    if (productItems.length > 0) {
      const { PIMProduct } = await connectWithModels(tenantDb);
      const productIds = productItems.map((i: any) => i.reference_id);
      const products = await PIMProduct.find(
        { product_id: { $in: productIds } },
        { product_id: 1, slug: 1 }
      ).lean();
      for (const p of products) {
        if (p.slug) productSlugs[p.product_id] = p.slug;
      }
    }

    /**
     * Resolve a menu item's URL based on its type.
     * Entity types store only reference_id — we convert them to
     * storefront-friendly URLs here so frontends don't need to.
     */
    function resolveUrl(item: any): string | undefined {
      // If there's already a proper URL, use it (url/page types, or product_type with pre-built URL)
      if (item.url) {
        const url = item.url;
        // Already a proper path or external link
        if (url.startsWith("/") || url.startsWith("http")) return url;
        // Advanced query format like "shop?text=x&filters-brand_id=y"
        if (url.includes("?")) return `/${url}`;
        // For "search" type, raw keyword → search URL
        if (item.type === "search") return `/search?text=${encodeURIComponent(url)}`;
        // Anything else with a URL — prefix with /
        return `/${url}`;
      }

      // Entity-based types → build filter URL from reference_id
      const ref = item.reference_id;
      if (!ref) return undefined;

      switch (item.type) {
        case "category":
          return `/search?filters-category_id=${encodeURIComponent(ref)}`;
        case "brand":
          return `/search?filters-brand_id=${encodeURIComponent(ref)}`;
        case "collection":
          return `/search?filters-collection_id=${encodeURIComponent(ref)}`;
        case "tag":
          return `/search?filters-tag_id=${encodeURIComponent(ref)}`;
        case "product_type":
          return `/search?filters-product_type_id=${encodeURIComponent(ref)}`;
        case "product":
          return productSlugs[ref] ? `/product/${productSlugs[ref]}` : `/product/${ref}`;
        default:
          return undefined;
      }
    }

    // Build hierarchical tree structure for easier frontend consumption
    const buildTree = (items: any[], parentId: string | null | undefined = null): any[] => {
      return items
        .filter((item) => {
          // Root items: no parent_id, null, undefined, or empty string
          if (parentId === null) {
            return !item.parent_id;
          }
          return item.parent_id === parentId;
        })
        .map((item) => ({
          id: item.menu_item_id,
          type: item.type,
          label: item.label,
          reference_id: item.reference_id,
          url: resolveUrl(item),
          icon: item.icon,
          rich_text: item.rich_text,
          image_url: item.image_url,
          mobile_image_url: item.mobile_image_url,
          include_children: item.include_children,
          max_depth: item.max_depth,
          open_in_new_tab: item.open_in_new_tab,
          css_class: item.css_class,
          level: item.level,
          children: buildTree(items, item.menu_item_id),
        }));
    };

    const tree = buildTree(menuItems);

    return NextResponse.json({
      success: true,
      menuItems: tree,
      flat: menuItems, // Also include flat list for flexibility
    });
  } catch (error) {
    console.error("Error fetching public menu:", error);
    return NextResponse.json(
      { error: "Failed to fetch menu" },
      { status: 500 }
    );
  }
}