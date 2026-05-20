// src/lib/constants/blog.ts
/**
 * Blog module constants & helpers.
 *
 * NOTE: content locales come from src/config/languages.ts (it/de/en/cs).
 * Use isValidLanguageCode / getDefaultLanguage from there — do not redefine here.
 */

export const BLOG_POST_STATUSES = ["draft", "scheduled", "published"] as const;
export type BlogPostStatus = (typeof BLOG_POST_STATUSES)[number];

/** URL-slug pattern for blog posts/categories/tags (lowercase, digits, hyphens). */
export const BLOG_SLUG_REGEX = /^[a-z0-9-]+$/;

/**
 * Generate a URL-friendly, hyphen-separated slug for blog entities.
 * Accent-stripped + hyphenated (matches the B2C pages UI generateSlug) —
 * intentionally different from the underscore-based src/lib/data-models/slugify.ts.
 */
export function blogSlugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
