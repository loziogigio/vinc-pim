import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { PIMProductModel } from "@/lib/db/models/pim-product";

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
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { entity_code } = await params;
    const { cdn_key, label } = await req.json();

    if (!cdn_key || typeof label !== "string") {
      return NextResponse.json(
        { error: "cdn_key and label are required" },
        { status: 400 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Get current product
    const product = await PIMProductModel.findOne({
      entity_code,
      // No wholesaler_id - database provides isolation
      isCurrent: true,
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Find and update the media item
    const media = product.media || [];
    const mediaIndex = media.findIndex((m: any) => m.cdn_key === cdn_key);

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
      cdn_key,
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
