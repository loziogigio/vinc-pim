import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { PIMProductModel } from "@/lib/db/models/pim-product";

/**
 * PATCH /api/b2b/pim/products/[entity_code]/media/reorder
 * Reorder media items within a type group
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
    const { type, order } = body; // order is array of cdn_keys in desired order

    // Validate required fields
    if (!type || !["document", "video", "3d-model"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid or missing type parameter" },
        { status: 400 }
      );
    }

    if (!Array.isArray(order) || order.length === 0) {
      return NextResponse.json(
        { error: "Invalid or missing order parameter (must be array of cdn_keys)" },
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

    // Get current media
    const allMedia = product.media || [];

    // Separate media by type
    const mediaOfType = allMedia.filter((m: any) => m.type === type);
    const mediaOfOtherTypes = allMedia.filter((m: any) => m.type !== type);

    // Create a map for quick lookup
    const mediaMap = new Map(mediaOfType.map((m: any) => [m.cdn_key, m]));

    // Reorder media based on the provided order
    const reorderedMedia = order
      .map((cdn_key, index) => {
        const mediaItem = mediaMap.get(cdn_key);
        if (mediaItem) {
          return {
            ...mediaItem,
            position: index,
          };
        }
        return null;
      })
      .filter(Boolean);

    // Add any media items not in the order array at the end
    const orderedKeys = new Set(order);
    const remainingMedia = mediaOfType
      .filter((m: any) => !orderedKeys.has(m.cdn_key))
      .map((m: any, index: number) => ({
        ...m,
        position: reorderedMedia.length + index,
      }));

    // Combine: reordered items + remaining items + items of other types
    const finalMedia = [
      ...reorderedMedia,
      ...remainingMedia,
      ...mediaOfOtherTypes,
    ];

    // Update product
    const updatedProduct = await PIMProductModel.findOneAndUpdate(
      {
        entity_code,
        isCurrent: true,
      },
      {
        $set: {
          media: finalMedia,
          updated_at: new Date(),
          last_updated_by: "manual",
        },
      },
      { new: true }
    ).lean();

    return NextResponse.json({
      success: true,
      message: `${type} media reordered successfully`,
      media: finalMedia.filter((m: any) => m.type === type),
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Error reordering media:", error);
    return NextResponse.json(
      {
        error: "Failed to reorder media",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
