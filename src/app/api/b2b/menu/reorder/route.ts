import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { invalidateB2CCache } from "@/lib/cache/redis-client";

/**
 * POST /api/b2b/menu/reorder
 * Batch update menu item positions (for drag-and-drop)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb } = auth;
    const { MenuItem: MenuItemModel } = await connectWithModels(tenantDb);

    const body = await req.json();
    const { items } = body;

    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: "items array is required" },
        { status: 400 }
      );
    }

    // Validate all items exist
    const itemIds = items.map((item) => item.menu_item_id);
    const existingItems = await MenuItemModel.find({
      menu_item_id: { $in: itemIds },
      // No wholesaler_id - database provides isolation
    });

    if (existingItems.length !== items.length) {
      return NextResponse.json(
        { error: "Some menu items not found or unauthorized" },
        { status: 404 }
      );
    }

    // Update positions in bulk
    const bulkOps = items.map((item: any) => ({
      updateOne: {
        filter: {
          menu_item_id: item.menu_item_id,
          // No wholesaler_id - database provides isolation
        },
        update: {
          $set: {
            position: item.position,
            parent_id: item.parent_id || null,
            updated_at: new Date(),
          },
        },
      },
    }));

    await MenuItemModel.bulkWrite(bulkOps);

    // Recalculate levels and paths if parents changed
    for (const item of items) {
      if (item.parent_id) {
        const parent = await MenuItemModel.findOne({
          menu_item_id: item.parent_id,
          // No wholesaler_id - database provides isolation
        });

        if (parent) {
          await MenuItemModel.updateOne(
            {
              menu_item_id: item.menu_item_id,
              // No wholesaler_id - database provides isolation
            },
            {
              $set: {
                level: parent.level + 1,
                path: [...parent.path, parent.menu_item_id],
              },
            }
          );
        }
      } else {
        // Root level
        await MenuItemModel.updateOne(
          {
            menu_item_id: item.menu_item_id,
            // No wholesaler_id - database provides isolation
          },
          {
            $set: {
              level: 0,
              path: [],
            },
          }
        );
      }
    }

    // Invalidate B2C menu cache
    invalidateB2CCache(tenantDb, "menu").catch(() => {});

    return NextResponse.json({
      success: true,
      updated: items.length,
    });
  } catch (error) {
    console.error("Error reordering menu items:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
