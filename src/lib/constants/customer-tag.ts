/**
 * Customer Tag Constants
 *
 * Structured tags for customer segmentation: prefix:code format.
 * Used for price list visibility, promotion filtering, and campaign targeting.
 */

// ============================================
// TAG PREFIXES (categories)
// ============================================

/**
 * Well-known tag prefixes.
 * Custom prefixes are allowed — this list is for UI suggestions and validation hints.
 */
export const TAG_PREFIXES = [
  "categoria-di-sconto",
  "categoria-clienti",
  "categoria-acquisto-medio-mensile",
] as const;

export type TagPrefix = (typeof TAG_PREFIXES)[number];

/**
 * Human-readable labels for well-known prefixes.
 */
export const TAG_PREFIX_LABELS: Record<TagPrefix, string> = {
  "categoria-di-sconto": "Categoria di sconto",
  "categoria-clienti": "Categoria clienti",
  "categoria-acquisto-medio-mensile": "Acquisto medio mensile",
};

/**
 * Descriptions for well-known prefixes.
 */
export const TAG_PREFIX_DESCRIPTIONS: Record<TagPrefix, string> = {
  "categoria-di-sconto": "Classe di sconto base applicata al cliente (es. -45%, -50%)",
  "categoria-clienti": "Settore o tipologia del cliente (es. idraulico, ferramenta)",
  "categoria-acquisto-medio-mensile": "Fascia di acquisto medio mensile del cliente",
};

// ============================================
// HELPERS
// ============================================

/**
 * Build a full_tag string from prefix and code.
 */
export function buildFullTag(prefix: string, code: string): string {
  return `${prefix}:${code}`;
}

/**
 * Parse a full_tag string into prefix and code.
 * Returns null if the format is invalid.
 */
export function parseFullTag(fullTag: string): { prefix: string; code: string } | null {
  const colonIndex = fullTag.indexOf(":");
  if (colonIndex <= 0 || colonIndex === fullTag.length - 1) return null;
  return {
    prefix: fullTag.substring(0, colonIndex),
    code: fullTag.substring(colonIndex + 1),
  };
}

/**
 * Validate a tag prefix (kebab-case, no colons).
 */
export function isValidPrefix(prefix: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(prefix);
}

/**
 * Validate a tag code (kebab-case, no colons).
 */
export function isValidCode(code: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(code);
}
