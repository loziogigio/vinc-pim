import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";

/**
 * PATCH /api/b2b/pim/products/[entity_code]/media/label
 * Update the label of a media file
 */
export async function PATCH(
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
    const { cdn_key, media_id, label } = await req.json();

    // Support both cdn_key (legacy) and media_id (new)
    const mediaIdentifier = media_id || cdn_key;

    if (!mediaIdentifier || typeof label !== "string") {
      return NextResponse.json(
        { error: "media_id (or cdn_key) and label are required" },
        { status: 400 }
      );
    }

    // Connect to tenant database
    const tenantDb = `vinc-${session.tenantId}`;
    const { PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

    // Get current product
    const product = await PIMProductModel.findOne({
      entity_code,
      // No wholesaler_id - database provides isolation
      isCurrent: true,
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Find and update the media item by _id (primary) or cdn_key (fallback)
    const media = product.media || [];
    const mediaIndex = media.findIndex((m: any) =>
      m._id?.toString() === mediaIdentifier || m.cdn_key === mediaIdentifier
    );

    if (mediaIndex === -1) {
      return NextResponse.json({ error: "Media file not found" }, { status: 404 });
    }

    // Update the label
    media[mediaIndex].label = label.trim();

    // Save and return updated product
    const updatedProduct = await PIMProductModel.findOneAndUpdate(
      {
        _id: product._id,
      },
      {
        $set: {
          media,
          updated_at: new Date(),
          last_updated_by: "manual",
        },
      },
      { new: true }
    ).lean();

    return NextResponse.json({
      success: true,
      message: "Label updated successfully",
      media_id: mediaIdentifier,
      label: label.trim(),
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Error updating media label:", error);
    return NextResponse.json(
      {
        error: "Failed to update media label",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
