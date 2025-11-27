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
      // No wholesaler_id - database provides isolation
      isCurrent: true,
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // Get current max position from images
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

    // Check if we should update the main image
    // Update if: no images exist yet
    const shouldUpdateMainImage = currentImages.length === 0;

    // Build update object
    const updateData: any = {
      $push: { images: { $each: newImages } },
      $set: {
        updated_at: new Date(),
        last_updated_by: "manual",
      },
    };

    // If this is the first image, remove "Missing product image" from critical issues
    if (shouldUpdateMainImage && newImages.length > 0) {
      updateData.$pull = { critical_issues: "Missing primary product image" };
    }

    // Update product with new images
    const updatedProduct = await PIMProductModel.findOneAndUpdate(
      {
        entity_code,
        // No wholesaler_id - database provides isolation
        isCurrent: true,
      },
      updateData,
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
 * PATCH /api/b2b/pim/products/[entity_code]/images
 * Set a specific image as the primary product image
 */
export async function PATCH(
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

    // Parse request body
    const body = await req.json();
    const { cdn_key } = body;

    if (!cdn_key) {
      return NextResponse.json(
        { error: "Missing cdn_key in request body" },
        { status: 400 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Find the product and the image
    const product = await PIMProductModel.findOne({
      entity_code,
      isCurrent: true,
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // Find the image in the images array
    const images = product.images || [];
    const imageIndex = images.findIndex(
      (img: any) => img.cdn_key === cdn_key
    );

    if (imageIndex === -1) {
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 }
      );
    }

    const imageToSetAsPrimary = images[imageIndex];

    // Convert Mongoose document to plain object if needed
    const imageObj = typeof (imageToSetAsPrimary as any).toObject === 'function'
      ? (imageToSetAsPrimary as any).toObject()
      : imageToSetAsPrimary;

    // Reorder images: move selected image to position 0
    const reorderedImages = [
      {
        ...imageObj,
        position: 0,
      },
      ...images
        .filter((_: any, idx: number) => idx !== imageIndex)
        .map((img: any, idx: number) => {
          const imgObj = typeof (img as any).toObject === 'function' ? (img as any).toObject() : img;
          return {
            ...imgObj,
            position: idx + 1,
          };
        }),
    ];

    // Update the images array
    const updatedProduct = await PIMProductModel.findOneAndUpdate(
      {
        entity_code,
        isCurrent: true,
      },
      {
        $set: {
          images: reorderedImages,
          updated_at: new Date(),
          last_updated_by: "manual",
        },
        $pull: { critical_issues: "Missing primary product image" },
      },
      { new: true }
    ).lean();

    console.log(`✓ Primary image updated for ${entity_code}:`, {
      new_primary_cdn_key: cdn_key,
      images_count: reorderedImages.length,
    });

    return NextResponse.json({
      success: true,
      message: "Primary image updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Error setting primary image:", error);
    return NextResponse.json(
      {
        error: "Failed to set primary image",
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

    // First, get the product to check if we're deleting the main image
    const product = await PIMProductModel.findOne({
      entity_code,
      isCurrent: true,
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // Check if we're deleting the first (primary) image
    const currentImages = product.images || [];
    const isDeletingPrimary = currentImages.length > 0 && currentImages[0]?.cdn_key === cdn_key;

    // Remove image from images array
    const result = await PIMProductModel.findOneAndUpdate(
      {
        entity_code,
        isCurrent: true,
      },
      {
        $pull: { images: { cdn_key: cdn_key } },
        $set: {
          updated_at: new Date(),
          last_updated_by: "manual",
        },
      },
      { new: true }
    );

    if (!result) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // If we deleted all images, add critical issue
    const remainingImages = result.images || [];
    if (remainingImages.length === 0) {
      await PIMProductModel.updateOne(
        { entity_code, isCurrent: true },
        {
          $addToSet: { critical_issues: "Missing primary product image" },
        }
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
