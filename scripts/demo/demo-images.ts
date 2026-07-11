/**
 * VINC Demo — product image manifest (single source of truth).
 *
 * Maps every catalog `code` (the suffix in DEMO-<code>) to its uploaded CDN
 * URL. upload-demo-images.ts writes these URLs after pushing the curated,
 * license-vetted JPEGs in scripts/demo/assets/ to `demo/DEMO-<code>.jpg`.
 *
 * ONE scheme everywhere: object key = `demo/DEMO-<code>.jpg`. Until a real URL
 * exists for a code, cdnUrlFor() falls back to a deterministic CDN path that
 * carries the SAME `DEMO-` prefix so the catalog still builds deterministically.
 */
export const DEMO_IMAGE_BASE =
  process.env.DEMO_IMAGE_BASE ??
  "https://cdn.vendereincloud.it/vinc-demo-it"; // overwritten by upload script output

/** Canonical object key for a product code (matches cdn_key + the uploader). */
export const cdnKeyFor = (code: string) => `demo/DEMO-${code}.jpg`;

/** code → absolute CDN url. Keys MUST match TEMPLATES[].code. */
export const DEMO_IMAGE_MANIFEST: Record<string, string> = {
  // populated by upload-demo-images.ts, e.g.:
  // "UEL-01": "https://cdn.vendereincloud.it/vinc-demo-it/demo/DEMO-UEL-01.jpg",
};

/** Deterministic CDN url for a product code (same scheme as cdnKeyFor). */
export function cdnUrlFor(code: string): string {
  return DEMO_IMAGE_MANIFEST[code] ?? `${DEMO_IMAGE_BASE}/${cdnKeyFor(code)}`;
}
