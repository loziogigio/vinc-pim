import { uploadToCdn, isCdnConfigured } from "@/lib/services/cdn-upload.service";

/**
 * Media file type categories
 */
export type MediaType = "document" | "video" | "3d-model";

/**
 * File type configurations
 */
export const MEDIA_TYPE_CONFIG = {
  document: {
    types: ["text/plain", "text/csv", "application/pdf", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    extensions: ["txt", "csv", "pdf", "xls", "xlsx"],
    maxSize: 10 * 1024 * 1024, // 10MB
    label: "Documents",
  },
  video: {
    types: ["video/mp4", "video/webm", "video/quicktime"],
    extensions: ["mp4", "webm", "mov"],
    maxSize: 100 * 1024 * 1024, // 100MB
    label: "Videos",
  },
  "3d-model": {
    types: ["model/gltf-binary", "model/gltf+json", "model/obj", "application/octet-stream"],
    extensions: ["glb", "gltf", "obj", "fbx"],
    maxSize: 50 * 1024 * 1024, // 50MB
    label: "3D Models",
  },
} as const;

export interface MediaUploadResult {
  url: string;
  cdn_key: string;
  file_name: string;
  file_type: string;
  media_type: MediaType;
  size_bytes: number;
}

/**
 * Get media type from file extension
 */
export function getMediaTypeFromExtension(filename: string): MediaType | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return null;

  for (const [mediaType, config] of Object.entries(MEDIA_TYPE_CONFIG)) {
    if ((config.extensions as readonly string[]).includes(ext)) {
      return mediaType as MediaType;
    }
  }

  return null;
}

/**
 * Get media type from MIME type
 */
export function getMediaTypeFromMime(mimeType: string): MediaType | null {
  for (const [mediaType, config] of Object.entries(MEDIA_TYPE_CONFIG)) {
    if ((config.types as readonly string[]).includes(mimeType)) {
      return mediaType as MediaType;
    }
  }

  return null;
}

/**
 * Validate media file
 */
export async function validateMediaFile(
  file: File
): Promise<{ valid: boolean; error?: string; mediaType?: MediaType }> {
  // Check if CDN is configured
  const cdnConfigured = await isCdnConfigured();
  if (!cdnConfigured) {
    return { valid: false, error: "CDN is not configured" };
  }

  // Determine media type
  const mediaType =
    getMediaTypeFromMime(file.type) ||
    getMediaTypeFromExtension(file.name);

  if (!mediaType) {
    return {
      valid: false,
      error: `Unsupported file type. Allowed: ${Object.values(MEDIA_TYPE_CONFIG)
        .map((c) => c.extensions.join(", "))
        .join(", ")}`,
    };
  }

  const config = MEDIA_TYPE_CONFIG[mediaType];

  // Check file size
  if (file.size > config.maxSize) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${formatFileSize(
        config.maxSize
      )} for ${config.label}`,
      mediaType,
    };
  }

  return { valid: true, mediaType };
}

/**
 * Upload single media file to CDN
 */
export async function uploadMedia(
  file: File,
  folder = "media"
): Promise<MediaUploadResult> {
  // Validate file
  const validation = await validateMediaFile(file);
  if (!validation.valid || !validation.mediaType) {
    throw new Error(validation.error);
  }

  const mediaType = validation.mediaType;

  // Convert file to buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Generate unique filename with folder prefix
  const timestamp = Date.now();
  const sanitizedName = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-");
  const fileName = `${folder}/${mediaType}/${timestamp}-${sanitizedName}`;

  // Upload to CDN
  const result = await uploadToCdn({
    buffer,
    content_type: file.type || "application/octet-stream",
    file_name: fileName,
  });

  return {
    url: result.url,
    cdn_key: result.key,
    file_name: file.name,
    file_type: file.type,
    media_type: mediaType,
    size_bytes: file.size,
  };
}

/**
 * Upload multiple media files to CDN
 */
export async function uploadMultipleMedia(
  files: File[],
  folder = "media"
): Promise<{
  successful: MediaUploadResult[];
  failed: { file: string; error: string }[];
}> {
  const successful: MediaUploadResult[] = [];
  const failed: { file: string; error: string }[] = [];

  for (const file of files) {
    try {
      const result = await uploadMedia(file, folder);
      successful.push(result);
    } catch (error) {
      failed.push({
        file: file.name,
        error: error instanceof Error ? error.message : "Upload failed",
      });
    }
  }

  return { successful, failed };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get icon name for media type
 */
export function getMediaTypeIcon(mediaType: MediaType): string {
  const icons: Record<MediaType, string> = {
    document: "FileText",
    video: "Video",
    "3d-model": "Box",
  };
  return icons[mediaType];
}

/**
 * Get file extension
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

/**
 * Check if file is a supported media file
 */
export function isSupportedMediaFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  return Object.values(MEDIA_TYPE_CONFIG).some((config) =>
    (config.extensions as readonly string[]).includes(ext)
  );
}

/**
 * Get accept string for file input
 */
export function getAcceptString(mediaType?: MediaType): string {
  if (mediaType) {
    const config = MEDIA_TYPE_CONFIG[mediaType];
    return config.types.join(",");
  }

  // All supported types
  return Object.values(MEDIA_TYPE_CONFIG)
    .flatMap((config) => config.types)
    .join(",");
}
