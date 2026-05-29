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

export interface GapDetailParams {
  model: Model<any>;
  adapter: Pick<ConsolidationAdapter, "fetchAllEntityCodes">;
  channel?: string;
  type: "missing" | "stale";
  page: number;
  limit: number;
  q?: string;
}

export interface GapDetailRow {
  entity_code: string;
  sku?: string;
  name?: any;
  status?: string;
  source_job_id?: string;
  solr_indexed_at?: Date | null;
}

const GAP_DETAIL_PROJECTION = {
  entity_code: 1, sku: 1, name: 1, status: 1,
  "source.job_id": 1, solr_indexed_at: 1,
};

function toGapRow(d: any): GapDetailRow {
  return {
    entity_code: d.entity_code,
    sku: d.sku,
    name: d.name,
    status: d.status,
    source_job_id: d.source?.job_id,
    solr_indexed_at: d.solr_indexed_at ?? null,
  };
}

export async function listGapDetail(params: GapDetailParams): Promise<{
  items: GapDetailRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const { model, adapter, channel, type, page, limit, q } = params;
  const skip = (page - 1) * limit;

  if (type === "missing") {
    const filter: Record<string, any> = buildNeedsIndexingFilter(channel);
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$and = [...(filter.$and ?? []), { $or: [{ entity_code: rx }, { sku: rx }, { "name.it": rx }] }];
    }
    const [docs, total] = await Promise.all([
      model.find(filter, GAP_DETAIL_PROJECTION).sort({ entity_code: 1 }).skip(skip).limit(limit).lean(),
      model.countDocuments(filter),
    ]);
    return {
      items: (docs as any[]).map(toGapRow),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // stale: Solr codes for the channel that are not currently published.
  const solrCodes = await adapter.fetchAllEntityCodes(solrChannelQuery(channel));
  const publishedDocs: any[] = await model
    .find({ isCurrent: true, status: "published", ...mongoChannelClause(channel) }, { entity_code: 1 })
    .lean();
  const publishedSet = new Set(publishedDocs.map((d) => d.entity_code));
  let stale = solrCodes.filter((c) => !publishedSet.has(c));
  if (q) {
    const lc = q.toLowerCase();
    stale = stale.filter((c) => c.toLowerCase().includes(lc));
  }
  stale.sort();
  const total = stale.length;
  const pageCodes = stale.slice(skip, skip + limit);
  // Hydrate whatever Mongo still has for these codes (orphans may be absent / non-published).
  const hydrated: any[] = await model
    .find({ entity_code: { $in: pageCodes } }, GAP_DETAIL_PROJECTION)
    .lean();
  const byCode = new Map(hydrated.map((d) => [d.entity_code, d]));
  const items = pageCodes.map((code) =>
    byCode.has(code) ? toGapRow(byCode.get(code)) : { entity_code: code }
  );
  return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

// ============================================================
// Async consolidation job helpers (BatchSyncLog lifecycle)
// ============================================================

export type ConsolidationOperation = "reindex" | "remove-stale";

export async function createConsolidationLog(
  BatchSyncLog: Model<any>,
  opts: { startedBy: string; operation: ConsolidationOperation; channel?: string; entityCodesCount?: number }
): Promise<{ job_id: string }> {
  const job_id = `consol-${opts.operation}-${Date.now()}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  await BatchSyncLog.create({
    job_id,
    status: "running",
    params: {
      operation: opts.operation,
      channel: opts.channel ?? null,
      entity_codes_count: opts.entityCodesCount ?? null,
    },
    started_by: opts.startedBy,
  });
  return { job_id };
}

export async function runConsolidation(
  BatchSyncLog: Model<any>,
  job_id: string,
  params: {
    model: Model<any>;
    adapter: ConsolidationAdapter;
    channel?: string;
    removeStale?: boolean;
    entityCodes?: string[];
  }
): Promise<void> {
  const startedAt = Date.now();
  try {
    const result = await consolidateChannel({
      model: params.model,
      adapter: params.adapter,
      channel: params.channel,
      removeStale: params.removeStale,
      entityCodes: params.entityCodes,
    });
    await BatchSyncLog.updateOne(
      { job_id },
      {
        $set: {
          status: "completed",
          duration_ms: Date.now() - startedAt,
          // Reuse resync_result so the existing Activity History UI renders it.
          resync_result: {
            total: result.indexed + result.failed,
            eligible: result.indexed + result.failed,
            indexed: result.indexed,
            failed: result.failed,
            batches_processed: 0,
            score_updates: 0,
            errors: result.errors,
          },
          cleanup_result: { mode: "remove_stale", removed_count: result.removed },
        },
      }
    );
  } catch (err: any) {
    await BatchSyncLog.updateOne(
      { job_id },
      { $set: { status: "failed", duration_ms: Date.now() - startedAt, error_message: err?.message ?? String(err) } }
    );
  }
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
