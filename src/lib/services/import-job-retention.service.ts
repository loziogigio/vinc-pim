/**
 * Import Job Retention Service
 *
 * Prunes old documents from `importjobs` and `associationjobs` so the
 * collections stay bounded. These job docs are operational logs of past
 * imports; they're not load-bearing for the catalog itself.
 *
 * What is always kept (cannot be deleted by any policy):
 *   - Any job in status `pending` or `processing` (still running)
 *   - The latest `keepLastN` jobs by `created_at`, regardless of age
 *   - Any job newer than `keepWithinDays` — UNLESS `keepWithinDays` is 0, which
 *     disables the age window entirely so `keepLastN` becomes a hard count cap.
 *
 * Everything else (terminal status, older than the window, beyond the safety
 * count) is deleted. Deletion runs BY QUERY (deleteMany) — we never materialise
 * the candidate _ids — so draining a tenant with hundreds of thousands of job
 * docs can't overflow Mongo's 16MB BSON limit. Idempotent and safe to re-run.
 *
 * Tunable per deploy via env (read once at worker start — restart/redeploy the
 * worker to change them; no rebuild needed):
 *   - VINC_IMPORT_JOB_KEEP_DAYS    (default 30; 0 = no age window)
 *   - VINC_IMPORT_JOB_KEEP_LAST_N  (default 1000)
 */

import { connectWithModels } from "@/lib/db/connection";
import { envInt } from "@/lib/utils/env";

export interface ImportJobRetentionPolicy {
  /** Always keep jobs newer than this many days. 0 disables the age window. Default: 30. */
  keepWithinDays: number;
  /** Always keep the N most recent jobs (per collection). Default: 1000. */
  keepLastN: number;
}

export interface CollectionPruneResult {
  collection: "importjobs" | "associationjobs";
  totalBefore: number;
  deleted: number;
  kept: number;
}

export interface ImportJobPruneResult {
  tenant_db: string;
  policy: ImportJobRetentionPolicy;
  collections: CollectionPruneResult[];
  totalDeleted: number;
  durationMs: number;
}

export interface ImportJobPrunePreview {
  tenant_db: string;
  policy: ImportJobRetentionPolicy;
  collections: { collection: string; totalBefore: number; candidatesForDeletion: number }[];
  totalCandidates: number;
}

export const DEFAULT_IMPORT_JOB_RETENTION_POLICY: ImportJobRetentionPolicy = {
  // 0 = no age window (pure keepLastN count cap). envInt honours a literal 0
  // (unlike `parseInt(x) || default`, which would coerce 0 → default).
  keepWithinDays: Math.max(0, envInt("VINC_IMPORT_JOB_KEEP_DAYS", 30)),
  keepLastN: Math.max(0, envInt("VINC_IMPORT_JOB_KEEP_LAST_N", 1000)),
};

const TERMINAL_STATUSES = ["completed", "failed", "cancelled"] as const;

export function resolvePolicy(
  partial?: Partial<ImportJobRetentionPolicy>
): ImportJobRetentionPolicy {
  return {
    // 0 = no age window (mirrors version-retention); never negative.
    keepWithinDays: Math.max(
      0,
      partial?.keepWithinDays ?? DEFAULT_IMPORT_JOB_RETENTION_POLICY.keepWithinDays
    ),
    keepLastN: Math.max(
      0,
      partial?.keepLastN ?? DEFAULT_IMPORT_JOB_RETENTION_POLICY.keepLastN
    ),
  };
}

/** keepWithinDays → cutoff Date, or null when the age window is disabled (0). */
function cutoffFor(keepWithinDays: number): Date | null {
  return keepWithinDays > 0
    ? new Date(Date.now() - keepWithinDays * 86_400_000)
    : null;
}

/**
 * Build the Mongo filter selecting job docs SAFE to delete: terminal status,
 * (optionally) older than `cutoff`, and outside the top-N safety window. Pure —
 * the single source of truth for "what is prunable", exported for unit tests.
 *
 * The only `_id` clause is the BOUNDED `$nin` of the newest N ids, so deletion
 * by this filter never builds an unbounded `_id:$in` array.
 */
export function buildImportJobDeleteFilter(
  cutoff: Date | null,
  topNIds: unknown[]
): Record<string, any> {
  const filter: Record<string, any> = {
    status: { $in: [...TERMINAL_STATUSES] },
  };
  if (cutoff) {
    filter.created_at = { $lt: cutoff };
  }
  if (topNIds.length > 0) {
    filter._id = { $nin: topNIds };
  }
  return filter;
}

/** Collect the _ids of the newest `keepLastN` jobs (any status) — the safety window. */
async function getTopNIds(Model: any, keepLastN: number): Promise<unknown[]> {
  if (keepLastN <= 0) return [];
  const topN: { _id: unknown }[] = await Model.find({}, { _id: 1 })
    .sort({ created_at: -1 })
    .limit(keepLastN)
    .lean();
  return topN.map((d) => d._id);
}

/**
 * Prune the two job collections for one tenant.
 */
export async function pruneImportJobsForTenant(
  tenantDb: string,
  policyOverride?: Partial<ImportJobRetentionPolicy>
): Promise<ImportJobPruneResult> {
  const policy = resolvePolicy(policyOverride);
  const cutoff = cutoffFor(policy.keepWithinDays);
  const startedAt = Date.now();

  const { ImportJob, AssociationJob } = await connectWithModels(tenantDb);

  const collections: CollectionPruneResult[] = [];
  let totalDeleted = 0;

  for (const [name, Model] of [
    ["importjobs", ImportJob],
    ["associationjobs", AssociationJob],
  ] as const) {
    const totalBefore = await Model.estimatedDocumentCount();
    if (totalBefore === 0) {
      collections.push({ collection: name, totalBefore: 0, deleted: 0, kept: 0 });
      continue;
    }

    const topNIds = await getTopNIds(Model, policy.keepLastN);
    const filter = buildImportJobDeleteFilter(cutoff, topNIds);

    // Delete by query: status:terminal is enforced atomically here (no
    // fetch-then-delete TOCTOU window), and there's no giant _id:$in to overflow
    // BSON even when hundreds of thousands of docs become deletable at once.
    const result = await Model.deleteMany(filter);

    const deleted = result.deletedCount ?? 0;
    totalDeleted += deleted;
    collections.push({
      collection: name,
      totalBefore,
      deleted,
      kept: totalBefore - deleted,
    });
  }

  return {
    tenant_db: tenantDb,
    policy,
    collections,
    totalDeleted,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Dry-run: count how many job docs *would* be deleted, without touching them.
 */
export async function getImportJobPrunePreview(
  tenantDb: string,
  policyOverride?: Partial<ImportJobRetentionPolicy>
): Promise<ImportJobPrunePreview> {
  const policy = resolvePolicy(policyOverride);
  const cutoff = cutoffFor(policy.keepWithinDays);

  const { ImportJob, AssociationJob } = await connectWithModels(tenantDb);

  const out: ImportJobPrunePreview = {
    tenant_db: tenantDb,
    policy,
    collections: [],
    totalCandidates: 0,
  };

  for (const [name, Model] of [
    ["importjobs", ImportJob],
    ["associationjobs", AssociationJob],
  ] as const) {
    const totalBefore = await Model.estimatedDocumentCount();
    let candidatesForDeletion = 0;
    if (totalBefore > 0) {
      const topNIds = await getTopNIds(Model, policy.keepLastN);
      const filter = buildImportJobDeleteFilter(cutoff, topNIds);
      candidatesForDeletion = await Model.countDocuments(filter);
    }
    out.collections.push({
      collection: name,
      totalBefore,
      candidatesForDeletion,
    });
    out.totalCandidates += candidatesForDeletion;
  }

  return out;
}
