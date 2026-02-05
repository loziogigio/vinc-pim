/**
 * Notification Scheduler Worker
 *
 * Processes scheduled notification campaigns.
 * Two modes:
 * 1. Poll mode: Checks for campaigns with status "scheduled" and scheduled_at <= now
 * 2. Direct mode: Sends a specific campaign immediately
 *
 * This worker runs periodically to pick up scheduled campaigns and trigger their delivery.
 */

import { Worker, Job } from "bullmq";
import { connectWithModels } from "@/lib/db/connection";
import { sendCampaign, type SendCampaignResult } from "@/lib/services/campaign.service";

// ============================================
// JOB DATA TYPES
// ============================================

export type NotificationJobType = "poll_scheduled" | "send_campaign";

export interface PollScheduledJobData {
  type: "poll_scheduled";
  /** Tenant database name (e.g., "vinc-hidros-it") */
  tenant_db: string;
  /** Tenant ID for logging */
  tenant_id: string;
}

export interface SendCampaignJobData {
  type: "send_campaign";
  /** Tenant database name (e.g., "vinc-hidros-it") */
  tenant_db: string;
  /** Tenant ID for logging */
  tenant_id: string;
  /** Campaign ID to send */
  campaign_id: string;
}

export type NotificationJobData = PollScheduledJobData | SendCampaignJobData;

export interface NotificationJobResult {
  tenant_id: string;
  type: NotificationJobType;
  campaigns_found?: number;
  campaigns_sent?: string[];
  campaign_id?: string;
  result?: SendCampaignResult;
  error?: string;
}

// ============================================
// JOB PROCESSOR
// ============================================

async function processNotificationJob(
  job: Job<NotificationJobData>
): Promise<NotificationJobResult> {
  const { type, tenant_db, tenant_id } = job.data;

  console.log(`\n📬 Processing notification job: ${job.id}`);
  console.log(`   Tenant: ${tenant_id}`);
  console.log(`   Type: ${type}`);

  try {
    if (type === "poll_scheduled") {
      // Poll for scheduled campaigns that are due
      return await processScheduledCampaigns(tenant_db, tenant_id);
    } else if (type === "send_campaign") {
      // Send a specific campaign
      const { campaign_id } = job.data as SendCampaignJobData;
      return await processSingleCampaign(tenant_db, tenant_id, campaign_id);
    } else {
      throw new Error(`Unknown job type: ${type}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ Notification job failed for ${tenant_id}:`, errorMsg);

    return {
      tenant_id,
      type,
      error: errorMsg,
    };
  }
}

/**
 * Find and send all scheduled campaigns that are due
 */
async function processScheduledCampaigns(
  tenantDb: string,
  tenantId: string
): Promise<NotificationJobResult> {
  const { Campaign } = await connectWithModels(tenantDb);

  const now = new Date();

  // Find campaigns that are scheduled and due
  const dueCampaigns = await Campaign.find({
    status: "scheduled",
    scheduled_at: { $lte: now },
  })
    .select("campaign_id name scheduled_at")
    .lean();

  console.log(`📋 Found ${dueCampaigns.length} scheduled campaigns due for ${tenantId}`);

  if (dueCampaigns.length === 0) {
    return {
      tenant_id: tenantId,
      type: "poll_scheduled",
      campaigns_found: 0,
      campaigns_sent: [],
    };
  }

  const sentCampaigns: string[] = [];
  const errors: string[] = [];

  for (const campaign of dueCampaigns) {
    const campaignId = campaign.campaign_id;

    try {
      console.log(`  → Sending campaign: ${campaign.name} (${campaignId})`);

      // Update status to draft first (sendCampaign expects draft status)
      await Campaign.updateOne(
        { campaign_id: campaignId },
        { $set: { status: "draft" } }
      );

      // Send the campaign
      const result = await sendCampaign(tenantDb, campaignId);

      if ("error" in result) {
        console.error(`  ✗ Campaign ${campaignId} failed: ${result.error}`);
        errors.push(`${campaignId}: ${result.error}`);
      } else {
        console.log(
          `  ✓ Campaign ${campaignId} sent to ${result.recipients_count} recipients`
        );
        sentCampaigns.push(campaignId);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`  ✗ Campaign ${campaignId} error: ${errorMsg}`);
      errors.push(`${campaignId}: ${errorMsg}`);

      // Mark campaign as failed
      await Campaign.updateOne(
        { campaign_id: campaignId },
        { $set: { status: "failed" } }
      );
    }
  }

  console.log(
    `✅ Scheduled campaign processing complete for ${tenantId}: ` +
      `${sentCampaigns.length}/${dueCampaigns.length} sent`
  );

  return {
    tenant_id: tenantId,
    type: "poll_scheduled",
    campaigns_found: dueCampaigns.length,
    campaigns_sent: sentCampaigns,
    error: errors.length > 0 ? errors.join("; ") : undefined,
  };
}

/**
 * Send a single campaign by ID
 */
async function processSingleCampaign(
  tenantDb: string,
  tenantId: string,
  campaignId: string
): Promise<NotificationJobResult> {
  console.log(`📧 Sending campaign ${campaignId} for ${tenantId}`);

  const result = await sendCampaign(tenantDb, campaignId);

  if ("error" in result) {
    console.error(`✗ Campaign ${campaignId} failed: ${result.error}`);
    return {
      tenant_id: tenantId,
      type: "send_campaign",
      campaign_id: campaignId,
      error: result.error,
    };
  }

  console.log(
    `✓ Campaign ${campaignId} sent to ${result.recipients_count} recipients`
  );

  return {
    tenant_id: tenantId,
    type: "send_campaign",
    campaign_id: campaignId,
    result,
  };
}

// ============================================
// WORKER CONFIGURATION
// ============================================

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");

// Concurrency for notification jobs
const WORKER_CONCURRENCY = parseInt(
  process.env.NOTIFICATION_WORKER_CONCURRENCY || "2"
);

console.log(`🔧 Notification Worker Configuration:`);
console.log(`   Concurrency: ${WORKER_CONCURRENCY} jobs`);

export const notificationWorker = new Worker(
  "notification-queue",
  processNotificationJob,
  {
    connection: {
      host: REDIS_HOST,
      port: REDIS_PORT,
    },
    concurrency: WORKER_CONCURRENCY,
  }
);

// ============================================
// EVENT LISTENERS
// ============================================

notificationWorker.on("completed", (job, result: NotificationJobResult) => {
  if (result.type === "poll_scheduled") {
    console.log(
      `✓ Poll job ${job.id} completed for ${result.tenant_id}: ` +
        `${result.campaigns_sent?.length || 0}/${result.campaigns_found || 0} campaigns sent`
    );
  } else {
    console.log(
      `✓ Send job ${job.id} completed for ${result.tenant_id}: ` +
        `campaign ${result.campaign_id}`
    );
  }
});

notificationWorker.on("failed", (job, err) => {
  console.error(`✗ Notification job ${job?.id} failed:`, err.message);
});

notificationWorker.on("progress", (job, progress) => {
  console.log(`Notification job ${job.id}: ${progress}%`);
});

// ============================================
// HELPER: Schedule Polling for All Tenants
// ============================================

/**
 * Schedule poll jobs for all active tenants.
 * This should be called by a cron job every minute.
 */
export async function schedulePollForAllTenants(): Promise<void> {
  // Import here to avoid circular dependencies
  const { connectToAdminDatabase } = await import("@/lib/db/admin-connection");
  const { getTenantModel } = await import("@/lib/db/models/admin-tenant");
  const { notificationQueue } = await import("./queues");

  await connectToAdminDatabase();
  const TenantModel = await getTenantModel();

  const activeTenants = await TenantModel.find({ status: "active" })
    .select("tenant_id")
    .lean();

  console.log(`📋 Scheduling notification poll for ${activeTenants.length} tenants`);

  for (const tenant of activeTenants) {
    const tenantId = tenant.tenant_id;
    const tenantDb = `vinc-${tenantId}`;

    await notificationQueue.add(
      `poll-${tenantId}`,
      {
        type: "poll_scheduled",
        tenant_db: tenantDb,
        tenant_id: tenantId,
      } as PollScheduledJobData,
      {
        // Use a unique job ID to prevent duplicate polling
        jobId: `poll-${tenantId}-${Math.floor(Date.now() / 60000)}`, // per minute
      }
    );
  }
}

/**
 * Queue a specific campaign for immediate sending
 */
export async function queueCampaignSend(
  tenantDb: string,
  tenantId: string,
  campaignId: string
): Promise<void> {
  const { notificationQueue } = await import("./queues");

  await notificationQueue.add(
    `send-${campaignId}`,
    {
      type: "send_campaign",
      tenant_db: tenantDb,
      tenant_id: tenantId,
      campaign_id: campaignId,
    } as SendCampaignJobData,
    {
      jobId: `send-${campaignId}-${Date.now()}`,
    }
  );

  console.log(`📧 Queued campaign ${campaignId} for immediate sending`);
}

// ============================================
// PRIMARY: DELAYED JOB SCHEDULING
// ============================================

/**
 * Schedule a campaign for future sending using BullMQ delayed job.
 *
 * This is the PRIMARY scheduling mechanism - the job is added to Redis
 * with a delay calculated from scheduledAt. BullMQ will process it at
 * exactly the right time.
 *
 * The fallback polling (every 5 min) catches jobs lost after Redis restart.
 *
 * @param tenantDb - Tenant database name (e.g., "vinc-hidros-it")
 * @param tenantId - Tenant ID for logging
 * @param campaignId - Campaign ID to schedule
 * @param scheduledAt - When to send the campaign
 */
export async function scheduleCampaignJob(
  tenantDb: string,
  tenantId: string,
  campaignId: string,
  scheduledAt: Date
): Promise<{ jobId: string; delay: number }> {
  const { notificationQueue } = await import("./queues");

  // Calculate delay in milliseconds
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());

  // Use unique jobId to prevent duplicates (same campaign can't be scheduled twice)
  const jobId = `scheduled-${campaignId}`;

  await notificationQueue.add(
    `send-${campaignId}`,
    {
      type: "send_campaign",
      tenant_db: tenantDb,
      tenant_id: tenantId,
      campaign_id: campaignId,
    } as SendCampaignJobData,
    {
      delay,
      jobId,
    }
  );

  const scheduledTime = scheduledAt.toISOString();
  const delayMinutes = Math.round(delay / 60000);

  console.log(
    `📅 Scheduled campaign ${campaignId} for ${scheduledTime} ` +
      `(delay: ${delayMinutes} minutes)`
  );

  return { jobId, delay };
}

/**
 * Cancel a scheduled campaign job
 *
 * @param campaignId - Campaign ID to cancel
 * @returns true if job was found and removed, false otherwise
 */
export async function cancelScheduledCampaign(
  campaignId: string
): Promise<boolean> {
  const { notificationQueue } = await import("./queues");

  const jobId = `scheduled-${campaignId}`;
  const job = await notificationQueue.getJob(jobId);

  if (job) {
    await job.remove();
    console.log(`🚫 Cancelled scheduled campaign ${campaignId}`);
    return true;
  }

  console.log(`⚠️  No scheduled job found for campaign ${campaignId}`);
  return false;
}
