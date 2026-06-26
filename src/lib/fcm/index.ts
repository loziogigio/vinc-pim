/**
 * Firebase Cloud Messaging Service
 *
 * Main service for sending push notifications to native mobile apps (iOS/Android).
 * Handles both immediate sending and queue-based delivery.
 *
 * Config is now resolved per sales-channel via resolveNotificationConfig
 * and the actual send is delegated to sendFcm from vinc-notifications/server.
 */

import { sendFcm } from "vinc-notifications/server";
import type { MobilePushConfig } from "vinc-notifications";
import { Queue } from "bullmq";
import { nanoid } from "nanoid";
import { connectToAdminDatabase } from "@/lib/db/admin-connection";
import { getPushLogModel, type IPushLogDocument } from "@/lib/db/models/push-log";
import { resolveNotificationConfig } from "@/lib/notifications/resolve-config";
import { getActiveTokens, incrementFailureCount, resetFailureCount } from "./token.service";
import {
  deleteInvalidToken,
} from "./cleanup.service";
import {
  createNotificationLog,
  markLogAsSent,
  markLogAsFailed,
} from "@/lib/notifications/notification-log.service";
import type {
  SendFCMOptions,
  SendFCMResult,
  FCMPayload,
  FCMJobData,
  CreateFCMLogInput,
} from "./types";

// ============================================
// QUEUE SETUP
// ============================================

let fcmQueue: Queue | null = null;

/**
 * Get or create the FCM notification queue
 */
function getFCMQueue(): Queue {
  if (!fcmQueue) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

    fcmQueue = new Queue("fcm-notifications", {
      connection: {
        url: redisUrl
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000
        },
        removeOnComplete: 100,
        removeOnFail: 1000
      }
    });
  }

  return fcmQueue;
}

// ============================================
// FCM LOG MANAGEMENT
// ============================================

/**
 * Create an FCM log entry (reuses push log model)
 */
async function createFCMLog(input: CreateFCMLogInput): Promise<IPushLogDocument> {
  const adminConn = await connectToAdminDatabase();
  const PushLog = getPushLogModel(adminConn);

  const log = new PushLog({
    push_id: `fcm_${nanoid(12)}`,
    subscription_id: input.token_id, // Reuse subscription_id field for token_id
    tenant_db: input.tenant_db,
    title: input.title,
    body: input.body,
    icon: input.icon,
    action_url: input.action_url,
    data: input.data,
    template_id: input.template_id,
    trigger: input.trigger,
    status: input.scheduled_at ? "queued" : "sending",
    priority: input.priority === "high" ? 10 : 5
  });

  await log.save();
  return log;
}

/**
 * Update FCM log status
 */
async function updateFCMLogStatus(
  pushId: string,
  status: "sent" | "failed",
  error?: string
): Promise<void> {
  const adminConn = await connectToAdminDatabase();
  const PushLog = getPushLogModel(adminConn);

  if (status === "sent") {
    await PushLog.markAsSent(pushId);
  } else {
    await PushLog.markAsFailed(pushId, error || "Unknown error");
  }
}

// ============================================
// FCM SENDING
// ============================================

/**
 * Send FCM notification to a single token using the package transport.
 * Config is passed in from the caller (resolved per channel).
 */
async function sendToToken(
  cfg: MobilePushConfig,
  tenantDb: string,
  tokenId: string,
  fcmToken: string,
  platform: "ios" | "android",
  payload: FCMPayload,
  options: {
    badge?: number;
    channelId?: string;
    ttl?: number;
    priority?: "normal" | "high";
  }
): Promise<{ success: boolean; error?: string; deleted?: boolean }> {
  const result = await sendFcm(cfg, {
    token: fcmToken,
    title: payload.title,
    body: payload.body,
    platform,
    image: payload.image,
    action_url: payload.action_url,
    data: payload.data,
    priority: options.priority,
    badge: options.badge,
    channelId: options.channelId,
    ttl: options.ttl,
  });

  if (result.ok) {
    // Reset failure count on success
    await resetFailureCount(tenantDb, tokenId);
    return { success: true };
  }

  // Best practice: immediately delete permanently invalid tokens
  // These tokens will NEVER work again, so delete them right away
  if (result.permanentlyInvalid) {
    await deleteInvalidToken(tenantDb, tokenId);
    return {
      success: false,
      error: `Token permanently invalid - deleted`,
      deleted: true,
    };
  }

  // For other errors (network issues, rate limits, etc.),
  // increment failure count - these might recover
  await incrementFailureCount(tenantDb, tokenId);

  return { success: false, error: result.error || "Unknown error" };
}

/**
 * Send FCM notifications to multiple tokens
 */
export async function sendFCM(options: SendFCMOptions): Promise<SendFCMResult> {
  const { tenantDb, queue = false, channel } = options;

  // Resolve per-channel config (falls back to global homesettings, then env)
  const resolved = await resolveNotificationConfig(tenantDb, channel);
  const cfg = resolved.mobilePush;

  // Check if FCM is enabled for this channel
  if (!cfg?.enabled || !cfg?.projectId || !cfg?.clientEmail || !cfg?.privateKey) {
    return {
      success: false,
      sent: 0,
      failed: 0,
      errors: [{ tokenId: "", error: "FCM not enabled for this tenant" }]
    };
  }

  // Get target tokens
  const tokens = await getActiveTokens(tenantDb, {
    preferenceType: options.preferenceType,
    userIds: options.userIds,
    tokenIds: options.tokenIds
  });

  if (tokens.length === 0) {
    return {
      success: true,
      sent: 0,
      failed: 0,
      queued: 0
    };
  }

  // If queue mode, add to queue
  if (queue) {
    const fcmQ = getFCMQueue();
    let queued = 0;

    for (const token of tokens) {
      // Create FCM log entry
      const log = await createFCMLog({
        token_id: token.token_id,
        tenant_db: tenantDb,
        title: options.title,
        body: options.body,
        icon: options.icon || cfg.defaultIcon,
        image: options.image,
        action_url: options.action_url,
        data: options.data,
        template_id: options.templateId,
        trigger: options.trigger,
        priority: options.priority
      });

      // Create unified notification log
      const campaign_id = options.data?.campaign_id as string | undefined;
      const notificationLog = await createNotificationLog({
        channel: "mobile",
        source: campaign_id ? "campaign" : (options.trigger ? "trigger" : "manual"),
        campaign_id,
        trigger: options.trigger,
        tenant_db: tenantDb,
        user_id: token.user_id,
        title: options.title,
        body: options.body,
        action_url: options.action_url,
        status: "queued",
      });

      // Add to queue
      const jobData: FCMJobData = {
        tenantDb,
        tokenId: token.token_id,
        fcmToken: token.fcm_token,
        platform: token.platform,
        payload: {
          title: options.title,
          body: options.body,
          icon: options.icon || cfg.defaultIcon,
          image: options.image,
          action_url: options.action_url,
          data: {
            ...options.data,
            notification_log_id: notificationLog.log_id, // For mobile tracking
          }
        },
        templateId: options.templateId,
        trigger: options.trigger,
        priority: options.priority,
        badge: options.badge,
        channelId: options.channelId,
        ttl: options.ttl,
        channel,
      };

      await fcmQ.add("send-fcm", {
        ...jobData,
        fcmLogId: log.push_id,
        notificationLogId: notificationLog.log_id
      }, {
        priority: options.priority === "high" ? 1 : 5
      });

      queued++;
    }

    return {
      success: true,
      queued,
      sent: 0,
      failed: 0
    };
  }

  // Immediate sending
  let sent = 0;
  let failed = 0;
  const errors: Array<{ tokenId: string; error: string }> = [];

  for (const token of tokens) {
    // Create FCM log entry
    const log = await createFCMLog({
      token_id: token.token_id,
      tenant_db: tenantDb,
      title: options.title,
      body: options.body,
      icon: options.icon || cfg.defaultIcon,
      image: options.image,
      action_url: options.action_url,
      data: options.data,
      template_id: options.templateId,
      trigger: options.trigger,
      priority: options.priority
    });

    // Create unified notification log
    const campaign_id = options.data?.campaign_id as string | undefined;
    const notificationLog = await createNotificationLog({
      channel: "mobile",
      source: campaign_id ? "campaign" : (options.trigger ? "trigger" : "manual"),
      campaign_id,
      trigger: options.trigger,
      tenant_db: tenantDb,
      user_id: token.user_id,
      title: options.title,
      body: options.body,
      action_url: options.action_url,
      status: "sending",
    });

    const payload: FCMPayload = {
      title: options.title,
      body: options.body,
      icon: options.icon || cfg.defaultIcon,
      image: options.image,
      action_url: options.action_url,
      data: {
        ...options.data,
        notification_log_id: notificationLog.log_id, // For mobile tracking
      }
    };

    const result = await sendToToken(
      cfg,
      tenantDb,
      token.token_id,
      token.fcm_token,
      token.platform,
      payload,
      {
        badge: options.badge,
        channelId: options.channelId,
        ttl: options.ttl,
        priority: options.priority
      }
    );

    if (result.success) {
      await updateFCMLogStatus(log.push_id, "sent");
      await markLogAsSent(notificationLog.log_id);
      sent++;
    } else {
      await updateFCMLogStatus(log.push_id, "failed", result.error);
      await markLogAsFailed(notificationLog.log_id, result.error || "Unknown error");
      failed++;
      errors.push({
        tokenId: token.token_id,
        error: result.error || "Unknown error"
      });
    }
  }

  return {
    success: failed === 0,
    sent,
    failed,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Process a queued FCM notification (called by worker)
 */
export async function processQueuedFCM(
  jobData: FCMJobData & { fcmLogId: string; notificationLogId?: string }
): Promise<boolean> {
  const {
    fcmLogId,
    notificationLogId,
    tenantDb,
    tokenId,
    fcmToken,
    platform,
    payload,
    badge,
    channelId,
    ttl,
    priority,
    channel,
  } = jobData;

  // Re-resolve config (cached for 60 s, so this is cheap)
  const resolved = await resolveNotificationConfig(tenantDb, channel);
  const cfg = resolved.mobilePush;

  if (!cfg?.enabled || !cfg?.projectId || !cfg?.clientEmail || !cfg?.privateKey) {
    await updateFCMLogStatus(fcmLogId, "failed", "FCM not configured");
    if (notificationLogId) {
      await markLogAsFailed(notificationLogId, "FCM not configured");
    }
    return false;
  }

  const result = await sendToToken(
    cfg,
    tenantDb,
    tokenId,
    fcmToken,
    platform,
    payload,
    { badge, channelId, ttl, priority }
  );

  await updateFCMLogStatus(fcmLogId, result.success ? "sent" : "failed", result.error);

  // Update unified notification log
  if (notificationLogId) {
    if (result.success) {
      await markLogAsSent(notificationLogId);
    } else {
      await markLogAsFailed(notificationLogId, result.error || "Unknown error");
    }
  }

  return result.success;
}

// ============================================
// STATISTICS
// ============================================

/**
 * Get FCM notification statistics for a tenant
 */
export async function getFCMStats(tenantDb: string): Promise<{
  total: number;
  sent: number;
  failed: number;
  clicked: number;
  clickRate: number;
}> {
  const adminConn = await connectToAdminDatabase();
  const PushLog = getPushLogModel(adminConn);

  // Filter by FCM logs (push_id starts with 'fcm_')
  const stats = await PushLog.aggregate([
    {
      $match: {
        tenant_db: tenantDb,
        push_id: { $regex: /^fcm_/ }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        sent: {
          $sum: { $cond: [{ $eq: ["$status", "sent"] }, 1, 0] }
        },
        failed: {
          $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] }
        },
        clicked: {
          $sum: { $cond: [{ $ne: ["$clicked_at", null] }, 1, 0] }
        }
      }
    }
  ]);

  if (!stats.length) {
    return { total: 0, sent: 0, failed: 0, clicked: 0, clickRate: 0 };
  }

  const { total, sent, failed, clicked } = stats[0];
  return {
    total,
    sent,
    failed,
    clicked,
    clickRate: sent > 0 ? Math.round((clicked / sent) * 100) : 0
  };
}

/**
 * Get FCM logs for a tenant
 */
export async function getFCMLogs(
  tenantDb: string,
  options?: { limit?: number; skip?: number }
): Promise<IPushLogDocument[]> {
  const adminConn = await connectToAdminDatabase();
  const PushLog = getPushLogModel(adminConn);

  const query = {
    tenant_db: tenantDb,
    push_id: { $regex: /^fcm_/ }
  };

  let queryBuilder = PushLog.find(query).sort({ created_at: -1 });

  if (options?.skip) {
    queryBuilder = queryBuilder.skip(options.skip);
  }
  if (options?.limit) {
    queryBuilder = queryBuilder.limit(options.limit);
  }

  return queryBuilder;
}

// ============================================
// RE-EXPORTS
// ============================================

export * from "./types";
export * from "./fcm.service";
export * from "./token.service";
export * from "./cleanup.service";
