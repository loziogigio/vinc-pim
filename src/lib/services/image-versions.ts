/**
 * Image Version Generation Service
 *
 * Generates resized image versions (main_, gallery_, custom) during PIM product upload.
 * Uses sharp for resizing and uploads directly to S3 with prefixed keys.
 */

import sharp from "sharp";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createS3Client, getCdnBaseUrl } from "vinc-cdn";
import type { CdnConfig } from "vinc-cdn";
import type { ImageVersionConfig, ImageVersionsSettings } from "@/lib/types/home-settings";
import type { ImageVersion } from "@/lib/types/pim";
import { getHomeSettings } from "@/lib/db/home-settings";

/** Default image versions when none are configured */
export const DEFAULT_IMAGE_VERSIONS: ImageVersionConfig[] = [
  { key: "main", prefix: "main_", width: 800, height: 800, is_default: true },
  { key: "gallery", prefix: "gallery_", width: 400, height: 400, is_default: true },
];

/**
 * Load image version configs from home-settings, falling back to defaults.
 */
export async function getImageVersionConfigs(): Promise<{
  enabled: boolean;
  versions: ImageVersionConfig[];
}> {
  try {
    const settings = await getHomeSettings();
    const imageVersions = settings?.image_versions as ImageVersionsSettings | undefined;

    if (imageVersions) {
      return {
        enabled: imageVersions.enabled,
        versions: imageVersions.versions.length > 0
          ? imageVersions.versions
          : DEFAULT_IMAGE_VERSIONS,
      };
    }
  } catch (error) {
    console.error("[image-versions] Failed to load config, using defaults:", error);
  }

  return { enabled: true, versions: DEFAULT_IMAGE_VERSIONS };
}

/**
 * Get the sharp output format based on content type, preserving the original format.
 */
function getSharpFormat(contentType: string): "jpeg" | "png" | "webp" {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpeg";
}

/**
 * Build the S3 key for a version by prepending the prefix to the filename portion.
 *
 * Given originalKey = "products/entity/2024-01-15T10-30-45-000Z-photo.jpg"
 * and prefix = "main_"
 * Returns: "products/entity/main_2024-01-15T10-30-45-000Z-photo.jpg"
 */
function buildVersionKey(originalKey: string, prefix: string): string {
  const lastSlash = originalKey.lastIndexOf("/");
  if (lastSlash === -1) {
    return `${prefix}${originalKey}`;
  }
  const folder = originalKey.substring(0, lastSlash + 1);
  const filename = originalKey.substring(lastSlash + 1);
  return `${folder}${prefix}${filename}`;
}

/**
 * Generate resized image versions and upload them to S3.
 *
 * @param cdnConfig - CDN/S3 configuration
 * @param originalBuffer - Buffer of the original uploaded image
 * @param originalCdnKey - S3 key of the original image
 * @param contentType - MIME type of the original image
 * @param versionConfigs - List of version configs to generate
 * @returns Record of version key -> version metadata
 */
export async function generateImageVersions(
  cdnConfig: CdnConfig,
  originalBuffer: Buffer,
  originalCdnKey: string,
  contentType: string,
  versionConfigs: ImageVersionConfig[]
): Promise<Record<string, ImageVersion>> {
  const versions: Record<string, ImageVersion> = {};
  const s3Client = createS3Client(cdnConfig);
  const baseUrl = getCdnBaseUrl(cdnConfig);
  const format = getSharpFormat(contentType);

  for (const config of versionConfigs) {
    try {
      // Resize with sharp — fit inside bounds, don't enlarge small images
      let pipeline = sharp(originalBuffer).resize(config.width, config.height, {
        fit: "inside",
        withoutEnlargement: true,
      });

      // Apply format with high quality
      switch (format) {
        case "jpeg":
          pipeline = pipeline.jpeg({ quality: 90 });
          break;
        case "png":
          pipeline = pipeline.png({ compressionLevel: 6 });
          break;
        case "webp":
          pipeline = pipeline.webp({ quality: 90 });
          break;
      }

      const resizedBuffer = await pipeline.toBuffer();
      const metadata = await sharp(resizedBuffer).metadata();

      // Build the version S3 key with prefix
      const versionKey = buildVersionKey(originalCdnKey, config.prefix);

      // Upload directly to S3
      await s3Client.send(
        new PutObjectCommand({
          Bucket: cdnConfig.bucket,
          Key: versionKey,
          Body: resizedBuffer,
          ContentType: contentType,
          ACL: "public-read",
        })
      );

      versions[config.key] = {
        url: `${baseUrl}/${versionKey}`,
        cdn_key: versionKey,
        width: metadata.width || config.width,
        height: metadata.height || config.height,
      };
    } catch (error) {
      console.error(
        `[image-versions] Failed to generate version "${config.key}" for ${originalCdnKey}:`,
        error
      );
      // Continue with other versions — don't fail the whole upload
    }
  }

  return versions;
}

/**
 * Delete all version files from S3 for a given image.
 */
export async function deleteImageVersions(
  cdnConfig: CdnConfig,
  versions: Record<string, ImageVersion>
): Promise<void> {
  if (!cdnConfig.deleteEnabled) return;

  const s3Client = createS3Client(cdnConfig);

  for (const [key, version] of Object.entries(versions)) {
    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: cdnConfig.bucket,
          Key: version.cdn_key,
        })
      );
    } catch (error) {
      console.warn(
        `[image-versions] Failed to delete version "${key}" (${version.cdn_key}):`,
        error
      );
    }
  }
}
