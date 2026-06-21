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

// ============================================
// AGENT TAGS (reserved prefix, import-managed)
// ============================================

/**
 * Reserved tag prefix for sales-agent targeting.
 * Agent tags (`agente:<code>`) are auto-created and assigned by the customer
 * import from the ERP agent code; they must NOT be created manually.
 */
export const AGENT_TAG_PREFIX = "agente";

/** Human-readable label + description for the reserved agent prefix. */
export const AGENT_TAG_PREFIX_LABEL = "Agente";
export const AGENT_TAG_PREFIX_DESCRIPTION =
  "Agente di vendita assegnato al cliente (sincronizzato dall'ERP)";

/**
 * Normalize a raw ERP agent code into a valid tag code (lowercase kebab).
 * Returns null when the input is empty/blank or contains no alphanumerics.
 */
export function normalizeAgentCode(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const slug = String(raw)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : null;
}

/**
 * Build the full agent tag (`agente:<code>`) from a raw agent code.
 * Returns null when the code normalizes to nothing.
 */
export function agentFullTag(raw: string | null | undefined): string | null {
  const code = normalizeAgentCode(raw);
  return code ? buildFullTag(AGENT_TAG_PREFIX, code) : null;
}

/** True when a full_tag belongs to the reserved agent prefix. */
export function isAgentTag(fullTag: string): boolean {
  return fullTag.startsWith(`${AGENT_TAG_PREFIX}:`);
}
