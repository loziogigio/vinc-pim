import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";

/**
 * POST /api/b2b/pim/products/[entity_code]/resolve-conflicts
 * Resolve conflicts by applying chosen values
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entity_code: string }> }
) {
  try {
    // Auth check
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { entity_code } = await params;
    const { resolutions } = await req.json();

    if (!resolutions || typeof resolutions !== "object") {
      return NextResponse.json(
        { error: "Invalid resolutions data" },
        { status: 400 }
      );
    }

    // Connect to database
    const tenantDb = `vinc-${session.tenantId}`;
    const { PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

    // Find current product version
    const product = await PIMProductModel.findOne({
      entity_code,
      // No wholesaler_id - database provides isolation
      isCurrent: true,
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    if (!product.has_conflict || !product.conflict_data || product.conflict_data.length === 0) {
      return NextResponse.json(
        { error: "No conflicts to resolve" },
        { status: 400 }
      );
    }

    // Apply resolutions
    const updates: any = {};
    const resolvedFields: string[] = [];

    for (const conflict of product.conflict_data) {
      const choice = resolutions[conflict.field];

      if (!choice || (choice !== "manual" && choice !== "api")) {
        continue; // Skip if no resolution provided
      }

      const value = choice === "manual" ? conflict.manual_value : conflict.api_value;
      updates[conflict.field] = value;
      resolvedFields.push(conflict.field);
    }

    // Remove resolved conflicts from conflict_data
    const remainingConflicts = product.conflict_data.filter(
      (c: any) => !resolvedFields.includes(c.field)
    );

    // Update the product
    await PIMProductModel.findByIdAndUpdate(product._id, {
      $set: {
        ...updates,
        conflict_data: remainingConflicts,
        has_conflict: remainingConflicts.length > 0,
        updated_at: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      resolved_fields: resolvedFields,
      remaining_conflicts: remainingConflicts.length,
    });
  } catch (error) {
    console.error("Error resolving conflicts:", error);
    return NextResponse.json(
      {
        error: "Failed to resolve conflicts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
