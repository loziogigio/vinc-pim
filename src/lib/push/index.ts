/**
 * Web Push Service
 *
 * Main service for sending web push notifications.
 * Handles both immediate sending and queue-based delivery.
 *
 * Config is now resolved per sales-channel via resolveNotificationConfig
 * and the actual send is delegated to sendWebPush from vinc-notifications/server.
 */

import { sendWebPush } from "vinc-notifications/server";
import type { WebPushConfig } from "vinc-notifications";
import { Queue } from "bullmq";
import { nanoid } from "nanoid";
import { connectToAdminDatabase } from "@/lib/db/admin-connection";
import { getPushLogModel, type IPushLogDocument } from "@/lib/db/models/push-log";
import { resolveNotificationConfig } from "@/lib/notifications/resolve-config";
import { getActiveSubscriptions, incrementFailureCount, resetFailureCount } from "./subscription.service";
import type {
  SendPushOptions,
  SendPushResult,
  PushPayload,
  CreatePushLogInput,
  PushPreferences
} from "./types";

// ============================================
// QUEUE SETUP
// ============================================

let pushQueue: Queue | null = null;

/**
 * Get or create the push notification queue
 */
function getPushQueue(): Queue {
  if (!pushQueue) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

    pushQueue = new Queue("push-notifications", {
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

  return pushQueue;
}

// ============================================
// PUSH LOG MANAGEMENT
// ============================================

/**
 * Create a push log entry
 */
async function createPushLog(input: CreatePushLogInput): Promise<IPushLogDocument> {
  const adminConn = await connectToAdminDatabase();
  const PushLog = getPushLogModel(adminConn);

  const log = new PushLog({
    push_id: `plog_${nanoid(12)}`,
    ...input,
    status: input.scheduled_at ? "queued" : "sending",
    priority: input.priority || 5
  });

  await log.save();
  return log;
}

/**
 * Update push log status
 */
async function updatePushLogStatus(
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
// PUSH SENDING
// ============================================

/**
 * Send push notification to a single subscription using the package transport.
 * Config is passed in from the caller (resolved per channel).
 */
async function sendToSubscription(
  cfg: WebPushConfig,
  tenantDb: string,
  subscriptionId: string,
  endpoint: string,
  keys: { p256dh: string; auth: string },
  payload: PushPayload
): Promise<{ success: boolean; error?: string }> {
  const result = await sendWebPush(cfg, { endpoint, keys }, {
    title: payload.title,
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    action_url: payload.action_url,
    push_id: payload.push_id,
    timestamp: payload.timestamp,
    data: payload.data,
  });

  if (result.ok) {
    // Reset failure count on success
    await resetFailureCount(tenantDb, subscriptionId);
    return { success: true };
  }

  // 410 Gone or 404 Not Found → subscription expired; package sets permanentlyInvalid
  await incrementFailureCount(tenantDb, subscriptionId);

  if (result.permanentlyInvalid) {
    return { success: false, error: "Subscription expired" };
  }

  return { success: false, error: result.error || "Unknown error" };
}

/**
 * Send push notifications to multiple subscriptions
 */
export async function sendPush(options: SendPushOptions): Promise<SendPushResult> {
  const { tenantDb, queue = false, channel } = options;

  // Resolve per-channel config (falls back to global homesettings, then env)
  const resolved = await resolveNotificationConfig(tenantDb, channel);
  const cfg = resolved.webPush;

  // Check if web push is enabled for this channel
  if (!cfg?.enabled || !cfg?.vapidPublicKey || !cfg?.vapidPrivateKey) {
    return {
      success: false,
      sent: 0,
      failed: 0,
      errors: [{ subscriptionId: "", error: "Web push not enabled for this tenant" }]
    };
  }

  // Get target subscriptions
  const subscriptions = await getActiveSubscriptions(tenantDb, {
    preferenceType: options.preferenceType,
    userIds: options.userIds,
    subscriptionIds: options.subscriptionIds
  });

  if (subscriptions.length === 0) {
    return {
      success: true,
      sent: 0,
      failed: 0,
      queued: 0
    };
  }

  // If queue mode, add to queue
  if (queue) {
    const pushQ = getPushQueue();
    let queued = 0;

    for (const sub of subscriptions) {
      // Create push log entry
      const log = await createPushLog({
        subscription_id: sub.subscription_id,
        tenant_db: tenantDb,
        title: options.title,
        body: options.body,
        icon: options.icon || cfg.defaultIcon,
        badge: options.badge || cfg.defaultBadge,
        action_url: options.action_url,
        data: options.data,
        template_id: options.templateId,
        trigger: options.trigger,
        priority: options.priority
      });

      // Add to queue
      await pushQ.add(
        "send-push",
        {
          pushLogId: log.push_id,
          tenantDb,
          subscriptionId: sub.subscription_id,
          endpoint: sub.endpoint,
          keys: sub.keys,
          channel,
          payload: {
            push_id: log.push_id,
            title: options.title,
            body: options.body,
            icon: options.icon || cfg.defaultIcon,
            badge: options.badge || cfg.defaultBadge,
            action_url: options.action_url,
            data: options.data,
            timestamp: Date.now()
          }
        },
        {
          priority: options.priority || 5
        }
      );

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
  const errors: Array<{ subscriptionId: string; error: string }> = [];

  for (const sub of subscriptions) {
    // Create push log entry
    const log = await createPushLog({
      subscription_id: sub.subscription_id,
      tenant_db: tenantDb,
      title: options.title,
      body: options.body,
      icon: options.icon || cfg.defaultIcon,
      badge: options.badge || cfg.defaultBadge,
      action_url: options.action_url,
      data: options.data,
      template_id: options.templateId,
      trigger: options.trigger,
      priority: options.priority
    });

    const payload: PushPayload = {
      push_id: log.push_id,
      title: options.title,
      body: options.body,
      icon: options.icon || cfg.defaultIcon,
      badge: options.badge || cfg.defaultBadge,
      action_url: options.action_url,
      data: options.data,
      timestamp: Date.now()
    };

    const result = await sendToSubscription(
      cfg,
      tenantDb,
      sub.subscription_id,
      sub.endpoint,
      sub.keys,
      payload
    );

    if (result.success) {
      await updatePushLogStatus(log.push_id, "sent");
      sent++;
    } else {
      await updatePushLogStatus(log.push_id, "failed", result.error);
      failed++;
      errors.push({
        subscriptionId: sub.subscription_id,
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
 * Process a queued push notification (called by worker)
 */
export async function processQueuedPush(jobData: {
  pushLogId: string;
  tenantDb: string;
  subscriptionId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  payload: PushPayload;
  channel?: string;
}): Promise<boolean> {
  const { pushLogId, tenantDb, subscriptionId, endpoint, keys, payload, channel } = jobData;

  // Re-resolve config (cached for 60 s, so this is cheap)
  const resolved = await resolveNotificationConfig(tenantDb, channel);
  const cfg = resolved.webPush;

  if (!cfg?.enabled || !cfg?.vapidPublicKey || !cfg?.vapidPrivateKey) {
    await updatePushLogStatus(pushLogId, "failed", "Web push not configured");
    return false;
  }

  const result = await sendToSubscription(cfg, tenantDb, subscriptionId, endpoint, keys, payload);

  await updatePushLogStatus(pushLogId, result.success ? "sent" : "failed", result.error);

  return result.success;
}

// ============================================
// CLICK/DISMISS TRACKING
// ============================================

/**
 * Record a push notification click
 */
export async function recordPushClick(
  pushId: string,
  url?: string
): Promise<boolean> {
  const adminConn = await connectToAdminDatabase();
  const PushLog = getPushLogModel(adminConn);
  return PushLog.recordClick(pushId, url);
}

/**
 * Record a push notification dismiss
 */
export async function recordPushDismiss(pushId: string): Promise<boolean> {
  const adminConn = await connectToAdminDatabase();
  const PushLog = getPushLogModel(adminConn);
  return PushLog.recordDismiss(pushId);
}

// ============================================
// STATISTICS
// ============================================

/**
 * Get push notification statistics for a tenant
 */
export async function getPushStats(tenantDb: string): Promise<{
  total: number;
  sent: number;
  failed: number;
  clicked: number;
  clickRate: number;
}> {
  const adminConn = await connectToAdminDatabase();
  const PushLog = getPushLogModel(adminConn);
  return PushLog.getStats(tenantDb);
}

/**
 * Get push logs for a tenant
 */
export async function getPushLogs(
  tenantDb: string,
  options?: { limit?: number; skip?: number }
): Promise<IPushLogDocument[]> {
  const adminConn = await connectToAdminDatabase();
  const PushLog = getPushLogModel(adminConn);
  return PushLog.findByTenant(tenantDb, options);
}

// ============================================
// RE-EXPORTS
// ============================================

export * from "./types";
export * from "./vapid.service";
export * from "./subscription.service";
