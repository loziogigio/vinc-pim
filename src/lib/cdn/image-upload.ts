import { uploadToCdn, isCdnConfigured } from "@/lib/services/cdnClient";

/**
 * Allowed image MIME types
 */
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

/**
 * Maximum file size in bytes (5MB)
 */
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export interface ImageUploadResult {
  url: string;
  cdn_key: string;
  file_name: string;
  file_type: string;
  size_bytes: number;
}

export interface ImageValidationError {
  field: string;
  message: string;
}

/**
 * Validate image file
 */
export function validateImageFile(
  file: File
): { valid: boolean; error?: string } {
  // Check if CDN is configured
  if (!isCdnConfigured()) {
    return { valid: false, error: "CDN is not configured" };
  }

  // Check file type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as any)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(", ")}`,
    };
  }

  // Check file size
  if (file.size > MAX_IMAGE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${MAX_IMAGE_SIZE / 1024 / 1024}MB`,
    };
  }

  return { valid: true };
}

/**
 * Upload single image to CDN
 */
export async function uploadImage(
  file: File,
  folder = "products"
): Promise<ImageUploadResult> {
  // Validate file
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Convert file to buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Generate unique filename with folder prefix
  const timestamp = Date.now();
  const sanitizedName = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-");
  const fileName = `${folder}/${timestamp}-${sanitizedName}`;

  // Upload to CDN
  const result = await uploadToCdn({
    buffer,
    contentType: file.type,
    fileName,
  });

  return {
    url: result.url,
    cdn_key: result.key,
    file_name: file.name,
    file_type: file.type,
    size_bytes: file.size,
  };
}

/**
 * Upload multiple images to CDN
 */
export async function uploadMultipleImages(
  files: File[],
  folder = "products"
): Promise<{
  successful: ImageUploadResult[];
  failed: { file: string; error: string }[];
}> {
  const successful: ImageUploadResult[] = [];
  const failed: { file: string; error: string }[] = [];

  for (const file of files) {
    try {
      const result = await uploadImage(file, folder);
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
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

/**
 * Check if file is an image based on extension
 */
export function isImageFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  return ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext);
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
