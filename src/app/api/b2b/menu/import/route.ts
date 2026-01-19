import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { nanoid } from "nanoid";

interface ExternalMenuItem {
  name: string;
  label: string;
  title?: string | null;
  url: string;
  description?: string | null;
  order: number;
  parent_menu?: string | null;
  lft: number;
  rgt: number;
  is_group: number;
  category_menu_image?: string | null;
  category_banner_image?: string | null;
  category_banner_image_mobile?: string | null;
  disable: number;
}

interface ExternalAPIResponse {
  message: ExternalMenuItem[];
}

/**
 * POST /api/b2b/menu/import
 * Import menu from external API
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { MenuItem: MenuItemModel } = await connectWithModels(tenantDb);

    const body = await req.json();
    const {
      location,
      externalUrl,
      clearExisting = false
    } = body;

    // Validate
    if (!location) {
      return NextResponse.json(
        { error: "Location is required" },
        { status: 400 }
      );
    }

    if (!externalUrl) {
      return NextResponse.json(
        { error: "External URL is required" },
        { status: 400 }
      );
    }

    // Fetch external menu data
    let externalData: ExternalAPIResponse;
    try {
      const response = await fetch(externalUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      externalData = await response.json();
    } catch (error) {
      console.error("Error fetching external menu:", error);
      return NextResponse.json(
        { error: "Failed to fetch external menu data" },
        { status: 500 }
      );
    }

    if (!externalData.message || !Array.isArray(externalData.message)) {
      return NextResponse.json(
        { error: "Invalid external menu data format" },
        { status: 400 }
      );
    }

    // Clear existing menu items if requested
    if (clearExisting) {
      await MenuItemModel.deleteMany({
        location,
        // No wholesaler_id - database provides isolation
      });
    }

    // Build hierarchy map
    const externalItems = externalData.message;
    const itemMap = new Map<string, ExternalMenuItem>();
    const childrenMap = new Map<string, ExternalMenuItem[]>();

    // First pass: build maps
    for (const item of externalItems) {
      itemMap.set(item.name, item);

      const parentKey = item.parent_menu || "root";
      if (!childrenMap.has(parentKey)) {
        childrenMap.set(parentKey, []);
      }
      childrenMap.get(parentKey)!.push(item);
    }

    // Sort children by order
    for (const [_, children] of childrenMap) {
      children.sort((a, b) => a.order - b.order);
    }

    // Track imported items for statistics
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Recursive function to import items
    const importItem = async (
      externalItem: ExternalMenuItem,
      parentId: string | null,
      level: number,
      path: string[],
      position: number
    ): Promise<string | null> => {
      try {
        // Check if item already exists (by external name)
        const existing = await MenuItemModel.findOne({
          location,
          type: "category",
          reference_id: externalItem.name,
          // No wholesaler_id - database provides isolation
        });

        let menuItemId: string;

        if (existing) {
          // Update existing item
          existing.label = externalItem.label || externalItem.title || undefined;
          existing.url = externalItem.url || undefined;
          existing.icon = externalItem.category_menu_image || undefined;
          existing.rich_text = externalItem.description || undefined;
          existing.image_url = externalItem.category_banner_image || undefined;
          existing.mobile_image_url = externalItem.category_banner_image_mobile || undefined;
          existing.parent_id = parentId || undefined;
          existing.level = level;
          existing.path = path;
          existing.position = position;
          existing.is_active = externalItem.disable === 0;
          existing.include_children = externalItem.is_group === 1;

          await existing.save();
          menuItemId = existing.menu_item_id;
          skipped++;
        } else {
          // Create new item - no wholesaler_id, database provides isolation
          const newItem = await MenuItemModel.create({
            menu_item_id: nanoid(12),
            location,
            type: "category", // External items are categories
            reference_id: externalItem.name, // Store external ID as reference
            label: externalItem.label || externalItem.title || undefined,
            url: externalItem.url || undefined,
            icon: externalItem.category_menu_image || undefined,
            rich_text: externalItem.description || undefined,
            image_url: externalItem.category_banner_image || undefined,
            mobile_image_url: externalItem.category_banner_image_mobile || undefined,
            parent_id: parentId || undefined,
            level,
            path,
            position,
            is_active: externalItem.disable === 0,
            include_children: externalItem.is_group === 1,
            max_depth: undefined,
            open_in_new_tab: false,
            css_class: undefined,
          });

          menuItemId = newItem.menu_item_id;
          imported++;
        }

        // Import children recursively
        const children = childrenMap.get(externalItem.name) || [];
        for (let i = 0; i < children.length; i++) {
          await importItem(
            children[i],
            menuItemId,
            level + 1,
            [...path, menuItemId],
            i
          );
        }

        return menuItemId;
      } catch (error) {
        console.error(`Error importing item ${externalItem.name}:`, error);
        errors.push(`${externalItem.label}: ${error instanceof Error ? error.message : "Unknown error"}`);
        return null;
      }
    };

    // Start importing from root items
    const rootItems = childrenMap.get("root") || [];
    for (let i = 0; i < rootItems.length; i++) {
      await importItem(rootItems[i], null, 0, [], i);
    }

    return NextResponse.json({
      success: true,
      stats: {
        total: externalItems.length,
        imported,
        updated: skipped,
        errors: errors.length,
      },
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (error) {
    console.error("Error importing menu:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
