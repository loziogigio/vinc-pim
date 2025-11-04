import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { PIMProductModel } from "@/lib/db/models/pim-product";

/**
 * POST /api/b2b/pim/products/[entity_code]/rollback
 * Rollback to a previous version by creating a new version with old data
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entity_code: string }> }
) {
  try {
    // Auth check
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { entity_code } = await params;
    const { target_version } = await req.json();

    if (!target_version || typeof target_version !== "number") {
      return NextResponse.json(
        { error: "target_version is required and must be a number" },
        { status: 400 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Get the current version
    const currentProduct = await PIMProductModel.findOne({
      entity_code,
      wholesaler_id: session.userId,
      isCurrent: true,
    });

    if (!currentProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Get the target version to rollback to
    const targetProduct = await PIMProductModel.findOne({
      entity_code,
      wholesaler_id: session.userId,
      version: target_version,
    }).lean();

    if (!targetProduct) {
      return NextResponse.json(
        { error: `Version ${target_version} not found` },
        { status: 404 }
      );
    }

    if (currentProduct.version === target_version) {
      return NextResponse.json(
        { error: "Cannot rollback to the current version" },
        { status: 400 }
      );
    }

    // Mark current version as not current
    await PIMProductModel.updateOne(
      { _id: currentProduct._id },
      { $set: { isCurrent: false } }
    );

    // Create new version with data from target version
    const newVersion = currentProduct.version + 1;
    const { _id, version, isCurrent, isCurrentPublished, created_at, updated_at, ...targetData } =
      targetProduct as any;

    const newProduct = await PIMProductModel.create({
      ...targetData,
      version: newVersion,
      isCurrent: true,
      isCurrentPublished: false,
      status: "draft",
      manually_edited: true,
      edited_by: session.email || session.userId,
      edited_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
      // Reset conflict data on rollback
      has_conflict: false,
      conflict_data: [],
    });

    return NextResponse.json({
      success: true,
      message: `Rolled back to version ${target_version}`,
      new_version: newVersion,
      previous_version: currentProduct.version,
      rolled_back_to: target_version,
      product: {
        _id: newProduct._id,
        entity_code: newProduct.entity_code,
        version: newProduct.version,
        name: newProduct.name,
        sku: newProduct.sku,
      },
    });
  } catch (error) {
    console.error("Error rolling back version:", error);
    return NextResponse.json(
      {
        error: "Failed to rollback version",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
