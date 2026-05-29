import type { Model } from "mongoose";
import { buildNeedsIndexingFilter, markSolrIndexed, mongoChannelClause, solrChannelQuery, UNTAGGED_CHANNEL } from "./solr-sync-state";

export interface ConsolidationAdapter {
  bulkIndexProducts(products: any[]): Promise<{
    success: number; failed: number; errors: string[];
    succeeded: string[]; failedItems: { entity_code: string; error: string }[];
  }>;
  fetchAllEntityCodes(query?: string): Promise<string[]>;
  deleteByIds(ids: string[]): Promise<void>;
}

export interface ConsolidateParams {
  model: Model<any>;
  adapter: ConsolidationAdapter;
  channel?: string;
  removeStale?: boolean;
  batchSize?: number;
  entityCodes?: string[];
}

export interface ConsolidationResult {
  indexed: number;
  failed: number;
  removed: number;
  errors: string[];
}

/**
 * Re-align a channel's Solr search index to its published Mongo set:
 * re-index the products that are missing/stale, and optionally remove
 * Solr docs that are no longer published. Manual / on-demand only.
 */
export async function consolidateChannel(
  params: ConsolidateParams
): Promise<ConsolidationResult> {
  const { model, adapter, channel, removeStale = false, entityCodes } = params;
  const batchSize = params.batchSize ?? 50;
  const result: ConsolidationResult = { indexed: 0, failed: 0, removed: 0, errors: [] };

  // --- Re-index: explicit set if given, else the channel's needs-indexing set ---
  const indexFilter = entityCodes
    ? { isCurrent: true, entity_code: { $in: entityCodes } }
    : buildNeedsIndexingFilter(channel);
  const missing: any[] = await model.find(indexFilter).lean();
  for (let i = 0; i < missing.length; i += batchSize) {
    const batch = missing.slice(i, i + batchSize);
    const r = await adapter.bulkIndexProducts(batch);
    await markSolrIndexed(model, r.succeeded);
    result.indexed += r.succeeded.length;
    result.failed += r.failedItems.length;
    result.errors.push(...r.errors.slice(0, 10));
  }

  // --- Remove stale (in Solr for this channel, not currently published) ---
  if (removeStale) {
    const solrCodes = await adapter.fetchAllEntityCodes(solrChannelQuery(channel));
    if (solrCodes.length > 0) {
      const publishedFilter: Record<string, any> = {
        isCurrent: true,
        status: "published",
        ...mongoChannelClause(channel),
      };
      const publishedDocs: any[] = await model.find(publishedFilter, { entity_code: 1 }).lean();
      const publishedSet = new Set(publishedDocs.map((d) => d.entity_code));
      const stale = solrCodes.filter((c) => !publishedSet.has(c));
      if (stale.length > 0) {
        await adapter.deleteByIds(stale);
        result.removed = stale.length;
      }
    }
  }

  return result;
}

export interface ChannelGap {
  channel: string;
  published: number;
  indexed: number;
  missing: number;
  stale: number;
  in_sync: boolean;
}

export interface SyncScan {
  channels: ChannelGap[];
  totals: ChannelGap;
}

/** Distinct channels among current products, plus "(untagged)" if any product has none. */
export async function getScanChannels(model: Model<any>): Promise<string[]> {
  const distinct: string[] = await model.distinct("channels", { isCurrent: true });
  const channels = distinct.filter(Boolean);
  const untaggedCount = await model.countDocuments({
    isCurrent: true,
    $or: [{ channels: { $exists: false } }, { channels: { $size: 0 } }],
  });
  if (untaggedCount > 0) channels.push(UNTAGGED_CHANNEL);
  return channels;
}

/** On-demand per-channel gap between published (Mongo) and the Solr search index. */
export async function computeSyncScan(params: {
  model: Model<any>;
  adapter: Pick<ConsolidationAdapter, "fetchAllEntityCodes"> & {
    countByQuery(query: string): Promise<number>;
  };
  channels: string[];
}): Promise<SyncScan> {
  const { model, adapter, channels } = params;
  const rows: ChannelGap[] = [];

  for (const channel of channels) {
    const scope = mongoChannelClause(channel);
    const published = await model.countDocuments({
      isCurrent: true,
      status: "published",
      include_faceting: true,
      ...scope,
    });
    const missing = await model.countDocuments(buildNeedsIndexingFilter(channel));
    const indexed = await adapter.countByQuery(
      `${solrChannelQuery(channel)} AND include_faceting:true`
    );

    const solrCodes = await adapter.fetchAllEntityCodes(solrChannelQuery(channel));
    let stale = 0;
    if (solrCodes.length > 0) {
      const publishedDocs: any[] = await model
        .find({ isCurrent: true, status: "published", ...scope }, { entity_code: 1 })
        .lean();
      const publishedSet = new Set(publishedDocs.map((d) => d.entity_code));
      stale = solrCodes.filter((c) => !publishedSet.has(c)).length;
    }

    rows.push({ channel, published, indexed, missing, stale, in_sync: missing === 0 && stale === 0 });
  }

  const totals: ChannelGap = {
    channel: "TOTAL",
    published: rows.reduce((s, r) => s + r.published, 0),
    indexed: rows.reduce((s, r) => s + r.indexed, 0),
    missing: rows.reduce((s, r) => s + r.missing, 0),
    stale: rows.reduce((s, r) => s + r.stale, 0),
    in_sync: rows.every((r) => r.in_sync),
  };
  return { channels: rows, totals };
}
