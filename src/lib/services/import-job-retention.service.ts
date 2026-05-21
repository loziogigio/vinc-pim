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
 *   - Any job newer than `keepWithinDays`
 *
 * Everything else (terminal status, older than the window, beyond the
 * safety count) is deleted. Idempotent and safe to re-run.
 */

import { connectWithModels } from "@/lib/db/connection";

export interface ImportJobRetentionPolicy {
  /** Always keep jobs newer than this many days. Default: 30. */
  keepWithinDays: number;
  /** Always keep the N most recent jobs (per collection). Default: 100. */
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
  keepWithinDays:
    parseInt(process.env.VINC_IMPORT_JOB_KEEP_DAYS || "30", 10) || 30,
  keepLastN:
    parseInt(process.env.VINC_IMPORT_JOB_KEEP_LAST_N || "100", 10) || 100,
};

const TERMINAL_STATUSES = ["completed", "failed", "cancelled"] as const;

function resolvePolicy(
  partial?: Partial<ImportJobRetentionPolicy>
): ImportJobRetentionPolicy {
  return {
    keepWithinDays: Math.max(
      1,
      partial?.keepWithinDays ?? DEFAULT_IMPORT_JOB_RETENTION_POLICY.keepWithinDays
    ),
    keepLastN: Math.max(
      0,
      partial?.keepLastN ?? DEFAULT_IMPORT_JOB_RETENTION_POLICY.keepLastN
    ),
  };
}

/**
 * Find _ids of jobs that are SAFE to delete under the policy: terminal status,
 * older than the cutoff, and outside the top-N safety window. Done as an
 * aggregation so the heavy work stays in the database.
 */
async function findDeletableIds(
  Model: any,
  cutoff: Date,
  keepLastN: number
): Promise<unknown[]> {
  // Top-N protection: collect the _ids of the N most recent jobs (any status).
  const topN: { _id: unknown }[] =
    keepLastN > 0
      ? await Model.find({}, { _id: 1 })
          .sort({ created_at: -1 })
          .limit(keepLastN)
          .lean()
      : [];
  const topNIds = topN.map((d) => d._id);

  const query: Record<string, any> = {
    status: { $in: TERMINAL_STATUSES },
    created_at: { $lt: cutoff },
  };
  if (topNIds.length > 0) {
    query._id = { $nin: topNIds };
  }

  const candidates: { _id: unknown }[] = await Model.find(query, { _id: 1 }).lean();
  return candidates.map((d) => d._id);
}

/**
 * Prune the two job collections for one tenant.
 */
export async function pruneImportJobsForTenant(
  tenantDb: string,
  policyOverride?: Partial<ImportJobRetentionPolicy>
): Promise<ImportJobPruneResult> {
  const policy = resolvePolicy(policyOverride);
  const cutoff = new Date(Date.now() - policy.keepWithinDays * 86_400_000);
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

    const idsToDelete = await findDeletableIds(Model, cutoff, policy.keepLastN);

    if (idsToDelete.length === 0) {
      collections.push({ collection: name, totalBefore, deleted: 0, kept: totalBefore });
      continue;
    }

    // Defense in depth — only delete terminal-status docs, even if the
    // candidate set ages out concurrently (a job flipping back to running
    // would be a bug, but don't take its log with us if it happens).
    const result = await Model.deleteMany({
      _id: { $in: idsToDelete },
      status: { $in: TERMINAL_STATUSES },
    });

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
  const cutoff = new Date(Date.now() - policy.keepWithinDays * 86_400_000);

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
    const ids =
      totalBefore === 0 ? [] : await findDeletableIds(Model, cutoff, policy.keepLastN);
    out.collections.push({
      collection: name,
      totalBefore,
      candidatesForDeletion: ids.length,
    });
    out.totalCandidates += ids.length;
  }

  return out;
}
