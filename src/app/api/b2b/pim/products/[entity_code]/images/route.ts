import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { PIMProductModel } from "@/lib/db/models/pim-product";
import { uploadMultipleImages } from "@/lib/cdn/image-upload";

/**
 * POST /api/b2b/pim/products/[entity_code]/images
 * Upload images for a product
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entity_code: string }> }
) {
  try {
    // Check authentication
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const { entity_code } = resolvedParams;

    // Parse form data
    const formData = await req.formData();
    const files = formData.getAll("images") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No images provided" },
        { status: 400 }
      );
    }

    // Upload images to CDN
    const uploadResults = await uploadMultipleImages(
      files,
      `products/${entity_code}`
    );

    if (uploadResults.failed.length > 0 && uploadResults.successful.length === 0) {
      return NextResponse.json(
        {
          error: "All image uploads failed",
          failures: uploadResults.failed,
        },
        { status: 400 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Find the product
    const product = await PIMProductModel.findOne({
      entity_code,
      wholesaler_id: session.userId,
      isCurrent: true,
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // Get current max position
    const currentImages = product.images || [];
    const maxPosition =
      currentImages.length > 0
        ? Math.max(...currentImages.map((img: any) => img.position || 0))
        : -1;

    // Prepare new images with positions
    const newImages = uploadResults.successful.map((result, index) => ({
      url: result.url,
      cdn_key: result.cdn_key,
      position: maxPosition + index + 1,
      uploaded_at: new Date(),
      uploaded_by: session.userId,
      file_name: result.file_name,
      file_type: result.file_type,
      size_bytes: result.size_bytes,
    }));

    // Update product with new images
    const updatedProduct = await PIMProductModel.findOneAndUpdate(
      {
        entity_code,
        wholesaler_id: session.userId,
        isCurrent: true,
      },
      {
        $push: { images: { $each: newImages } },
        $set: {
          updated_at: new Date(),
          last_updated_by: "manual",
        },
      },
      { new: true }
    ).lean();

    return NextResponse.json({
      success: true,
      message: `${uploadResults.successful.length} image(s) uploaded successfully`,
      uploaded: uploadResults.successful.length,
      failed: uploadResults.failed.length,
      failures: uploadResults.failed,
      images: newImages,
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Error uploading images:", error);
    return NextResponse.json(
      {
        error: "Failed to upload images",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/b2b/pim/products/[entity_code]/images?cdn_key=...
 * Delete a specific image from a product
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ entity_code: string }> }
) {
  try {
    // Check authentication
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const { entity_code } = resolvedParams;

    // Get image CDN key from query params
    const { searchParams } = new URL(req.url);
    const cdn_key = searchParams.get("cdn_key");

    if (!cdn_key) {
      return NextResponse.json(
        { error: "Missing cdn_key parameter" },
        { status: 400 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Remove image from product
    const result = await PIMProductModel.findOneAndUpdate(
      {
        entity_code,
        wholesaler_id: session.userId,
        isCurrent: true,
      },
      {
        $pull: { images: { cdn_key } },
        $set: {
          updated_at: new Date(),
          last_updated_by: "manual",
        },
      },
      { new: true }
    ).lean();

    if (!result) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Image deleted successfully",
      product: result,
    });
  } catch (error) {
    console.error("Error deleting image:", error);
    return NextResponse.json(
      {
        error: "Failed to delete image",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
