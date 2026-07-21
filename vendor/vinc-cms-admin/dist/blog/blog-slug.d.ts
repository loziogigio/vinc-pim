/** URL-slug pattern for blog posts/categories/tags (lowercase, digits, hyphens). */
export declare const BLOG_SLUG_REGEX: RegExp;
/**
 * Generate a URL-friendly, hyphen-separated slug for blog entities.
 * Accent-stripped + hyphenated (matches the B2C pages UI generateSlug) —
 * intentionally different from the underscore-based src/lib/data-models/slugify.ts.
 */
export declare function blogSlugify(text: string): string;
//# sourceMappingURL=blog-slug.d.ts.map