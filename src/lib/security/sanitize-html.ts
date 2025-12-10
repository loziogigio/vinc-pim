/**
 * HTML Sanitization Utilities (Client-side)
 *
 * Using DOMPurify for XSS prevention
 */

"use client";

import DOMPurify, { Config } from "dompurify";

/**
 * Default DOMPurify configuration
 */
const DEFAULT_CONFIG: Config = {
  ALLOWED_TAGS: [
    // Text formatting
    "b", "i", "u", "s", "strong", "em", "mark", "small", "sub", "sup",
    // Structure
    "p", "br", "hr", "div", "span",
    // Headings
    "h1", "h2", "h3", "h4", "h5", "h6",
    // Lists
    "ul", "ol", "li", "dl", "dt", "dd",
    // Links and media
    "a", "img",
    // Tables
    "table", "thead", "tbody", "tfoot", "tr", "th", "td",
    // Other
    "blockquote", "pre", "code", "figure", "figcaption",
  ],
  ALLOWED_ATTR: [
    "href", "src", "alt", "title", "class", "id",
    "width", "height", "style",
    "target", "rel",
    "colspan", "rowspan",
  ],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input"],
  FORBID_ATTR: ["onerror", "onclick", "onload", "onmouseover"],
  RETURN_TRUSTED_TYPE: false, // Always return string, not TrustedHTML
};

/**
 * Strict config - minimal HTML allowed
 */
const STRICT_CONFIG: Config = {
  ALLOWED_TAGS: ["b", "i", "u", "strong", "em", "br", "p", "span"],
  ALLOWED_ATTR: ["class"],
  ALLOW_DATA_ATTR: false,
  RETURN_TRUSTED_TYPE: false,
};

/**
 * Sanitize HTML content
 */
export function sanitizeHtml(
  html: string | undefined | null,
  config: Config = DEFAULT_CONFIG
): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, { ...config, RETURN_TRUSTED_TYPE: false }) as string;
}

/**
 * Sanitize with strict rules (minimal tags)
 */
export function sanitizeHtmlStrict(html: string | undefined | null): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, STRICT_CONFIG) as string;
}

/**
 * Strip all HTML tags, return plain text
 */
export function stripHtml(html: string | undefined | null): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [], RETURN_TRUSTED_TYPE: false }) as string;
}

/**
 * Check if string contains potentially dangerous content
 */
export function containsUnsafeHtml(html: string): boolean {
  const sanitized = DOMPurify.sanitize(html, { ...DEFAULT_CONFIG, RETURN_TRUSTED_TYPE: false }) as string;
  return sanitized !== html;
}

/**
 * Create sanitized HTML props for React
 */
export function createSafeHtmlProps(
  html: string | undefined | null,
  config?: Config
): { dangerouslySetInnerHTML: { __html: string } } {
  return {
    dangerouslySetInnerHTML: {
      __html: sanitizeHtml(html, config),
    },
  };
}

/**
 * Hook-friendly sanitizer that handles undefined
 */
export function useSanitizedHtml(
  html: string | undefined | null,
  config?: Config
): string {
  return sanitizeHtml(html, config);
}

export { DOMPurify, DEFAULT_CONFIG, STRICT_CONFIG };
export type { Config };
