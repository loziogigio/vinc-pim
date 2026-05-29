import type { Model } from "mongoose";
import { buildNeedsIndexingFilter, markSolrIndexed, mongoChannelClause, solrChannelQuery } from "./solr-sync-state";

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
