import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";

/**
 * PATCH /api/b2b/pim/features/[featureId]
 * Update a technical feature
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ featureId: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { Feature } = await connectWithModels(tenantDb);

    const { featureId } = await params;
    const body = await req.json();
    const { key, label, type, unit, options, default_required, display_order, is_active } = body;

    // Check if feature exists and belongs to wholesaler
    const feature = await Feature.findOne({
      feature_id: featureId,
      // No wholesaler_id - database provides isolation
    });

    if (!feature) {
      return NextResponse.json(
        { error: "Feature not found" },
        { status: 404 }
      );
    }

    // If key is changing, check for duplicates
    if (key && key !== feature.key) {
      const existing = await Feature.findOne({
        // No wholesaler_id - database provides isolation
        key,
        feature_id: { $ne: featureId },
      });

      if (existing) {
        return NextResponse.json(
          { error: "A feature with this key already exists" },
          { status: 400 }
        );
      }
    }

    // Update feature
    const updateData: any = {
      updated_at: new Date(),
    };

    if (key !== undefined) updateData.key = key;
    if (label !== undefined) updateData.label = label;
    if (type !== undefined) updateData.type = type;
    if (unit !== undefined) updateData.unit = unit;
    if (options !== undefined) updateData.options = options;
    if (default_required !== undefined) updateData.default_required = default_required;
    if (display_order !== undefined) updateData.display_order = display_order;
    if (is_active !== undefined) updateData.is_active = is_active;

    // No wholesaler_id - database provides isolation
    const updatedFeature = await Feature.findOneAndUpdate(
      { feature_id: featureId },
      updateData,
      { new: true }
    );

    return NextResponse.json({ feature: updatedFeature });
  } catch (error) {
    console.error("Error updating feature:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/b2b/pim/features/[featureId]
 * Delete a technical feature
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ featureId: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { Feature, ProductType } = await connectWithModels(tenantDb);

    const { featureId } = await params;

    // Check if feature exists and belongs to wholesaler
    const feature = await Feature.findOne({
      feature_id: featureId,
      // No wholesaler_id - database provides isolation
    });

    if (!feature) {
      return NextResponse.json(
        { error: "Feature not found" },
        { status: 404 }
      );
    }

    // Check if feature is being used by any product types
    const productTypesUsingFeature = await ProductType.countDocuments({
      // No wholesaler_id - database provides isolation
      "features.feature_id": featureId,
    });

    if (productTypesUsingFeature > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete feature used in ${productTypesUsingFeature} product type(s). Please remove it from product types first.`,
        },
        { status: 400 }
      );
    }

    // Delete feature
    await Feature.deleteOne({
      feature_id: featureId,
      // No wholesaler_id - database provides isolation
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting feature:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
