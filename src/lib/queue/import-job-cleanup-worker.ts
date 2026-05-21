/**
 * Import Job Retention Worker
 *
 * Periodic per-tenant cleanup of old ImportJob / AssociationJob documents.
 * Mirrors the pim-version-cleanup-worker pattern.
 */

import { Worker, Job } from "bullmq";
import {
  pruneImportJobsForTenant,
  getImportJobPrunePreview,
  type ImportJobRetentionPolicy,
  type ImportJobPruneResult,
  type ImportJobPrunePreview,
} from "@/lib/services/import-job-retention.service";

export interface ImportJobCleanupJobData {
  /** Tenant database name (e.g., "vinc-hidros-it"). */
  tenant_db: string;
  /** Tenant ID for logging. */
  tenant_id: string;
  /** Override default retention policy (optional). */
  policy?: Partial<ImportJobRetentionPolicy>;
  /** Preview only — do not delete. */
  dry_run?: boolean;
}

export interface ImportJobCleanupJobResult {
  tenant_id: string;
  dry_run: boolean;
  preview?: ImportJobPrunePreview;
  result?: ImportJobPruneResult;
  error?: string;
}

async function processJob(
  job: Job<ImportJobCleanupJobData>
): Promise<ImportJobCleanupJobResult> {
  const { tenant_db, tenant_id, policy, dry_run = false } = job.data;

  console.log(`\n🧾 Processing import-job cleanup: ${job.id}`);
  console.log(`   Tenant: ${tenant_id}`);
  console.log(`   Mode: ${dry_run ? "DRY RUN (preview only)" : "LIVE"}`);

  try {
    if (dry_run) {
      const preview = await getImportJobPrunePreview(tenant_db, policy);
      console.log(
        `📊 Import-job prune preview for ${tenant_id}: ${preview.totalCandidates} job docs ` +
          `would be deleted ` +
          `(keepLastN=${preview.policy.keepLastN}, keepWithinDays=${preview.policy.keepWithinDays})`
      );
      return { tenant_id, dry_run: true, preview };
    }

    const result = await pruneImportJobsForTenant(tenant_db, policy);
    console.log(
      `✅ Import-job prune for ${tenant_id}: deleted ${result.totalDeleted} docs ` +
        `(${result.collections
          .map((c) => `${c.collection}: ${c.deleted}/${c.totalBefore}`)
          .join(", ")}) in ${result.durationMs}ms`
    );
    return { tenant_id, dry_run: false, result };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ Import-job prune failed for ${tenant_id}:`, errorMsg);
    return { tenant_id, dry_run, error: errorMsg };
  }
}

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");
const WORKER_CONCURRENCY = parseInt(
  process.env.IMPORT_JOB_CLEANUP_WORKER_CONCURRENCY || "1"
);

console.log(`🔧 Import-Job Cleanup Worker:`);
console.log(`   Concurrency: ${WORKER_CONCURRENCY} jobs`);

export const importJobCleanupWorker = new Worker(
  "import-job-cleanup-queue",
  processJob,
  {
    connection: { host: REDIS_HOST, port: REDIS_PORT },
    concurrency: WORKER_CONCURRENCY,
    lockDuration: 600_000, // 10 min — a tenant with millions of jobs can take a while
    stalledInterval: 300_000,
    maxStalledCount: 1,
  }
);

importJobCleanupWorker.on("completed", (job, result: ImportJobCleanupJobResult) => {
  if (result.dry_run) {
    console.log(
      `✓ Import-job prune preview ${job.id} for ${result.tenant_id}: ` +
        `${result.preview?.totalCandidates ?? 0} candidates`
    );
  } else {
    console.log(
      `✓ Import-job prune ${job.id} for ${result.tenant_id}: ` +
        `${result.result?.totalDeleted ?? 0} docs deleted`
    );
  }
});

importJobCleanupWorker.on("failed", (job, err) => {
  console.error(`✗ Import-job prune ${job?.id} failed:`, err.message);
});

/**
 * Enqueue an import-job cleanup for every active tenant.
 * Wire this to your cron / scheduler.
 */
export async function scheduleImportJobCleanupForAllTenants(
  policy?: Partial<ImportJobRetentionPolicy>
): Promise<void> {
  const { connectToAdminDatabase } = await import("@/lib/db/admin-connection");
  const { getTenantModel } = await import("@/lib/db/models/admin-tenant");
  const { importJobCleanupQueue } = await import("./queues");

  await connectToAdminDatabase();
  const TenantModel = await getTenantModel();

  const activeTenants = await TenantModel.find({ status: "active" })
    .select("tenant_id")
    .lean();

  console.log(
    `📋 Scheduling import-job cleanup for ${activeTenants.length} tenants`
  );

  for (const tenant of activeTenants) {
    const tenantId = tenant.tenant_id;
    const tenantDb = `vinc-${tenantId}`;

    await importJobCleanupQueue.add(
      `import-job-cleanup-${tenantId}`,
      { tenant_db: tenantDb, tenant_id: tenantId, policy },
      { jobId: `import-job-cleanup-${tenantId}-${Date.now()}` }
    );

    console.log(`  → Scheduled import-job cleanup for ${tenantId}`);
  }
}
