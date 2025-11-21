import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { MenuItemModel, MenuLocation } from "@/lib/db/models/menu";
import { nanoid } from "nanoid";

/**
 * GET /api/b2b/menu
 * Get all menu items for a specific location
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const location = searchParams.get("location") as MenuLocation | null;
    const includeInactive = searchParams.get("include_inactive") === "true";

    // Build query - no wholesaler_id needed, database provides isolation
    const query: any = {};

    if (location) {
      query.location = location;
    }

    if (!includeInactive) {
      query.is_active = true;

      // Check time-bound visibility
      const now = new Date();
      query.$or = [
        { start_date: { $exists: false }, end_date: { $exists: false } },
        { start_date: { $lte: now }, end_date: { $exists: false } },
        { start_date: { $exists: false }, end_date: { $gte: now } },
        { start_date: { $lte: now }, end_date: { $gte: now } },
      ];
    }

    const menuItems = await MenuItemModel.find(query)
      .sort({ parent_id: 1, position: 1 })
      .lean();

    return NextResponse.json({ menuItems });
  } catch (error) {
    console.error("Error fetching menu items:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/b2b/menu
 * Create a new menu item
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await req.json();
    const {
      location,
      type,
      reference_id,
      label,
      url,
      icon,
      parent_id,
      include_children = false,
      max_depth,
      is_active = true,
      start_date,
      end_date,
      open_in_new_tab = false,
      css_class,
    } = body;

    // Validate required fields
    if (!location || !type) {
      return NextResponse.json(
        { error: "Location and type are required" },
        { status: 400 }
      );
    }

    // Type-specific validation
    if (type === "url" && !url) {
      return NextResponse.json(
        { error: "URL is required for type 'url'" },
        { status: 400 }
      );
    }

    if (type !== "url" && type !== "divider" && !reference_id) {
      return NextResponse.json(
        { error: `reference_id is required for type '${type}'` },
        { status: 400 }
      );
    }

    // Calculate level and path
    let level = 0;
    let path: string[] = [];

    if (parent_id) {
      const parent = await MenuItemModel.findOne({
        menu_item_id: parent_id,
        // No wholesaler_id - database provides isolation
      });

      if (!parent) {
        return NextResponse.json(
          { error: "Parent menu item not found" },
          { status: 404 }
        );
      }

      level = parent.level + 1;
      path = [...parent.path, parent.menu_item_id];
    }

    // Get next position
    const lastItem = await MenuItemModel.findOne({
      location,
      parent_id: parent_id || null,
    })
      .sort({ position: -1 })
      .lean();

    const position = lastItem ? lastItem.position + 1 : 0;

    // Create menu item - no wholesaler_id, database provides isolation
    const menuItem = await MenuItemModel.create({
      menu_item_id: nanoid(12),
      location,
      type,
      reference_id,
      label,
      url,
      icon,
      parent_id,
      level,
      path,
      include_children,
      max_depth,
      position,
      is_active,
      start_date: start_date ? new Date(start_date) : undefined,
      end_date: end_date ? new Date(end_date) : undefined,
      open_in_new_tab,
      css_class,
    });

    return NextResponse.json({ menuItem }, { status: 201 });
  } catch (error) {
    console.error("Error creating menu item:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
