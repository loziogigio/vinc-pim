import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { MenuItemModel } from "@/lib/db/models/menu";

/**
 * GET /api/b2b/menu/[id]
 * Get a single menu item
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { id } = await params;

    const menuItem = await MenuItemModel.findOne({
      menu_item_id: id,
      // No wholesaler_id - database provides isolation
    }).lean();

    if (!menuItem) {
      return NextResponse.json(
        { error: "Menu item not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ menuItem });
  } catch (error) {
    console.error("Error fetching menu item:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/b2b/menu/[id]
 * Update a menu item
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { id } = await params;
    const body = await req.json();

    // Check if menu item exists
    const menuItem = await MenuItemModel.findOne({
      menu_item_id: id,
      // No wholesaler_id - database provides isolation
    });

    if (!menuItem) {
      return NextResponse.json(
        { error: "Menu item not found" },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {
      updated_at: new Date(),
    };

    // Allow updating these fields
    const allowedFields = [
      "label",
      "url",
      "icon",
      "image_url",
      "mobile_image_url",
      "rich_text",
      "include_children",
      "max_depth",
      "position",
      "is_active",
      "start_date",
      "end_date",
      "open_in_new_tab",
      "css_class",
    ];

    // Optional string fields that should be cleared (set to null) when empty
    const clearableFields = ["label", "url", "icon", "image_url", "mobile_image_url", "rich_text", "css_class"];

    allowedFields.forEach((field) => {
      if (body[field] !== undefined) {
        if (field === "start_date" || field === "end_date") {
          updateData[field] = body[field] ? new Date(body[field]) : null;
        } else if (clearableFields.includes(field)) {
          // Convert empty string to null for optional string fields
          updateData[field] = body[field] || null;
        } else {
          updateData[field] = body[field];
        }
      }
    });

    // Handle parent change (moving in hierarchy)
    if (body.parent_id !== undefined && body.parent_id !== menuItem.parent_id) {
      if (body.parent_id) {
        const newParent = await MenuItemModel.findOne({
          menu_item_id: body.parent_id,
          // No wholesaler_id - database provides isolation
        });

        if (!newParent) {
          return NextResponse.json(
            { error: "Parent menu item not found" },
            { status: 404 }
          );
        }

        // Prevent circular reference
        if (newParent.path.includes(id)) {
          return NextResponse.json(
            { error: "Cannot move item to its own descendant" },
            { status: 400 }
          );
        }

        updateData.parent_id = body.parent_id;
        updateData.level = newParent.level + 1;
        updateData.path = [...newParent.path, newParent.menu_item_id];
      } else {
        // Moving to root
        updateData.parent_id = null;
        updateData.level = 0;
        updateData.path = [];
      }

      // Update all descendants' paths
      const descendants = await MenuItemModel.find({
        path: id,
        // No wholesaler_id - database provides isolation
      });

      for (const desc of descendants) {
        const oldPathIndex = desc.path.indexOf(id);
        const newPath = [
          ...(updateData.path || []),
          id,
          ...desc.path.slice(oldPathIndex + 1),
        ];

        await MenuItemModel.updateOne(
          { _id: desc._id },
          {
            $set: {
              path: newPath,
              level: newPath.length,
            },
          }
        );
      }
    }

    // Update menu item
    const updatedMenuItem = await MenuItemModel.findOneAndUpdate(
      { menu_item_id: id },
      updateData,
      { new: true }
    );

    return NextResponse.json({ menuItem: updatedMenuItem });
  } catch (error) {
    console.error("Error updating menu item:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/b2b/menu/[id]
 * Delete a menu item (and optionally its children)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const deleteChildren = searchParams.get("delete_children") === "true";

    // Check if menu item exists
    const menuItem = await MenuItemModel.findOne({
      menu_item_id: id,
      // No wholesaler_id - database provides isolation
    });

    if (!menuItem) {
      return NextResponse.json(
        { error: "Menu item not found" },
        { status: 404 }
      );
    }

    // Check if it has children
    const childrenCount = await MenuItemModel.countDocuments({
      parent_id: id,
      // No wholesaler_id - database provides isolation
    });

    if (childrenCount > 0 && !deleteChildren) {
      return NextResponse.json(
        {
          error: `Cannot delete menu item with ${childrenCount} children. Use delete_children=true to delete recursively.`,
        },
        { status: 400 }
      );
    }

    if (deleteChildren) {
      // Delete all descendants
      await MenuItemModel.deleteMany({
        path: id,
        // No wholesaler_id - database provides isolation
      });
    }

    // Delete the item
    await MenuItemModel.deleteOne({
      menu_item_id: id,
      // No wholesaler_id - database provides isolation
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting menu item:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
