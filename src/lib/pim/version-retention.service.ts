/**
 * PIM Version Retention Service
 *
 * Prunes old PIMProduct version documents to keep the collection bounded.
 *
 * What is always kept (cannot be deleted by any policy):
 *   - The current version       (isCurrent === true)
 *   - The currently-published   (isCurrentPublished === true)
 *   - The latest `keepLastN` versions, regardless of age
 *   - Any version newer than `keepWithinDays`
 *
 * Everything else (older, non-current, non-published, beyond the safety
 * window) is deleted. The service is idempotent and safe to retry.
 */

import { connectWithModels } from "@/lib/db/connection";
import { envInt } from "@/lib/utils/env";

export interface VersionRetentionPolicy {
  /** Always keep the N most recent versions per product. Default: 10. */
  keepLastN: number;
  /** Always keep versions newer than this many days. Default: 180. */
  keepWithinDays: number;
}

export interface ProductPruneResult {
  entity_code: string;
  totalBefore: number;
  deleted: number;
  kept: number;
}

export interface TenantPruneResult {
  tenant_db: string;
  productsScanned: number;
  productsTouched: number;
  totalDeleted: number;
  durationMs: number;
}

export interface PrunePreview {
  tenant_db: string;
  policy: VersionRetentionPolicy;
  productsScanned: number;
  candidatesForDeletion: number;
}

export const DEFAULT_VERSION_RETENTION_POLICY: VersionRetentionPolicy = {
  // Single source of truth for "how many versions to keep" across the inline cap,
  // the scheduled worker, and the manual prune route. Default 10.
  keepLastN: Math.max(1, envInt("VINC_PIM_VERSION_KEEP_LAST_N", 10)),
  keepWithinDays: envInt("VINC_PIM_VERSION_KEEP_DAYS", 180),
};

function resolvePolicy(
  partial?: Partial<VersionRetentionPolicy>
): VersionRetentionPolicy {
  return {
    keepLastN: Math.max(1, partial?.keepLastN ?? DEFAULT_VERSION_RETENTION_POLICY.keepLastN),
    // 0 = no age window (a pure count cap, used by capVersionsForProduct).
    keepWithinDays: Math.max(
      0,
      partial?.keepWithinDays ?? DEFAULT_VERSION_RETENTION_POLICY.keepWithinDays
    ),
  };
}

/** Minimal per-version metadata used to decide what to prune. */
export interface VersionMeta {
  _id: unknown;
  isCurrent?: boolean;
  isCurrentPublished?: boolean;
  created_at?: Date | string | null;
}

/**
 * Pure selection (no DB): given a product's versions sorted NEWEST-FIRST (version desc),
 * return the `_id`s to delete. ALWAYS protects the current doc, the currently-published
 * doc, and the newest `keepLastN`. When `cutoff` is null the age window is disabled
 * (pure count cap); otherwise versions newer than `cutoff` are also protected.
 *
 * Single source of truth for "what is prunable" — exported for unit tests.
 */
export function selectVersionsToDelete(
  versionsNewestFirst: VersionMeta[],
  keepLastN: number,
  cutoff: Date | null
): unknown[] {
  const keepN = Math.max(1, keepLastN);
  const topNIds = new Set(versionsNewestFirst.slice(0, keepN).map((v) => String(v._id)));
  const ids: unknown[] = [];
  for (const v of versionsNewestFirst) {
    if (v.isCurrent) continue;
    if (v.isCurrentPublished) continue;
    if (topNIds.has(String(v._id))) continue;
    if (cutoff && v.created_at) {
      const createdAt = new Date(v.created_at as unknown as string);
      if (createdAt >= cutoff) continue;
    }
    ids.push(v._id);
  }
  return ids;
}

/**
 * Prune old versions of a single product. Returns the breakdown.
 */
export async function pruneVersionsForProduct(
  tenantDb: string,
  entity_code: string,
  policyOverride?: Partial<VersionRetentionPolicy>
): Promise<ProductPruneResult> {
  const policy = resolvePolicy(policyOverride);
  const cutoff =
    policy.keepWithinDays > 0
      ? new Date(Date.now() - policy.keepWithinDays * 86_400_000)
      : null;

  const { PIMProduct } = await connectWithModels(tenantDb);

  // Pull just the metadata needed to decide what to keep.
  const versions = await PIMProduct.find(
    { entity_code },
    { _id: 1, version: 1, isCurrent: 1, isCurrentPublished: 1, created_at: 1 }
  )
    .sort({ version: -1 })
    .lean();

  if (versions.length === 0) {
    return { entity_code, totalBefore: 0, deleted: 0, kept: 0 };
  }

  const idsToDelete = selectVersionsToDelete(
    versions as unknown as VersionMeta[],
    policy.keepLastN,
    cutoff
  );

  if (idsToDelete.length === 0) {
    return {
      entity_code,
      totalBefore: versions.length,
      deleted: 0,
      kept: versions.length,
    };
  }

  // Defense in depth — never let isCurrent/isCurrentPublished slip through even if
  // the in-memory check missed something (concurrent writes, stale projection, etc.).
  const result = await PIMProduct.deleteMany({
    _id: { $in: idsToDelete },
    isCurrent: { $ne: true },
    isCurrentPublished: { $ne: true },
  });

  return {
    entity_code,
    totalBefore: versions.length,
    deleted: result.deletedCount ?? 0,
    kept: versions.length - (result.deletedCount ?? 0),
  };
}

/**
 * CAP-LAST-N: enforce a hard cap of `maxVersions` versions for ONE product,
 * IGNORING age (count-only). Keeps the newest N (plus isCurrent + isCurrentPublished)
 * and deletes the rest. Called inline by the importer right after a new current
 * version is durably created. Default N = VINC_PIM_VERSION_KEEP_LAST_N (10).
 *
 * Built on pruneVersionsForProduct with keepWithinDays:0 so the age window does
 * NOT over-protect — a true count cap, not "keep N or anything younger than a day".
 */
export async function capVersionsForProduct(
  tenantDb: string,
  entity_code: string,
  maxVersions: number = DEFAULT_VERSION_RETENTION_POLICY.keepLastN
): Promise<ProductPruneResult> {
  return pruneVersionsForProduct(tenantDb, entity_code, {
    keepLastN: Math.max(1, maxVersions),
    keepWithinDays: 0,
  });
}

/**
 * Prune old versions across every product in a tenant. Streams through the
 * distinct entity_codes and prunes each one — no big in-memory load.
 */
export async function pruneVersionsForTenant(
  tenantDb: string,
  policyOverride?: Partial<VersionRetentionPolicy>
): Promise<TenantPruneResult> {
  const policy = resolvePolicy(policyOverride);
  const startedAt = Date.now();
  const { PIMProduct } = await connectWithModels(tenantDb);

  const entityCodes: string[] = await PIMProduct.distinct("entity_code");

  let productsTouched = 0;
  let totalDeleted = 0;

  for (const entity_code of entityCodes) {
    const r = await pruneVersionsForProduct(tenantDb, entity_code, policy);
    if (r.deleted > 0) {
      productsTouched += 1;
      totalDeleted += r.deleted;
    }
  }

  return {
    tenant_db: tenantDb,
    productsScanned: entityCodes.length,
    productsTouched,
    totalDeleted,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Dry-run: count how many versions *would* be deleted under the given policy
 * without touching the collection.
 */
export async function getPrunePreview(
  tenantDb: string,
  policyOverride?: Partial<VersionRetentionPolicy>
): Promise<PrunePreview> {
  const policy = resolvePolicy(policyOverride);
  const cutoff =
    policy.keepWithinDays > 0
      ? new Date(Date.now() - policy.keepWithinDays * 86_400_000)
      : null;
  const { PIMProduct } = await connectWithModels(tenantDb);

  const entityCodes: string[] = await PIMProduct.distinct("entity_code");
  let candidates = 0;

  for (const entity_code of entityCodes) {
    const versions = await PIMProduct.find(
      { entity_code },
      { _id: 1, version: 1, isCurrent: 1, isCurrentPublished: 1, created_at: 1 }
    )
      .sort({ version: -1 })
      .lean();

    candidates += selectVersionsToDelete(
      versions as unknown as VersionMeta[],
      policy.keepLastN,
      cutoff
    ).length;
  }

  return {
    tenant_db: tenantDb,
    policy,
    productsScanned: entityCodes.length,
    candidatesForDeletion: candidates,
  };
}
