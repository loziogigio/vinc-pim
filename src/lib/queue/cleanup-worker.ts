/**
 * FCM Token Cleanup Worker
 *
 * Processes scheduled cleanup jobs for FCM tokens.
 * Runs periodically per tenant to:
 * - Remove inactive/stale tokens
 * - Clean up anonymous tokens
 * - Remove duplicates
 * - Delete failed tokens
 */

import { Worker, Job } from "bullmq";
import { runFullCleanup, getCleanupStats, type CleanupPolicies, type CleanupResult } from "@/lib/fcm/cleanup.service";

// ============================================
// JOB DATA TYPES
// ============================================

export interface CleanupJobData {
  /** Tenant database name (e.g., "vinc-hidros-it") */
  tenant_db: string;
  /** Tenant ID for logging */
  tenant_id: string;
  /** Custom cleanup policies (optional) */
  policies?: CleanupPolicies;
  /** Whether to only preview (dry run) */
  dry_run?: boolean;
}

export interface CleanupJobResult {
  tenant_id: string;
  dry_run: boolean;
  stats?: {
    total: number;
    active: number;
    inactive: number;
    anonymous: number;
    withFailures: number;
    stale: number;
    duplicates: number;
  };
  result?: CleanupResult;
  error?: string;
}

// ============================================
// JOB PROCESSOR
// ============================================

async function processCleanupJob(job: Job<CleanupJobData>): Promise<CleanupJobResult> {
  const { tenant_db, tenant_id, policies, dry_run = false } = job.data;

  console.log(`\n🧹 Processing cleanup job: ${job.id}`);
  console.log(`   Tenant: ${tenant_id}`);
  console.log(`   Mode: ${dry_run ? "DRY RUN (preview only)" : "LIVE"}`);

  try {
    if (dry_run) {
      // Preview only - get stats without deleting
      const stats = await getCleanupStats(tenant_db, policies);

      console.log(`📊 Cleanup preview for ${tenant_id}:`);
      console.log(`   Total tokens: ${stats.total}`);
      console.log(`   Active: ${stats.active}`);
      console.log(`   Would delete:`);
      console.log(`     - Inactive: ${stats.inactive}`);
      console.log(`     - Anonymous: ${stats.anonymous}`);
      console.log(`     - With failures: ${stats.withFailures}`);
      console.log(`     - Stale: ${stats.stale}`);
      console.log(`     - Duplicates: ${stats.duplicates}`);

      return {
        tenant_id,
        dry_run: true,
        stats,
      };
    }

    // Run actual cleanup
    const result = await runFullCleanup(tenant_db, policies);

    console.log(`✅ Cleanup completed for ${tenant_id}:`);
    console.log(`   Total deleted: ${result.total}`);
    console.log(`   Breakdown:`);
    console.log(`     - Inactive tokens: ${result.deleted.inactiveTokens}`);
    console.log(`     - Anonymous tokens: ${result.deleted.anonymousTokens}`);
    console.log(`     - Failed tokens: ${result.deleted.failedTokens}`);
    console.log(`     - Stale tokens: ${result.deleted.staleTokens}`);
    console.log(`     - Duplicates: ${result.deleted.duplicates}`);

    if (result.errors?.length) {
      console.warn(`   ⚠️  Errors: ${result.errors.join(", ")}`);
    }

    return {
      tenant_id,
      dry_run: false,
      result,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ Cleanup failed for ${tenant_id}:`, errorMsg);

    return {
      tenant_id,
      dry_run,
      error: errorMsg,
    };
  }
}

// ============================================
// WORKER CONFIGURATION
// ============================================

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");

// Lower concurrency for cleanup jobs (they can be heavy)
const WORKER_CONCURRENCY = parseInt(process.env.CLEANUP_WORKER_CONCURRENCY || "1");

console.log(`🔧 Cleanup Worker Configuration:`);
console.log(`   Concurrency: ${WORKER_CONCURRENCY} jobs`);

export const cleanupWorker = new Worker("cleanup-queue", processCleanupJob, {
  connection: {
    host: REDIS_HOST,
    port: REDIS_PORT,
  },
  concurrency: WORKER_CONCURRENCY,
});

// ============================================
// EVENT LISTENERS
// ============================================

cleanupWorker.on("completed", (job, result: CleanupJobResult) => {
  if (result.dry_run) {
    console.log(`✓ Cleanup preview ${job.id} completed for ${result.tenant_id}`);
  } else {
    console.log(
      `✓ Cleanup job ${job.id} completed for ${result.tenant_id}: ` +
        `${result.result?.total || 0} tokens deleted`
    );
  }
});

cleanupWorker.on("failed", (job, err) => {
  console.error(`✗ Cleanup job ${job?.id} failed:`, err.message);
});

cleanupWorker.on("progress", (job, progress) => {
  console.log(`Cleanup job ${job.id}: ${progress}%`);
});

// ============================================
// HELPER: Schedule Cleanup for All Tenants
// ============================================

/**
 * Schedule cleanup jobs for all active tenants.
 * This should be called by a cron job or scheduler.
 */
export async function scheduleCleanupForAllTenants(): Promise<void> {
  // Import here to avoid circular dependencies
  const { connectToAdminDatabase } = await import("@/lib/db/admin-connection");
  const { getTenantModel } = await import("@/lib/db/models/admin-tenant");
  const { cleanupQueue } = await import("./queues");

  await connectToAdminDatabase();
  const TenantModel = await getTenantModel();

  const activeTenants = await TenantModel.find({ status: "active" })
    .select("tenant_id")
    .lean();

  console.log(`📋 Scheduling cleanup for ${activeTenants.length} tenants`);

  for (const tenant of activeTenants) {
    const tenantId = tenant.tenant_id;
    const tenantDb = `vinc-${tenantId}`;

    await cleanupQueue.add(
      `cleanup-${tenantId}`,
      {
        tenant_db: tenantDb,
        tenant_id: tenantId,
      },
      {
        jobId: `cleanup-${tenantId}-${Date.now()}`,
      }
    );

    console.log(`  → Scheduled cleanup for ${tenantId}`);
  }
}
