/**
 * Firebase Cloud Messaging Service
 *
 * Main service for sending push notifications to native mobile apps (iOS/Android).
 * Handles both immediate sending and queue-based delivery.
 */

import * as admin from "firebase-admin";
import { Queue } from "bullmq";
import { nanoid } from "nanoid";
import { connectToAdminDatabase } from "@/lib/db/admin-connection";
import { getPushLogModel, type IPushLogDocument } from "@/lib/db/models/push-log";
import { getFirebaseMessaging, getFCMSettings, isFCMEnabled } from "./fcm.service";
import { getActiveTokens, incrementFailureCount, resetFailureCount } from "./token.service";
import type {
  SendFCMOptions,
  SendFCMResult,
  FCMPayload,
  FCMJobData,
  CreateFCMLogInput,
  FCMPlatform
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
 * Build FCM message for a specific platform
 */
function buildFCMMessage(
  fcmToken: string,
  platform: FCMPlatform,
  payload: FCMPayload,
  options: {
    badge?: number;
    channelId?: string;
    ttl?: number;
    priority?: "normal" | "high";
    settings?: {
      default_icon?: string;
      default_color?: string;
    };
  }
): admin.messaging.Message {
  const message: admin.messaging.Message = {
    token: fcmToken,
    notification: {
      title: payload.title,
      body: payload.body,
      imageUrl: payload.image
    },
    data: {
      ...payload.data,
      action_url: payload.action_url || "",
      click_action: payload.action_url || ""
    }
  };

  // Platform-specific configuration
  if (platform === "android") {
    message.android = {
      priority: options.priority === "high" ? "high" : "normal",
      ttl: options.ttl ? options.ttl * 1000 : undefined,
      notification: {
        icon: payload.icon || options.settings?.default_icon,
        color: options.settings?.default_color,
        channelId: options.channelId || "default",
        clickAction: payload.action_url || "FLUTTER_NOTIFICATION_CLICK"
      }
    };
  }

  if (platform === "ios") {
    message.apns = {
      headers: {
        "apns-priority": options.priority === "high" ? "10" : "5"
      },
      payload: {
        aps: {
          badge: options.badge,
          sound: "default",
          contentAvailable: true,
          mutableContent: true
        }
      }
    };
  }

  return message;
}

/**
 * Send FCM notification to a single token
 */
async function sendToToken(
  tenantDb: string,
  tokenId: string,
  fcmToken: string,
  platform: FCMPlatform,
  payload: FCMPayload,
  options: {
    badge?: number;
    channelId?: string;
    ttl?: number;
    priority?: "normal" | "high";
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const messaging = await getFirebaseMessaging(tenantDb);
    if (!messaging) {
      return { success: false, error: "FCM not configured" };
    }

    const settings = await getFCMSettings(tenantDb);

    const message = buildFCMMessage(fcmToken, platform, payload, {
      ...options,
      settings: {
        default_icon: settings?.default_icon,
        default_color: settings?.default_color
      }
    });

    await messaging.send(message);

    // Reset failure count on success
    await resetFailureCount(tenantDb, tokenId);

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Handle Firebase messaging errors
    if (error instanceof Error && "code" in error) {
      const firebaseError = error as { code: string };

      // Token expired or invalid
      if (
        firebaseError.code === "messaging/registration-token-not-registered" ||
        firebaseError.code === "messaging/invalid-registration-token"
      ) {
        await incrementFailureCount(tenantDb, tokenId);
        return { success: false, error: "Token expired or invalid" };
      }
    }

    // Increment failure count for other errors
    await incrementFailureCount(tenantDb, tokenId);

    return { success: false, error: errorMessage };
  }
}

/**
 * Send FCM notifications to multiple tokens
 */
export async function sendFCM(options: SendFCMOptions): Promise<SendFCMResult> {
  const { tenantDb, queue = false } = options;

  // Check if FCM is enabled
  const enabled = await isFCMEnabled(tenantDb);
  if (!enabled) {
    return {
      success: false,
      sent: 0,
      failed: 0,
      errors: [{ tokenId: "", error: "FCM not enabled for this tenant" }]
    };
  }

  // Get FCM settings for defaults
  const settings = await getFCMSettings(tenantDb);

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
        icon: options.icon || settings?.default_icon,
        image: options.image,
        action_url: options.action_url,
        data: options.data,
        template_id: options.templateId,
        trigger: options.trigger,
        priority: options.priority
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
          icon: options.icon || settings?.default_icon,
          image: options.image,
          action_url: options.action_url,
          data: options.data
        },
        templateId: options.templateId,
        trigger: options.trigger,
        priority: options.priority,
        badge: options.badge,
        channelId: options.channelId,
        ttl: options.ttl
      };

      await fcmQ.add("send-fcm", { ...jobData, fcmLogId: log.push_id }, {
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
      icon: options.icon || settings?.default_icon,
      image: options.image,
      action_url: options.action_url,
      data: options.data,
      template_id: options.templateId,
      trigger: options.trigger,
      priority: options.priority
    });

    const payload: FCMPayload = {
      title: options.title,
      body: options.body,
      icon: options.icon || settings?.default_icon,
      image: options.image,
      action_url: options.action_url,
      data: options.data
    };

    const result = await sendToToken(
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
      sent++;
    } else {
      await updateFCMLogStatus(log.push_id, "failed", result.error);
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
export async function processQueuedFCM(jobData: FCMJobData & { fcmLogId: string }): Promise<boolean> {
  const { fcmLogId, tenantDb, tokenId, fcmToken, platform, payload, badge, channelId, ttl, priority } = jobData;

  const result = await sendToToken(
    tenantDb,
    tokenId,
    fcmToken,
    platform,
    payload,
    { badge, channelId, ttl, priority }
  );

  await updateFCMLogStatus(fcmLogId, result.success ? "sent" : "failed", result.error);

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
