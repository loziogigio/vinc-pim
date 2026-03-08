import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { invalidateCategoryCache } from "@/lib/services/category.service";

/**
 * POST /api/b2b/pim/categories/reorder
 * Update display_order for multiple categories
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb } = auth;
    const { Category: CategoryModel } = await connectWithModels(tenantDb);

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

    // Invalidate B2C category cache
    invalidateCategoryCache(tenantDb).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error reordering categories:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
