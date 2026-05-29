/**
 * Solr Sync State Utilities
 *
 * Centralizes logic for:
 * 1. Building the Mongo filter for products that need Solr indexing
 * 2. Stamping solr_indexed_at without bumping updated_at
 */

import type { Model } from "mongoose";

/**
 * Sentinel value that represents products with no channel assignment
 * (channels field absent or empty array).
 */
export const UNTAGGED_CHANNEL = "(untagged)";

/** Mongo clause selecting docs for a channel scope. */
export function mongoChannelClause(channel?: string): Record<string, any> {
  if (channel === UNTAGGED_CHANNEL) {
    return { $or: [{ channels: { $exists: false } }, { channels: { $size: 0 } }] };
  }
  if (channel) return { channels: channel };
  return {};
}

/** Solr q/fq string selecting docs for a channel scope. */
export function solrChannelQuery(channel?: string): string {
  if (channel === UNTAGGED_CHANNEL) return "-channels:[* TO *]";
  if (channel) return `channels:${channel}`;
  return "*:*";
}

/**
 * Build the Mongo filter for products that should be in the Solr search index
 * but are not (yet) or whose index copy is stale relative to the last edit.
 * "Needs indexing" = isCurrent + published + include_faceting AND
 * (never synced OR synced before the last update), scoped to a channel.
 *
 * @param channel - Optional channel filter (e.g., "b2b", "b2c", UNTAGGED_CHANNEL)
 * @returns MongoDB filter object
 */
export function buildNeedsIndexingFilter(channel?: string): Record<string, any> {
  const staleClause = {
    $or: [
      { solr_indexed_at: { $exists: false } },
      { solr_indexed_at: null },
      { $expr: { $lt: ["$solr_indexed_at", "$updated_at"] } },
    ],
  };
  const filter: Record<string, any> = {
    isCurrent: true,
    status: "published",
    include_faceting: true,
  };
  if (channel === UNTAGGED_CHANNEL) {
    // $and avoids colliding with staleClause's $or key.
    filter.$and = [staleClause, mongoChannelClause(channel)];
  } else {
    Object.assign(filter, staleClause);
    if (channel) filter.channels = channel;
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
