/**
 * Correlation Constants
 *
 * Constants for product correlations (related products, accessories, etc.)
 */

// Correlation types
export const CORRELATION_TYPES = [
  "related", // Articoli correlati (Phase 1)
  // Future types:
  // "accessory",
  // "alternative",
  // "spare_part",
  // "upsell",
  // "cross_sell",
  // "consumable",
  // "required",
] as const;

export type CorrelationType = (typeof CORRELATION_TYPES)[number];

// Human-readable labels
export const CORRELATION_TYPE_LABELS: Record<CorrelationType, string> = {
  related: "Articoli Correlati",
  // accessory: "Accessori",
  // alternative: "Alternative",
  // spare_part: "Ricambi",
  // upsell: "Upgrade",
  // cross_sell: "Complementari",
  // consumable: "Consumabili",
  // required: "Richiesti",
};

// Sync modes for ERP import
export const CORRELATION_SYNC_MODES = ["replace", "merge"] as const;

export type CorrelationSyncMode = (typeof CORRELATION_SYNC_MODES)[number];

export const CORRELATION_SYNC_MODE_LABELS: Record<CorrelationSyncMode, string> = {
  replace: "Sostituisci tutto",
  merge: "Unisci (aggiungi nuovi)",
};

// Limits
export const CORRELATION_LIMITS = {
  MAX_PER_PRODUCT_PER_TYPE: 20,
  MAX_IMPORT_BATCH_SIZE: 10000,
} as const;

// Bidirectional transform for S/N values from ERP
export function parseBidirectionalFlag(value: string | boolean): boolean {
  if (typeof value === "boolean") return value;
  const normalized = String(value).toUpperCase().trim();
  return normalized === "S" || normalized === "TRUE" || normalized === "1" || normalized === "YES";
}
