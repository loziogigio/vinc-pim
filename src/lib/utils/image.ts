/**
 * Image utilities for PIM system
 * Handles blur placeholders, image sizes, and optimization
 */

/**
 * Generate a base64 blur placeholder from an image URL
 * This should be called server-side during image processing
 */
export async function generateBlurPlaceholder(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // In a real implementation, you would use sharp or similar to:
    // 1. Resize to 10x10px
    // 2. Convert to JPEG with low quality
    // 3. Return base64 data URL

    // For now, return a simple placeholder
    // TODO: Implement with sharp when available
    return `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAKAAoDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlbaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD5/ooooA//2Q==`;
  } catch (error) {
    console.error('Error generating blur placeholder:', error);
    return '';
  }
}

/**
 * Image size configuration for PIM products
 */
export const IMAGE_SIZES = {
  thumbnail: { width: 50, height: 50, quality: 75 },
  medium: { width: 300, height: 300, quality: 80 },
  large: { width: 1000, height: 1000, quality: 85 },
  original: { quality: 95 }
} as const;

/**
 * Generate srcset sizes attribute for responsive images
 */
export function getSrcsetSizes(context: 'list' | 'card' | 'detail'): string {
  switch (context) {
    case 'list':
      return '48px';
    case 'card':
      return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 300px';
    case 'detail':
      return '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 1000px';
    default:
      return '100vw';
  }
}

/**
 * Get the appropriate image URL based on desired size
 */
export function getImageUrl(
  image: {
    thumbnail: string;
    medium?: string;
    large?: string;
    original: string;
  },
  preferredSize: 'thumbnail' | 'medium' | 'large' | 'original'
): string {
  switch (preferredSize) {
    case 'thumbnail':
      return image.thumbnail;
    case 'medium':
      return image.medium || image.thumbnail;
    case 'large':
      return image.large || image.medium || image.thumbnail;
    case 'original':
      return image.original;
    default:
      return image.thumbnail;
  }
}

/**
 * Check if blur placeholder is available
 */
export function hasBlurPlaceholder(image: { blur?: string }): boolean {
  return Boolean(image.blur && image.blur.startsWith('data:image'));
}

/**
 * Product image type definition for PIM
 */
export type ProductImage = {
  id: string;
  thumbnail: string;      // 50x50 for lists
  medium?: string;        // 300x300 for cards
  large?: string;         // 1000x1000 for detail views
  original: string;       // 2000x2000+ for zoom/download
  blur?: string;          // Base64 blur placeholder
};
