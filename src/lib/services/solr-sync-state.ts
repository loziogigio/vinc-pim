/**
 * Solr Sync State Utilities
 *
 * Centralizes logic for:
 * 1. Building the Mongo filter for products that need Solr indexing
 * 2. Stamping solr_indexed_at without bumping updated_at
 */

import type { Model } from "mongoose";

/**
 * Build the Mongo filter for products that should be in the Solr search index
 * but are not (yet) or whose index copy is stale relative to the last edit.
 *
 * "Needs indexing" = isCurrent + published + include_faceting AND
 * (never synced OR synced before the last update).
 *
 * @param channel - Optional channel filter (e.g., "b2b", "b2c")
 * @returns MongoDB filter object
 */
export function buildNeedsIndexingFilter(channel?: string): Record<string, any> {
  const filter: Record<string, any> = {
    isCurrent: true,
    status: "published",
    include_faceting: true,
    $or: [
      { solr_indexed_at: { $exists: false } },
      { solr_indexed_at: null },
      { $expr: { $lt: ["$solr_indexed_at", "$updated_at"] } },
    ],
  };
  if (channel) {
    filter.channels = channel;
  }
  return filter;
}

/**
 * Stamp solr_indexed_at = now for the given entity_codes, WITHOUT bumping
 * updated_at (timestamps:false) — otherwise solr_indexed_at < updated_at could
 * never become false and every product would look perpetually stale.
 *
 * @param model - Mongoose model instance
 * @param entityCodes - Array of entity_code values to mark as indexed
 */
export async function markSolrIndexed(
  model: Model<any>,
  entityCodes: string[]
): Promise<void> {
  if (!entityCodes.length) return;
  await model.updateMany(
    { entity_code: { $in: entityCodes } },
    { $set: { solr_indexed_at: new Date() } },
    { timestamps: false }
  );
}
