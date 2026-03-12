import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import {
  deleteFromCdn,
  createS3Client,
  getCdnBaseUrl,
  sanitizeFilename,
  validateImageFile,
} from "vinc-cdn";
import { getCdnConfig } from "@/lib/services/cdn-config";
import {
  getImageVersionConfigs,
  generateImageVersions,
  deleteImageVersions,
} from "@/lib/services/image-versions";

/**
 * POST /api/b2b/pim/products/[entity_code]/images
 * Upload images for a product
 *
 * S3 key structure: {sku}/{sanitized-filename}
 * Versions:         {sku}/{prefix}_{sanitized-filename}
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entity_code: string }> }
) {
  try {
    // Check authentication
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
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

    // Get CDN config
    const config = await getCdnConfig();
    if (!config) {
      return NextResponse.json({ error: "CDN not configured" }, { status: 500 });
    }

    const s3Client = createS3Client(config);
    const baseUrl = getCdnBaseUrl(config);
    const folderPrefix = config.folder ? `${config.folder}/` : "";

    // Connect to tenant database
    const tenantDb = `vinc-${session.tenantId}`;
    const { PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

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

    // Get current max position from images
    const currentImages = product.images || [];
    const maxPosition =
      currentImages.length > 0
        ? Math.max(...currentImages.map((img: any) => img.position || 0))
        : -1;

    // Load image version configs
    const versionConfig = await getImageVersionConfigs();

    // Use product SKU for folder, product name for filename
    const sku = (product as any).sku || entity_code;
    const sanitizedSku = sanitizeFilename(sku);

    // Extract product name (MultilingualText → first available string value)
    const productName = (product as any).name;
    let productNameStr = sku; // fallback to SKU
    if (productName && typeof productName === "object") {
      const firstVal = Object.values(productName).find((v) => typeof v === "string" && (v as string).trim());
      if (firstVal) productNameStr = firstVal as string;
    } else if (typeof productName === "string" && productName.trim()) {
      productNameStr = productName;
    }
    const sanitizedProductName = sanitizeFilename(productNameStr);

    // Upload each file: pim-product/{sku}/{product-name}.ext
    const newImages = [];
    const failed: { file: string; error: string }[] = [];

    for (let index = 0; index < files.length; index++) {
      const file = files[index];

      // Validate image file
      const validation = validateImageFile(file);
      if (!validation.valid) {
        failed.push({ file: file.name, error: validation.error || "Invalid file" });
        continue;
      }

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        // Use product name as filename, preserve original extension
        const ext = file.name.includes(".") ? file.name.substring(file.name.lastIndexOf(".")) : "";
        // First image: product-name.ext, subsequent: product-name_1.ext, product-name_2.ext
        const imageIndex = currentImages.length + index;
        const nameForKey = imageIndex === 0
          ? `${sanitizedProductName}${ext}`
          : `${sanitizedProductName}_${imageIndex}${ext}`;
        const cdnKey = `${folderPrefix}pim-product/${sanitizedSku}/${nameForKey}`;

        // Upload original to S3 with clean key
        await s3Client.send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: cdnKey,
            Body: buffer,
            ContentType: file.type,
            ACL: "public-read",
          })
        );

        const url = `${baseUrl}/${cdnKey}`;

        // Generate resized versions
        let versions: Record<string, any> | undefined;
        if (versionConfig.enabled && versionConfig.versions.length > 0) {
          try {
            versions = await generateImageVersions(
              config,
              buffer,
              cdnKey,
              file.type,
              versionConfig.versions
            );
          } catch (err) {
            console.error(`[images] Version generation failed for ${file.name}:`, err);
          }
        }

        newImages.push({
          url,
          cdn_key: cdnKey,
          position: maxPosition + index + 1,
          uploaded_at: new Date(),
          uploaded_by: session.userId,
          file_name: file.name,
          file_type: file.type,
          size_bytes: file.size,
          ...(versions && Object.keys(versions).length > 0 ? { versions } : {}),
        });
      } catch (err) {
        console.error(`[images] Upload failed for ${file.name}:`, err);
        failed.push({
          file: file.name,
          error: err instanceof Error ? err.message : "Upload failed",
        });
      }
    }

    if (newImages.length === 0) {
      return NextResponse.json(
        { error: "All image uploads failed", failures: failed },
        { status: 400 }
      );
    }

    // Check if we should update the main image
    const shouldUpdateMainImage = currentImages.length === 0;

    // Build update object
    const updateData: any = {
      $push: { images: { $each: newImages } },
      $set: {
        updated_at: new Date(),
        last_updated_by: "manual",
      },
    };

    if (shouldUpdateMainImage && newImages.length > 0) {
      updateData.$pull = { critical_issues: "Missing primary product image" };
    }

    // Update product with new images
    const updatedProduct = await PIMProductModel.findOneAndUpdate(
      { entity_code, isCurrent: true },
      updateData,
      { new: true }
    ).lean();

    return NextResponse.json({
      success: true,
      message: `${newImages.length} image(s) uploaded successfully`,
      uploaded: newImages.length,
      failed: failed.length,
      failures: failed,
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
    if (!session || !session.tenantId) {
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

    // Connect to tenant database
    const tenantDb = `vinc-${session.tenantId}`;
    const { PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

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
 * Supports cdn_key, _id, or URL as identifier
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ entity_code: string }> }
) {
  try {
    // Check authentication
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const { entity_code } = resolvedParams;

    // Get image identifier from query params (supports cdn_key, _id, or URL)
    const { searchParams } = new URL(req.url);
    const imageId = searchParams.get("cdn_key");

    if (!imageId) {
      return NextResponse.json(
        { error: "Missing cdn_key parameter" },
        { status: 400 }
      );
    }

    // Connect to tenant database
    const tenantDb = `vinc-${session.tenantId}`;
    const { PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

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

    // Find the image by cdn_key, _id, or URL
    const currentImages = product.images || [];
    const imageItem = currentImages.find((img: any) =>
      img.cdn_key === imageId ||
      img._id?.toString() === imageId ||
      img.url === imageId
    );

    if (!imageItem) {
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 }
      );
    }

    // Check if we're deleting the first (primary) image
    const isDeletingPrimary = currentImages.length > 0 &&
      (currentImages[0]?.cdn_key === imageItem.cdn_key ||
       currentImages[0]?._id?.toString() === imageItem._id?.toString());

    // Build the $pull query based on available identifier
    let pullQuery: any;
    if (imageItem.cdn_key) {
      pullQuery = { cdn_key: imageItem.cdn_key };
    } else if (imageItem._id) {
      pullQuery = { _id: imageItem._id };
    } else {
      pullQuery = { url: imageItem.url };
    }

    // Remove image from images array
    const result = await PIMProductModel.findOneAndUpdate(
      {
        entity_code,
        isCurrent: true,
      },
      {
        $pull: { images: pullQuery },
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

    // Derive cdn_key from URL if not available (for CDN deletion)
    let cdnKeyForDeletion = imageItem.cdn_key;
    if (!cdnKeyForDeletion && imageItem.url) {
      // Try to extract key from URL
      try {
        const url = new URL(imageItem.url);
        const pathParts = url.pathname.split('/');
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

    if (cdnKeyForDeletion) {
      try {
        const deleteConfig = await getCdnConfig();
        if (deleteConfig) {
          cdnDeleted = await deleteFromCdn(deleteConfig, cdnKeyForDeletion);
          if (!cdnDeleted) {
            cdnError = "CDN deletion skipped (disabled or not configured)";
          }
        } else {
          cdnError = "CDN deletion skipped (not configured)";
        }
      } catch (err) {
        cdnError = err instanceof Error ? err.message : "CDN deletion failed (permission denied or network error)";
        console.warn("[images] CDN deletion failed, but DB record already removed:", cdnError);
      }
    } else {
      cdnError = "CDN deletion skipped (no cdn_key available)";
    }

    // Delete image versions from CDN (best-effort)
    if (imageItem.versions && typeof imageItem.versions === "object") {
      try {
        const versionConfig = await getCdnConfig();
        if (versionConfig) {
          await deleteImageVersions(versionConfig, imageItem.versions);
        }
      } catch (err) {
        console.warn("[images] Version deletion failed:", err);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Image deleted successfully",
      cdn_deleted: cdnDeleted,
      cdn_error: cdnError,
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
