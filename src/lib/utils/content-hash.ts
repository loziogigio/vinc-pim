/**
 * Stable content hashing for PIM products.
 *
 * Used by the importer to skip re-writing/re-versioning a product whose content
 * is byte-identical to the stored current version — the single biggest lever for
 * import speed and version-bloat avoidance on repeated full syncs.
 */
import { createHash } from "node:crypto";

/**
 * Top-level keys that are computed/metadata, not source content — excluded from
 * the hash so a re-import with identical content always produces the same hash
 * regardless of version/timestamps/derived fields.
 */
export const CONTENT_HASH_EXCLUDE = new Set<string>([
  "_id", "__v", "version", "isCurrent", "isCurrentPublished",
  "status", "published_at", "source", "completeness_score", "critical_issues",
  "auto_publish_eligible", "auto_publish_reason", "analytics", "locked_fields",
  "manually_edited", "edited_by", "edited_at", "created_at", "updated_at",
  "content_hash",
]);

/** Deterministic JSON: object keys sorted recursively so key order can't change the hash. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}

/**
 * SHA-256 over the product's content, ignoring the top-level computed/metadata keys.
 * Two imports with the same source content yield the same hash.
 */
export function contentHash(
  obj: Record<string, unknown>,
  exclude: Set<string> = CONTENT_HASH_EXCLUDE
): string {
  const filtered: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) if (!exclude.has(k)) filtered[k] = obj[k];
  return createHash("sha256").update(stableStringify(filtered)).digest("hex");
}
