/**
 * PIM Batch Sync Service
 * Handles cleanup (remove from Solr) and resync (re-index to Solr)
 */

import { connectWithModels } from "@/lib/db/connection";
import { loadAdapterConfigs, SolrAdapter } from "@/lib/adapters";
import { isSolrEnabled } from "@/config/project.config";
import {
  calculateCompletenessScore,
  findCriticalIssues,
} from "@/lib/pim/scorer";
import {
  loadEmbeddingContext,
  rebuildProductEmbeddings,
  type EmbeddingContext,
} from "@/lib/services/category.service";
import crypto from "crypto";

// ============================================
// TYPES
// ============================================

export const VALID_CLEANUP_MODES = [
  "clear_all",
  "by_score",
  "by_missing_fields",
  "stale",
  "none",
] as const;

export type CleanupMode = (typeof VALID_CLEANUP_MODES)[number];

export const VALID_REQUIRED_FIELDS = [
  "image",
  "brand",
  "category",
  "product_type",
  "specs",
] as const;

export type RequiredField = (typeof VALID_REQUIRED_FIELDS)[number];

export interface BatchSyncParams {
  tenantId: string;
  tenantDb: string;
  startedBy: string;
  cleanup_mode: CleanupMode;
  cleanup_min_score: number;
  cleanup_required_fields: RequiredField[];
  resync: boolean;
  resync_min_score: number;
  recalculate_scores: boolean;
  rebuild_embeddings: boolean;
  batch_size: number;
  dry_run: boolean;
}

export interface CleanupResult {
  mode: string;
  removed_count?: number;
  would_remove?: number;
  unpublished_count?: number;
  affected_products?: { entity_code: string; missing_fields?: string[] }[];
}

export interface ResyncResult {
  total: number;
  eligible: number;
  indexed: number;
  failed: number;
  batches_processed: number;
  score_updates: number;
  embedding_updates: number;
  errors: string[];
  eligible_products?: {
    entity_code: string;
    sku: string;
    name: string;
    completeness_score: number;
  }[];
}

export interface BatchSyncResult {
  dry_run: boolean;
  job_id?: string;
  cleanup?: CleanupResult;
  resync?: ResyncResult;
}

// ============================================
// FIELD CHECKS
// ============================================

type FieldChecker = (product: any) => boolean;

const MISSING_FIELD_CHECKS: Record<RequiredField, FieldChecker> = {
  image: (p) => !p.images?.length || !p.images[0]?.url,
  brand: (p) => !p.brand?.brand_id,
  category: (p) => !p.category?.category_id,
  product_type: (p) => !p.product_type?.product_type_id,
  specs: (p) => {
    const specs = p.technical_specifications;
    if (!specs) return true;
    if (typeof specs === "object" && !Array.isArray(specs)) {
      return !Object.values(specs).some(
        (arr) => Array.isArray(arr) && arr.length > 0
      );
    }
    return !Array.isArray(specs) || specs.length === 0;
  },
};

// ============================================
// MAIN SERVICE
// ============================================

export async function executeBatchSync(
  params: BatchSyncParams
): Promise<BatchSyncResult> {
  if (!isSolrEnabled()) {
    throw new Error("Solr is not enabled for this tenant");
  }

  const configs = loadAdapterConfigs(params.tenantId);
  const adapter = new SolrAdapter(configs.solr);
  await adapter.initialize();

  const { PIMProduct, BatchSyncLog } = await connectWithModels(params.tenantDb);

  // Create log entry (skip for dry runs)
  let logId: string | undefined;
  const jobId = `bs_${crypto.randomBytes(8).toString("hex")}`;

  if (!params.dry_run) {
    const log = await BatchSyncLog.create({
      job_id: jobId,
      status: "running",
      params: {
        cleanup_mode: params.cleanup_mode,
        cleanup_min_score: params.cleanup_min_score,
        cleanup_required_fields: params.cleanup_required_fields,
        resync: params.resync,
        resync_min_score: params.resync_min_score,
        recalculate_scores: params.recalculate_scores,
        rebuild_embeddings: params.rebuild_embeddings,
        batch_size: params.batch_size,
      },
      started_by: params.startedBy,
    });
    logId = log._id;
  }

  try {
    // Phase 1: Cleanup
    let cleanupResult: CleanupResult | undefined;
    if (params.cleanup_mode !== "none") {
      cleanupResult = await performCleanup(adapter, PIMProduct, params);
    }

    // Phase 2: Resync
    let resyncResult: ResyncResult | undefined;
    if (params.resync) {
      resyncResult = await performResync(adapter, PIMProduct, params);
    }

    // Update log on success
    if (logId) {
      await BatchSyncLog.updateOne(
        { _id: logId },
        {
          $set: {
            status: "completed",
            cleanup_result: cleanupResult,
            resync_result: resyncResult,
            duration_ms: Date.now() - Date.now(), // will be set by route
          },
        }
      );
    }

    return {
      dry_run: params.dry_run,
      job_id: params.dry_run ? undefined : jobId,
      cleanup: cleanupResult,
      resync: resyncResult,
    };
  } catch (error: any) {
    // Update log on failure
    if (logId) {
      await BatchSyncLog.updateOne(
        { _id: logId },
        {
          $set: {
            status: "failed",
            error_message: error.message,
          },
        }
      );
    }
    throw error;
  }
}

// ============================================
// CLEANUP PHASE
// ============================================

async function performCleanup(
  adapter: SolrAdapter,
  PIMProduct: any,
  params: BatchSyncParams
): Promise<CleanupResult> {
  switch (params.cleanup_mode) {
    case "clear_all":
      return cleanupClearAll(adapter, params.dry_run);
    case "by_score":
      return cleanupByScore(adapter, PIMProduct, params.cleanup_min_score, params.dry_run);
    case "by_missing_fields":
      return cleanupByMissingFields(
        adapter,
        PIMProduct,
        params.cleanup_required_fields,
        params.dry_run
      );
    case "stale":
      return cleanupStale(adapter, PIMProduct, params.dry_run);
    default:
      return { mode: "none" };
  }
}

async function cleanupClearAll(
  adapter: SolrAdapter,
  dryRun: boolean
): Promise<CleanupResult> {
  if (dryRun) {
    const count = await adapter.countByQuery("*:*");
    return { mode: "clear_all", would_remove: count };
  }

  await adapter.clearIndex();
  return { mode: "clear_all", removed_count: -1 }; // -1 = all
}

async function cleanupByScore(
  adapter: SolrAdapter,
  PIMProduct: any,
  minScore: number,
  dryRun: boolean
): Promise<CleanupResult> {
  // Solr range: [0 TO minScore} means exclusive upper bound
  const query = `completeness_score:[0 TO ${minScore}}`;

  if (dryRun) {
    const count = await adapter.countByQuery(query);
    return { mode: "by_score", would_remove: count };
  }

  // Fetch entity_codes before deleting so we can unpublish in MongoDB
  const entityCodes = await adapter.fetchAllEntityCodes(query);
  const count = entityCodes.length;

  await adapter.deleteByQuery(query);

  // Unpublish in MongoDB to keep aligned
  if (entityCodes.length > 0) {
    await PIMProduct.updateMany(
      { isCurrent: true, entity_code: { $in: entityCodes } },
      { $set: { status: "draft" } }
    );
  }

  return { mode: "by_score", removed_count: count, unpublished_count: count };
}

async function cleanupByMissingFields(
  adapter: SolrAdapter,
  PIMProduct: any,
  requiredFields: RequiredField[],
  dryRun: boolean
): Promise<CleanupResult> {
  if (requiredFields.length === 0) {
    return { mode: "by_missing_fields", would_remove: 0 };
  }

  const products = await PIMProduct.find({
    isCurrent: true,
    status: "published",
  })
    .select(
      "entity_code images brand category product_type technical_specifications"
    )
    .lean();

  const affected: { entity_code: string; missing_fields: string[] }[] = [];
  for (const product of products) {
    const missing = requiredFields.filter(
      (f) => MISSING_FIELD_CHECKS[f]?.(product)
    );
    if (missing.length > 0) {
      affected.push({ entity_code: product.entity_code, missing_fields: missing });
    }
  }

  // Check which affected products are actually in Solr
  const BATCH_CHECK_SIZE = 100;
  const inSolr: { entity_code: string; missing_fields: string[] }[] = [];

  for (let i = 0; i < affected.length; i += BATCH_CHECK_SIZE) {
    const batch = affected.slice(i, i + BATCH_CHECK_SIZE);
    const codes = batch.map((a) => `"${a.entity_code}"`).join(" OR ");
    const query = `entity_code:(${codes})`;
    const count = await adapter.countByQuery(query);
    if (count > 0) {
      // We know some are in Solr; check individually for accurate reporting
      for (const item of batch) {
        const itemCount = await adapter.countByQuery(
          `entity_code:"${item.entity_code}"`
        );
        if (itemCount > 0) inSolr.push(item);
      }
    }
  }

  if (dryRun) {
    return {
      mode: "by_missing_fields",
      would_remove: inSolr.length,
      affected_products: inSolr.slice(0, 20),
    };
  }

  // Batch delete from Solr + unpublish in MongoDB
  const allAffectedCodes = affected.map((a) => a.entity_code);

  if (inSolr.length > 0) {
    for (let i = 0; i < inSolr.length; i += BATCH_CHECK_SIZE) {
      const batch = inSolr.slice(i, i + BATCH_CHECK_SIZE);
      const codes = batch.map((a) => `"${a.entity_code}"`).join(" OR ");
      await adapter.deleteByQuery(`entity_code:(${codes})`);
    }
  }

  // Unpublish all affected products in MongoDB (keep Solr and MongoDB aligned)
  if (allAffectedCodes.length > 0) {
    await PIMProduct.updateMany(
      { isCurrent: true, entity_code: { $in: allAffectedCodes } },
      { $set: { status: "draft" } }
    );
  }

  return {
    mode: "by_missing_fields",
    removed_count: inSolr.length,
    unpublished_count: allAffectedCodes.length,
  };
}

async function cleanupStale(
  adapter: SolrAdapter,
  PIMProduct: any,
  dryRun: boolean
): Promise<CleanupResult> {
  // Get all entity_codes from Solr
  const solrCodes = await adapter.fetchAllEntityCodes();
  if (solrCodes.length === 0) {
    return { mode: "stale", [dryRun ? "would_remove" : "removed_count"]: 0 };
  }

  // Get all published entity_codes from MongoDB
  const publishedDocs = await PIMProduct.find({
    isCurrent: true,
    status: "published",
  })
    .select("entity_code")
    .lean();
  const publishedSet = new Set(publishedDocs.map((p: any) => p.entity_code));

  // Find stale: in Solr but not published in MongoDB
  const staleCodes = solrCodes.filter((code) => !publishedSet.has(code));

  if (dryRun) {
    return {
      mode: "stale",
      would_remove: staleCodes.length,
      affected_products: staleCodes.slice(0, 20).map((code) => ({
        entity_code: code,
      })),
    };
  }

  // Batch delete stale docs from Solr
  const BATCH_DELETE_SIZE = 100;
  for (let i = 0; i < staleCodes.length; i += BATCH_DELETE_SIZE) {
    const batch = staleCodes.slice(i, i + BATCH_DELETE_SIZE);
    const codes = batch.map((c) => `"${c}"`).join(" OR ");
    await adapter.deleteByQuery(`entity_code:(${codes})`);
  }

  return { mode: "stale", removed_count: staleCodes.length };
}

// ============================================
// RESYNC PHASE
// ============================================

async function performResync(
  adapter: SolrAdapter,
  PIMProduct: any,
  params: BatchSyncParams
): Promise<ResyncResult> {
  // Pre-load embedding context if rebuild is requested
  let embeddingCtx: EmbeddingContext | null = null;
  if (params.rebuild_embeddings) {
    embeddingCtx = await loadEmbeddingContext(params.tenantDb);
  }

  const cursor = PIMProduct.find({
    isCurrent: true,
    status: "published",
  })
    .lean()
    .cursor();

  let processed = 0;
  let eligible = 0;
  let indexed = 0;
  let failed = 0;
  let scoreUpdateCount = 0;
  let embeddingUpdateCount = 0;
  const errors: string[] = [];
  const eligiblePreview: ResyncResult["eligible_products"] = [];

  let batch: any[] = [];
  const scoreUpdates: {
    _id: any;
    score: number;
    issues: string[];
  }[] = [];
  const embeddingUpdates: {
    _id: any;
    category?: any;
    brand?: any;
    channels?: string[];
  }[] = [];

  for await (const product of cursor) {
    processed++;

    // Rebuild embedded entities from source data
    if (embeddingCtx) {
      const oldCategory = product.category ? JSON.stringify(product.category) : null;
      const oldBrand = product.brand ? JSON.stringify(product.brand) : null;
      const oldChannels = JSON.stringify(product.channels || []);

      rebuildProductEmbeddings(product, embeddingCtx);

      const catChanged = oldCategory !== (product.category ? JSON.stringify(product.category) : null);
      const brandChanged = oldBrand !== (product.brand ? JSON.stringify(product.brand) : null);
      const channelsChanged = oldChannels !== JSON.stringify(product.channels || []);

      if (catChanged || brandChanged || channelsChanged) {
        const update: { _id: any; category?: any; brand?: any; channels?: string[] } = { _id: product._id };
        if (catChanged) update.category = product.category;
        if (brandChanged) update.brand = product.brand;
        if (channelsChanged) update.channels = product.channels;
        embeddingUpdates.push(update);
      }
    }

    let score = product.completeness_score ?? 0;
    let issues = product.critical_issues ?? [];

    if (params.recalculate_scores) {
      score = calculateCompletenessScore(product);
      issues = findCriticalIssues(product);
      if (score !== product.completeness_score) {
        scoreUpdates.push({ _id: product._id, score, issues });
      }
    }

    if (score < params.resync_min_score) continue;
    eligible++;

    if (params.dry_run) {
      if (eligiblePreview!.length < 20) {
        const name = product.name;
        const displayName =
          typeof name === "string"
            ? name
            : name?.it || name?.en || Object.values(name || {})[0] || "";
        eligiblePreview!.push({
          entity_code: product.entity_code,
          sku: product.sku,
          name: displayName as string,
          completeness_score: score,
        });
      }
      continue;
    }

    // Inject recalculated score for indexing
    product.completeness_score = score;
    product.critical_issues = issues;
    batch.push(product);

    if (batch.length >= params.batch_size) {
      const result = await adapter.bulkIndexProducts(batch);
      indexed += result.success;
      failed += result.failed;
      if (result.errors.length) errors.push(...result.errors);
      batch = [];
    }
  }

  // Flush remaining batch
  if (batch.length > 0 && !params.dry_run) {
    const result = await adapter.bulkIndexProducts(batch);
    indexed += result.success;
    failed += result.failed;
    if (result.errors.length) errors.push(...result.errors);
  }

  // Persist updated scores to MongoDB
  if (scoreUpdates.length > 0 && !params.dry_run) {
    const BULK_WRITE_SIZE = 200;
    for (let i = 0; i < scoreUpdates.length; i += BULK_WRITE_SIZE) {
      const chunk = scoreUpdates.slice(i, i + BULK_WRITE_SIZE);
      await PIMProduct.bulkWrite(
        chunk.map((u: { _id: any; score: number; issues: string[] }) => ({
          updateOne: {
            filter: { _id: u._id },
            update: {
              $set: {
                completeness_score: u.score,
                critical_issues: u.issues,
              },
            },
          },
        }))
      );
    }
  }

  // Persist rebuilt embeddings to MongoDB
  if (embeddingUpdates.length > 0 && !params.dry_run) {
    const BULK_WRITE_SIZE = 200;
    for (let i = 0; i < embeddingUpdates.length; i += BULK_WRITE_SIZE) {
      const chunk = embeddingUpdates.slice(i, i + BULK_WRITE_SIZE);
      await PIMProduct.bulkWrite(
        chunk.map((u) => {
          const $set: any = {};
          if (u.category) $set.category = u.category;
          if (u.brand) $set.brand = u.brand;
          if (u.channels) $set.channels = u.channels;
          return {
            updateOne: {
              filter: { _id: u._id },
              update: { $set },
            },
          };
        })
      );
    }
  }

  scoreUpdateCount = scoreUpdates.length;
  embeddingUpdateCount = embeddingUpdates.length;

  if (params.dry_run) {
    return {
      total: processed,
      eligible,
      indexed: 0,
      failed: 0,
      batches_processed: 0,
      score_updates: scoreUpdateCount,
      embedding_updates: embeddingUpdateCount,
      errors: [],
      eligible_products: eligiblePreview,
    };
  }

  return {
    total: processed,
    eligible,
    indexed,
    failed,
    batches_processed: Math.ceil(eligible / params.batch_size),
    score_updates: scoreUpdateCount,
    embedding_updates: embeddingUpdateCount,
    errors: errors.slice(0, 20), // Limit error list
  };
}
