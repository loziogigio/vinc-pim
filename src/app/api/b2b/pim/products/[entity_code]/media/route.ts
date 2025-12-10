import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { PIMProductModel } from "@/lib/db/models/pim-product";
import { uploadMultipleMedia } from "@/lib/cdn/media-upload";
import { deleteFromCdn } from "@/lib/services/cdn-upload.service";

/**
 * POST /api/b2b/pim/products/[entity_code]/media
 * Upload media files for a product
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
    const files = formData.getAll("media") as File[];
    const type = formData.get("type") as string | null;

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No media files provided" },
        { status: 400 }
      );
    }

    if (!type || !["document", "video", "3d-model"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid or missing type parameter" },
        { status: 400 }
      );
    }

    // Upload media to CDN
    const uploadResults = await uploadMultipleMedia(
      files,
      `products/${entity_code}`
    );

    if (
      uploadResults.failed.length > 0 &&
      uploadResults.successful.length === 0
    ) {
      return NextResponse.json(
        {
          error: "All media uploads failed",
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

    // Calculate starting position for new media items
    const existingMediaOfType = (product.media || []).filter((m: any) => m.type === type);
    const maxPosition = existingMediaOfType.length > 0
      ? Math.max(...existingMediaOfType.map((m: any) => m.position || 0))
      : -1;

    // Prepare new media entries
    const newMedia = uploadResults.successful.map((result, index) => ({
      type: type,
      file_type: result.file_type,
      url: result.url,
      cdn_key: result.cdn_key,
      label: result.file_name,
      size_bytes: result.size_bytes,
      uploaded_at: new Date(),
      uploaded_by: session.userId,
      is_external_link: false,
      position: maxPosition + 1 + index,
    }));

    // Update product with new media
    const updatedProduct = await PIMProductModel.findOneAndUpdate(
      {
        entity_code,
        // No wholesaler_id - database provides isolation
        isCurrent: true,
      },
      {
        $push: { media: { $each: newMedia } },
        $set: {
          updated_at: new Date(),
          last_updated_by: "manual",
        },
      },
      { new: true }
    ).lean();

    return NextResponse.json({
      success: true,
      message: `${uploadResults.successful.length} media file(s) uploaded successfully`,
      uploaded: uploadResults.successful.length,
      failed: uploadResults.failed.length,
      failures: uploadResults.failed,
      media: newMedia,
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Error uploading media:", error);
    return NextResponse.json(
      {
        error: "Failed to upload media",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/b2b/pim/products/[entity_code]/media?cdn_key=...
 * Delete a specific media file from a product
 * Supports cdn_key, _id, or URL as identifier
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

    // Get media identifier from query params (supports cdn_key, _id, or URL)
    const { searchParams } = new URL(req.url);
    const mediaId = searchParams.get("cdn_key");

    if (!mediaId) {
      return NextResponse.json(
        { error: "Missing cdn_key parameter" },
        { status: 400 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // First, find the product and the media item to get cdn_key for CDN deletion
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

    // Find the media item by cdn_key, _id, or URL
    const mediaItems = product.media || [];
    const mediaItem = mediaItems.find((m: any) =>
      m.cdn_key === mediaId ||
      m._id?.toString() === mediaId ||
      m.url === mediaId
    );

    if (!mediaItem) {
      return NextResponse.json(
        { error: "Media item not found" },
        { status: 404 }
      );
    }

    // Build the $pull query based on available identifier
    let pullQuery: any;
    if (mediaItem.cdn_key) {
      pullQuery = { cdn_key: mediaItem.cdn_key };
    } else if (mediaItem._id) {
      pullQuery = { _id: mediaItem._id };
    } else {
      pullQuery = { url: mediaItem.url };
    }

    // Remove media from product
    const result = await PIMProductModel.findOneAndUpdate(
      {
        entity_code,
        isCurrent: true,
      },
      {
        $pull: { media: pullQuery },
        $set: {
          updated_at: new Date(),
          last_updated_by: "manual",
        },
      },
      { new: true }
    ).lean();

    // Derive cdn_key from URL if not available (for CDN deletion)
    let cdnKeyForDeletion = mediaItem.cdn_key;
    if (!cdnKeyForDeletion && mediaItem.url && !mediaItem.is_external_link) {
      // Try to extract key from URL (e.g., "https://s3.../bucket/key" -> "key")
      try {
        const url = new URL(mediaItem.url);
        const pathParts = url.pathname.split('/');
        // Skip first empty part and bucket name, get the rest
        if (pathParts.length > 2) {
          cdnKeyForDeletion = pathParts.slice(2).join('/');
        }
      } catch {
        // URL parsing failed, skip CDN deletion
      }
    }

    // Try to delete from CDN (if delete_from_cloud is enabled in settings)
    // CDN deletion is best-effort - DB record is already deleted, so we continue even if this fails
    let cdnDeleted = false;
    let cdnError: string | null = null;

    if (cdnKeyForDeletion && !mediaItem.is_external_link) {
      try {
        cdnDeleted = await deleteFromCdn(cdnKeyForDeletion);
        if (!cdnDeleted) {
          cdnError = "CDN deletion skipped (disabled or not configured)";
        }
      } catch (err) {
        cdnError = err instanceof Error ? err.message : "CDN deletion failed (permission denied or network error)";
        console.warn("[media] CDN deletion failed, but DB record already removed:", cdnError);
      }
    } else if (mediaItem.is_external_link) {
      cdnError = "CDN deletion skipped (external link)";
    } else {
      cdnError = "CDN deletion skipped (no cdn_key available)";
    }

    return NextResponse.json({
      success: true,
      message: "Media file deleted successfully",
      cdn_deleted: cdnDeleted,
      cdn_error: cdnError,
      product: result,
    });
  } catch (error) {
    console.error("Error deleting media:", error);
    return NextResponse.json(
      {
        error: "Failed to delete media",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/b2b/pim/products/[entity_code]/media
 * Get all media files for a product
 */
export async function GET(
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

    // Connect to database
    await connectToDatabase();

    // Find the product
    const product = await PIMProductModel.findOne({
      entity_code,
      // No wholesaler_id - database provides isolation
      isCurrent: true,
    })
      .select("media")
      .lean() as { media?: any[] } | null;

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      media: product.media || [],
    });
  } catch (error) {
    console.error("Error fetching media:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch media",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
