import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { CategoryModel } from "@/lib/db/models/category";

/**
 * POST /api/b2b/pim/categories/reorder
 * Update display_order for multiple categories
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { updates } = await req.json();

    if (!Array.isArray(updates)) {
      return NextResponse.json(
        { error: "Invalid updates format" },
        { status: 400 }
      );
    }

    // Update each category's display_order (no wholesaler_id - database provides isolation)
    const updatePromises = updates.map(
      async ({ category_id, display_order }: { category_id: string; display_order: number }) => {
        return CategoryModel.findOneAndUpdate(
          {
            category_id,
            // No wholesaler_id - database provides isolation
          },
          {
            display_order,
            updated_at: new Date(),
          }
        );
      }
    );

    await Promise.all(updatePromises);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error reordering categories:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
