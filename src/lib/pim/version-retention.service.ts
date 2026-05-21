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

export interface VersionRetentionPolicy {
  /** Always keep the N most recent versions per product. Default: 20. */
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
  keepLastN: parseInt(process.env.VINC_PIM_VERSION_KEEP_LAST_N || "20", 10) || 20,
  keepWithinDays: parseInt(process.env.VINC_PIM_VERSION_KEEP_DAYS || "180", 10) || 180,
};

function resolvePolicy(
  partial?: Partial<VersionRetentionPolicy>
): VersionRetentionPolicy {
  return {
    keepLastN: Math.max(1, partial?.keepLastN ?? DEFAULT_VERSION_RETENTION_POLICY.keepLastN),
    keepWithinDays: Math.max(
      1,
      partial?.keepWithinDays ?? DEFAULT_VERSION_RETENTION_POLICY.keepWithinDays
    ),
  };
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
  const cutoff = new Date(Date.now() - policy.keepWithinDays * 86_400_000);

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

  // Top `keepLastN` versions always survive — they're protected by their position.
  const topNIds = new Set(versions.slice(0, policy.keepLastN).map((v) => String(v._id)));

  const idsToDelete: unknown[] = [];

  for (const v of versions) {
    if (v.isCurrent) continue;
    if (v.isCurrentPublished) continue;
    if (topNIds.has(String(v._id))) continue;

    const createdAt = v.created_at ? new Date(v.created_at as unknown as string) : null;
    if (createdAt && createdAt >= cutoff) continue;

    idsToDelete.push(v._id);
  }

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
  const cutoff = new Date(Date.now() - policy.keepWithinDays * 86_400_000);
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

    const topNIds = new Set(versions.slice(0, policy.keepLastN).map((v) => String(v._id)));
    for (const v of versions) {
      if (v.isCurrent || v.isCurrentPublished) continue;
      if (topNIds.has(String(v._id))) continue;
      const createdAt = v.created_at ? new Date(v.created_at as unknown as string) : null;
      if (createdAt && createdAt >= cutoff) continue;
      candidates += 1;
    }
  }

  return {
    tenant_db: tenantDb,
    policy,
    productsScanned: entityCodes.length,
    candidatesForDeletion: candidates,
  };
}
