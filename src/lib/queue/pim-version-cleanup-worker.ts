/**
 * PIM Version Retention Worker
 *
 * Periodic per-tenant cleanup of old PIMProduct version documents.
 * Mirrors the FCM cleanup-worker pattern.
 */

import { Worker, Job } from "bullmq";
import {
  pruneVersionsForTenant,
  getPrunePreview,
  type VersionRetentionPolicy,
  type TenantPruneResult,
  type PrunePreview,
} from "@/lib/pim/version-retention.service";

export interface PIMVersionCleanupJobData {
  /** When true this is the scheduled fan-out tick — enqueue a job per active tenant. */
  fanOut?: boolean;
  /** Tenant database name (e.g., "vinc-hidros-it"). Required for per-tenant jobs. */
  tenant_db?: string;
  /** Tenant ID for logging. Required for per-tenant jobs. */
  tenant_id?: string;
  /** Override default retention policy (optional). */
  policy?: Partial<VersionRetentionPolicy>;
  /** Preview only — do not delete. */
  dry_run?: boolean;
}

export interface PIMVersionCleanupJobResult {
  tenant_id: string;
  dry_run: boolean;
  preview?: PrunePreview;
  result?: TenantPruneResult;
  error?: string;
}

async function processJob(
  job: Job<PIMVersionCleanupJobData>
): Promise<PIMVersionCleanupJobResult> {
  // Scheduled fan-out tick (from the daily repeatable cron): enqueue one job per
  // active tenant onto this same queue, then return.
  if (job.data.fanOut) {
    console.log(`\n🗓  PIM version cleanup tick ${job.id} — fanning out to all tenants`);
    await schedulePIMVersionCleanupForAllTenants(job.data.policy);
    return { tenant_id: "ALL", dry_run: false };
  }

  const { tenant_db, tenant_id, policy, dry_run = false } = job.data;

  if (!tenant_db || !tenant_id) {
    return {
      tenant_id: tenant_id ?? "unknown",
      dry_run: false,
      error: "Missing tenant_db/tenant_id on a non-fanOut job",
    };
  }

  console.log(`\n🗂  Processing PIM version cleanup: ${job.id}`);
  console.log(`   Tenant: ${tenant_id}`);
  console.log(`   Mode: ${dry_run ? "DRY RUN (preview only)" : "LIVE"}`);

  try {
    if (dry_run) {
      const preview = await getPrunePreview(tenant_db, policy);
      console.log(
        `📊 PIM prune preview for ${tenant_id}: ${preview.candidatesForDeletion} versions ` +
          `across ${preview.productsScanned} products would be deleted ` +
          `(keepLastN=${preview.policy.keepLastN}, keepWithinDays=${preview.policy.keepWithinDays})`
      );
      return { tenant_id, dry_run: true, preview };
    }

    const result = await pruneVersionsForTenant(tenant_db, policy);
    console.log(
      `✅ PIM prune completed for ${tenant_id}: deleted ${result.totalDeleted} versions ` +
        `across ${result.productsTouched}/${result.productsScanned} products in ${result.durationMs}ms`
    );
    return { tenant_id, dry_run: false, result };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ PIM prune failed for ${tenant_id}:`, errorMsg);
    return { tenant_id, dry_run, error: errorMsg };
  }
}

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");
const WORKER_CONCURRENCY = parseInt(
  process.env.PIM_VERSION_CLEANUP_WORKER_CONCURRENCY || "1"
);

console.log(`🔧 PIM Version Cleanup Worker:`);
console.log(`   Concurrency: ${WORKER_CONCURRENCY} jobs`);

export const pimVersionCleanupWorker = new Worker(
  "pim-version-cleanup-queue",
  processJob,
  {
    connection: { host: REDIS_HOST, port: REDIS_PORT },
    concurrency: WORKER_CONCURRENCY,
    // Pruning a tenant with many products + versions can take a while.
    lockDuration: 600_000, // 10 min
    stalledInterval: 300_000,
    maxStalledCount: 1,
  }
);

pimVersionCleanupWorker.on("completed", (job, result: PIMVersionCleanupJobResult) => {
  if (result.dry_run) {
    console.log(
      `✓ PIM prune preview ${job.id} for ${result.tenant_id}: ` +
        `${result.preview?.candidatesForDeletion ?? 0} candidates`
    );
  } else {
    console.log(
      `✓ PIM prune ${job.id} for ${result.tenant_id}: ` +
        `${result.result?.totalDeleted ?? 0} versions deleted`
    );
  }
});

pimVersionCleanupWorker.on("failed", (job, err) => {
  console.error(`✗ PIM prune ${job?.id} failed:`, err.message);
});

/**
 * Enqueue a PIM-version cleanup for every active tenant.
 * Wire this to your cron / scheduler.
 */
export async function schedulePIMVersionCleanupForAllTenants(
  policy?: Partial<VersionRetentionPolicy>
): Promise<void> {
  const { connectToAdminDatabase } = await import("@/lib/db/admin-connection");
  const { getTenantModel } = await import("@/lib/db/models/admin-tenant");
  const { pimVersionCleanupQueue } = await import("./queues");

  await connectToAdminDatabase();
  const TenantModel = await getTenantModel();

  const activeTenants = await TenantModel.find({ status: "active" })
    .select("tenant_id")
    .lean();

  console.log(
    `📋 Scheduling PIM version cleanup for ${activeTenants.length} tenants`
  );

  for (const tenant of activeTenants) {
    const tenantId = tenant.tenant_id;
    const tenantDb = `vinc-${tenantId}`;

    await pimVersionCleanupQueue.add(
      `pim-version-cleanup-${tenantId}`,
      { tenant_db: tenantDb, tenant_id: tenantId, policy },
      { jobId: `pim-version-cleanup-${tenantId}-${Date.now()}` }
    );

    console.log(`  → Scheduled PIM cleanup for ${tenantId}`);
  }
}

/**
 * Register the daily repeatable cron that fans the cleanup out to every tenant.
 * Idempotent (upsert by scheduler id) — safe on every worker start / restart, so
 * a process restart can never "miss the 3 AM window" (unlike an in-memory timer).
 * Cron via VINC_PIM_VERSION_CLEANUP_CRON (default "0 3 * * *"); tz via VINC_CRON_TZ.
 */
export async function registerPIMVersionCleanupSchedule(): Promise<void> {
  const { pimVersionCleanupQueue } = await import("./queues");
  const cron = process.env.VINC_PIM_VERSION_CLEANUP_CRON || "0 3 * * *";
  const tz = process.env.VINC_CRON_TZ || "Europe/Rome";
  await pimVersionCleanupQueue.upsertJobScheduler(
    "pim-version-cleanup-daily",
    { pattern: cron, tz },
    { name: "pim-version-cleanup-fanout", data: { fanOut: true } }
  );
  console.log(`🗓  PIM version cleanup cron registered (pattern="${cron}", tz="${tz}")`);
}

// Register the schedule when this worker module loads (i.e. the worker process
// starts). Upsert is idempotent across restarts and multiple worker processes.
registerPIMVersionCleanupSchedule().catch((err) =>
  console.error("Failed to register PIM version cleanup schedule:", err)
);
