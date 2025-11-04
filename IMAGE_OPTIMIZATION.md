# Image Optimization Guide

## Overview

This project uses Next.js Image optimization with a multi-size image strategy for optimal performance.

## Image Structure

All product images follow this structure:

```typescript
{
  id: "img_001",
  thumbnail: "50x50.webp",      // For lists (48x48 display)
  medium: "300x300.webp",        // For cards (300x300 display)
  large: "1000x1000.webp",       // For detail views (400-1000px display)
  original: "2000x2000.jpg",     // For zoom/download
  blur: "data:image/jpeg;base64,..." // Optional blur placeholder
}
```

## When to Use Each Size

| Context | Size | Display | Example |
|---------|------|---------|---------|
| Product List | `thumbnail` | 48x48px | `/b2b/pim/products` |
| Product Cards | `medium` | 300x300px | Category grids |
| Detail View | `medium` or `large` | 400-1000px | `/b2b/pim/products/[id]` |
| Zoom/Download | `original` | Full size | Lightbox, downloads |

## Implementation

### Product List (Above the Fold)

```tsx
{products.map((product, index) => (
  <Image
    src={product.image.thumbnail}
    alt={product.name}
    width={48}
    height={48}
    quality={75}
    sizes="48px"
    priority={index < 5}  // First 5 images load immediately
    placeholder={product.image.blur ? "blur" : "empty"}
    blurDataURL={product.image.blur}
  />
))}
```

### Product Detail (Hero Image)

```tsx
<Image
  src={product.image.medium || product.image.thumbnail}
  alt={product.name}
  width={400}
  height={400}
  quality={85}
  sizes="(max-width: 768px) 100vw, 400px"
  priority  // Always prioritize hero images
  placeholder={product.image.blur ? "blur" : "empty"}
  blurDataURL={product.image.blur}
/>
```

### Product Gallery (Large View)

```tsx
<Image
  src={product.image.large || product.image.medium}
  alt={product.name}
  width={1000}
  height={1000}
  quality={90}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 1000px"
  placeholder={product.image.blur ? "blur" : "empty"}
  blurDataURL={product.image.blur}
/>
```

## Performance Benefits

### Without Optimization
- 2000x2000px JPEG = **500KB-2MB** per image
- User downloads full size even for 48px display
- 50 products = **25-100MB** page load

### With Next.js Image Optimization
- 48px WebP = **2-5KB** per image
- AVIF format = **1-2KB** per image (70% smaller!)
- 50 products = **50-100KB** page load
- **99.5% bandwidth savings**

## How It Works

1. **First Request** (On-Demand)
   - Browser requests: `/_next/image?url=/product.jpg&w=48&q=75`
   - Next.js downloads original (2000x2000px)
   - Resizes to 48px
   - Converts to WebP/AVIF
   - Caches result (30 days)
   - Returns optimized image (~2KB)

2. **Subsequent Requests** (Cached)
   - Browser requests same image
   - Next.js serves from cache (~5-10ms)

## Configuration

### next.config.ts

```typescript
images: {
  remotePatterns: [...],
  formats: ['image/avif', 'image/webp'],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
}
```

## Blur Placeholder

Blur placeholders improve perceived performance by showing a blurred preview while the image loads.

### How to Generate

```typescript
import { generateBlurPlaceholder } from '@/lib/utils/image';

// Server-side during image processing
const blurDataUrl = await generateBlurPlaceholder(imageUrl);

// Save to database
await saveProduct({
  image: {
    thumbnail: "...",
    blur: blurDataUrl
  }
});
```

### Requirements

- Base64 encoded image
- Should be ~10x10px JPEG
- Typically < 1KB
- Format: `data:image/jpeg;base64,/9j/4AAQ...`

## Best Practices

### 1. Always Use Next.js Image Component

❌ **Don't:**
```tsx
<img src={product.image.thumbnail} />
```

✅ **Do:**
```tsx
<Image src={product.image.thumbnail} width={48} height={48} />
```

### 2. Prioritize Above-the-Fold Images

```tsx
// First 5 products in list
priority={index < 5}

// Hero images on detail pages
priority
```

### 3. Specify Sizes Hint

```tsx
// List view (fixed size)
sizes="48px"

// Responsive card
sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 300px"
```

### 4. Use Appropriate Quality Settings

| Context | Quality | Reason |
|---------|---------|--------|
| Thumbnails | 75 | Small size, quality less critical |
| Medium | 80-85 | Balance quality and size |
| Large | 85-90 | High quality for detail views |
| Original | 95 | Preserve quality for zoom |

### 5. Fallback Strategy

```tsx
// Always provide fallback chain
src={product.image.large || product.image.medium || product.image.thumbnail}
```

## CDN Integration

Images are automatically optimized and can be served from your CDN:

```env
NEXT_PUBLIC_CDN_ENDPOINT=https://cdn.example.com
```

Next.js will:
1. Optimize images on first request
2. Cache optimized versions
3. Serve from CDN edge locations
4. Respect `minimumCacheTTL` (30 days)

## Monitoring Performance

### DevTools Network Tab

1. Filter by "Img"
2. Look for `/_next/image?url=...&w=48&q=75`
3. Check:
   - **Size**: Should be 2-5KB for thumbnails
   - **Time**: First load ~100-200ms, cached ~5-10ms
   - **Format**: Should be WebP or AVIF

### Lighthouse

- LCP (Largest Contentful Paint): < 2.5s
- CLS (Cumulative Layout Shift): < 0.1
- Image formats: Modern (WebP/AVIF)

## Migration Checklist

When adding new product images:

- [ ] Generate all 4 sizes (thumbnail, medium, large, original)
- [ ] Generate blur placeholder (optional but recommended)
- [ ] Store in correct format (WebP for optimized, JPEG for original)
- [ ] Update database with multi-size structure
- [ ] Test in different contexts (list, card, detail)
- [ ] Verify performance in DevTools

## Utilities

Helper functions available in `src/lib/utils/image.ts`:

```typescript
import {
  getImageUrl,
  getSrcsetSizes,
  hasBlurPlaceholder,
  type ProductImage
} from '@/lib/utils/image';

// Get appropriate URL
const url = getImageUrl(product.image, 'medium');

// Get sizes attribute
const sizes = getSrcsetSizes('detail');

// Check blur availability
if (hasBlurPlaceholder(product.image)) {
  // Use blur placeholder
}
```

## Troubleshooting

### Images not loading
- Check `remotePatterns` in `next.config.ts`
- Verify CDN endpoint is accessible
- Check browser console for errors

### Images loading slowly
- Ensure `priority` is set for above-the-fold images
- Verify correct `sizes` attribute
- Check cache is working (should be fast on second load)

### Large file sizes
- Verify using `thumbnail` for lists, not `original`
- Check quality settings (75 for thumbnails is good)
- Ensure formats include WebP/AVIF

## Further Reading

- [Next.js Image Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/images)
- [Image Component API](https://nextjs.org/docs/app/api-reference/components/image)
- [WebP vs AVIF](https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Image_types)
