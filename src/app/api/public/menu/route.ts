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

    // Build query - only active items with valid time bounds
    const now = new Date();
    const query: any = {
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
          url: item.url,
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