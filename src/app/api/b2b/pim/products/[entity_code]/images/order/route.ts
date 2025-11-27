import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { PIMProductModel } from "@/lib/db/models/pim-product";

/**
 * PATCH /api/b2b/pim/products/[entity_code]/images/order
 * Update the order of images for a product
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
    const { imageOrder } = body; // Array of cdn_keys in desired order

    if (!Array.isArray(imageOrder)) {
      return NextResponse.json(
        { error: "imageOrder must be an array of cdn_keys" },
        { status: 400 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Find the product
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

    // Get current images
    const images = product.images || [];

    // Create a map for quick lookup
    const imagesMap = new Map(
      images.map((img: any) => [img.cdn_key, img])
    );

    // Reorder images based on the provided order
    const reorderedImages = imageOrder
      .map((cdn_key, index) => {
        const image: any = imagesMap.get(cdn_key);
        if (image) {
          // Convert to plain object if it's a Mongoose document
          const imageObj = typeof (image as any).toObject === 'function' ? (image as any).toObject() : image;
          return {
            ...imageObj,
            position: index,
          };
        }
        return null;
      })
      .filter(Boolean);

    // Add any images not in the order array at the end
    const orderedKeys = new Set(imageOrder);
    const remainingImages = images
      .filter((img: any) => !orderedKeys.has(img.cdn_key))
      .map((img: any, index: number) => {
        const imgObj = typeof (img as any).toObject === 'function' ? (img as any).toObject() : img;
        return {
          ...imgObj,
          position: reorderedImages.length + index,
        };
      });

    const finalImages = [...reorderedImages, ...remainingImages];

    // Update product
    const updatedProduct = await PIMProductModel.findOneAndUpdate(
      {
        entity_code,
        isCurrent: true,
      },
      {
        $set: {
          images: finalImages,
          updated_at: new Date(),
          last_updated_by: "manual",
        },
      },
      { new: true }
    ).lean();

    return NextResponse.json({
      success: true,
      message: "Image order updated successfully",
      images: finalImages,
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Error updating image order:", error);
    return NextResponse.json(
      {
        error: "Failed to update image order",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
