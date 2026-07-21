"use strict";
// Copied verbatim from vinc-commerce-suite src/lib/constants/blog.ts
// (blogSlugify + BLOG_SLUG_REGEX). The CS file also declares BLOG_POST_STATUSES /
// BlogPostStatus — those live in ./types.ts here.
Object.defineProperty(exports, "__esModule", { value: true });
exports.BLOG_SLUG_REGEX = void 0;
exports.blogSlugify = blogSlugify;
/** URL-slug pattern for blog posts/categories/tags (lowercase, digits, hyphens). */
exports.BLOG_SLUG_REGEX = /^[a-z0-9-]+$/;
/**
 * Generate a URL-friendly, hyphen-separated slug for blog entities.
 * Accent-stripped + hyphenated (matches the B2C pages UI generateSlug) —
 * intentionally different from the underscore-based src/lib/data-models/slugify.ts.
 */
function blogSlugify(text) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}
//# sourceMappingURL=blog-slug.js.map