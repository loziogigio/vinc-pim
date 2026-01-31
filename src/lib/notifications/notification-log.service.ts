/**
 * Notification Log Service
 *
 * Unified logging service for all notification channels.
 * Provides functions for creating logs, recording engagement events,
 * and aggregating campaign statistics.
 */

import {
  getNotificationLogModel,
  type INotificationLog,
  type ILogEvent,
} from "@/lib/db/models/notification-log";
import type {
  LogChannel,
  LogSource,
  LogStatus,
  LogEventType,
} from "@/lib/constants/notification";

// ============================================
// TYPES
// ============================================

export interface CreateNotificationLogOptions {
  channel: LogChannel;
  source: LogSource;
  campaign_id?: string;
  trigger?: string;
  tenant_db: string;
  user_id?: string;
  recipient?: string;
  title: string;
  body?: string;
  action_url?: string;
  status?: LogStatus;
}

export interface RecordEngagementOptions {
  log_id: string;
  event_type: LogEventType;
  platform?: "mobile" | "web";
  metadata?: {
    url?: string;
    ip?: string;
    user_agent?: string;
    // Click tracking details
    sku?: string;
    order_number?: string;
    screen?: string;
    click_type?: string;
  };
}

export interface ChannelStats {
  sent: number;
  failed: number;
  opened: number;
  clicked: number;
  read?: number;
}

export interface CampaignStats {
  email: ChannelStats;
  mobile_app: ChannelStats;  // Tracking from Flutter/mobile apps
  web: ChannelStats;         // Tracking from web browsers
}

// ============================================
// CREATE LOG
// ============================================

/**
 * Create a notification log entry.
 *
 * @example
 * ```ts
 * const log = await createNotificationLog({
 *   channel: "email",
 *   source: "campaign",
 *   campaign_id: "camp_abc123",
 *   tenant_db: "vinc-hidros-it",
 *   recipient: "user@example.com",
 *   title: "New Products Available",
 *   body: "Check out our latest products...",
 *   status: "queued",
 * });
 * ```
 */
export async function createNotificationLog(
  options: CreateNotificationLogOptions
): Promise<INotificationLog> {
  const NotificationLog = await getNotificationLogModel();

  const log = new NotificationLog({
    channel: options.channel,
    source: options.source,
    campaign_id: options.campaign_id,
    trigger: options.trigger,
    tenant_db: options.tenant_db,
    user_id: options.user_id,
    recipient: options.recipient,
    title: options.title,
    body: options.body || "",
    action_url: options.action_url,
    status: options.status || "queued",
  });

  await log.save();
  return log;
}

// ============================================
// UPDATE STATUS
// ============================================

/**
 * Mark a notification log as sent.
 */
export async function markLogAsSent(log_id: string): Promise<void> {
  const NotificationLog = await getNotificationLogModel();

  await NotificationLog.updateOne(
    { log_id },
    {
      $set: {
        status: "sent",
        sent_at: new Date(),
      },
    }
  );
}

/**
 * Mark a notification log as failed.
 */
export async function markLogAsFailed(
  log_id: string,
  error: string
): Promise<void> {
  const NotificationLog = await getNotificationLogModel();

  await NotificationLog.updateOne(
    { log_id },
    {
      $set: {
        status: "failed",
        error,
      },
    }
  );
}

// ============================================
// RECORD ENGAGEMENT
// ============================================

/**
 * Record an engagement event on a notification log.
 *
 * @example
 * ```ts
 * await recordEngagement({
 *   log_id: "nlog_abc123",
 *   event_type: "opened",
 *   metadata: { ip: "192.168.1.1", user_agent: "Mozilla/5.0..." },
 * });
 * ```
 */
export async function recordEngagement(
  options: RecordEngagementOptions
): Promise<void> {
  const NotificationLog = await getNotificationLogModel();

  // Default platform to "web" if not specified
  const platform = options.platform || "web";

  const event: ILogEvent = {
    type: options.event_type,
    timestamp: new Date(),
    metadata: {
      ...options.metadata,
      platform,
    },
  };

  // Build update object based on event type and platform
  const update: Record<string, unknown> = {
    $push: { events: event },
  };

  if (options.event_type === "opened") {
    // Increment total and platform-specific counter
    if (platform === "mobile") {
      update.$inc = { open_count: 1, mobile_open_count: 1 };
    } else {
      update.$inc = { open_count: 1, web_open_count: 1 };
    }
  } else if (options.event_type === "clicked") {
    // Increment total and platform-specific counter
    if (platform === "mobile") {
      update.$inc = { click_count: 1, mobile_click_count: 1 };
    } else {
      update.$inc = { click_count: 1, web_click_count: 1 };
    }
  } else if (options.event_type === "read") {
    update.$set = { is_read: true };
  }

  await NotificationLog.updateOne({ log_id: options.log_id }, update);
}

/**
 * Record engagement by recipient email (for email tracking pixels).
 */
export async function recordEngagementByRecipient(
  tenant_db: string,
  recipient: string,
  event_type: LogEventType,
  metadata?: { url?: string; ip?: string; user_agent?: string }
): Promise<void> {
  const NotificationLog = await getNotificationLogModel();

  // Find the most recent matching log
  const log = await NotificationLog.findOne({
    tenant_db,
    recipient,
    channel: "email",
    status: "sent",
  }).sort({ sent_at: -1 });

  if (log) {
    await recordEngagement({
      log_id: log.log_id,
      event_type,
      metadata,
    });
  }
}

// ============================================
// GET CAMPAIGN STATS
// ============================================

/**
 * Get aggregated statistics for a campaign, grouped by display channel.
 *
 * Returns stats for:
 * - email: Email channel tracking
 * - mobile_app: web_in_app notifications tracked from mobile platform
 * - web: web_in_app notifications tracked from web platform
 *
 * @example
 * ```ts
 * const stats = await getCampaignStats("camp_abc123");
 * // Returns:
 * // {
 * //   email: { sent: 100, failed: 5, opened: 42, clicked: 15 },
 * //   mobile_app: { sent: 90, failed: 1, opened: 35, clicked: 12, read: 35 },
 * //   web: { sent: 90, failed: 1, opened: 10, clicked: 5, read: 35 },
 * // }
 * ```
 */
export async function getCampaignStats(
  campaign_id: string
): Promise<CampaignStats> {
  const NotificationLog = await getNotificationLogModel();

  // Aggregate with platform-specific counters
  const results = await NotificationLog.aggregate([
    { $match: { campaign_id } },
    {
      $group: {
        _id: "$channel",
        sent: {
          $sum: { $cond: [{ $eq: ["$status", "sent"] }, 1, 0] },
        },
        failed: {
          $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
        },
        // Total opens/clicks (for email)
        opened: { $sum: "$open_count" },
        clicked: { $sum: "$click_count" },
        // Platform-specific counters (for web_in_app)
        mobile_opened: { $sum: { $ifNull: ["$mobile_open_count", 0] } },
        mobile_clicked: { $sum: { $ifNull: ["$mobile_click_count", 0] } },
        web_opened: { $sum: { $ifNull: ["$web_open_count", 0] } },
        web_clicked: { $sum: { $ifNull: ["$web_click_count", 0] } },
        read: {
          $sum: { $cond: ["$is_read", 1, 0] },
        },
      },
    },
  ]);

  // Initialize default stats
  const stats: CampaignStats = {
    email: { sent: 0, failed: 0, opened: 0, clicked: 0 },
    mobile_app: { sent: 0, failed: 0, opened: 0, clicked: 0, read: 0 },
    web: { sent: 0, failed: 0, opened: 0, clicked: 0, read: 0 },
  };

  // Populate from aggregation results
  for (const row of results) {
    const channel = row._id as LogChannel;

    if (channel === "email") {
      stats.email = {
        sent: row.sent,
        failed: row.failed,
        opened: row.opened,
        clicked: row.clicked,
      };
    } else if (channel === "web_in_app") {
      // Split web_in_app stats by platform
      // Note: sent/failed counts are shared, but opens/clicks are platform-specific
      stats.mobile_app = {
        sent: row.sent,
        failed: row.failed,
        opened: row.mobile_opened,
        clicked: row.mobile_clicked,
        read: row.read,
      };
      stats.web = {
        sent: row.sent,
        failed: row.failed,
        opened: row.web_opened,
        clicked: row.web_clicked,
        read: row.read,
      };
    }
    // Note: "mobile" channel (FCM push) would go here if we add push tracking
  }

  return stats;
}

// ============================================
// FIND LOGS
// ============================================

/**
 * Find notification log by ID.
 */
export async function findLogById(log_id: string): Promise<INotificationLog | null> {
  const NotificationLog = await getNotificationLogModel();
  return NotificationLog.findOne({ log_id }).lean();
}

/**
 * Find logs by campaign ID.
 */
export async function findLogsByCampaign(
  campaign_id: string,
  options?: { channel?: LogChannel; status?: LogStatus; limit?: number }
): Promise<INotificationLog[]> {
  const NotificationLog = await getNotificationLogModel();

  const query: Record<string, unknown> = { campaign_id };
  if (options?.channel) query.channel = options.channel;
  if (options?.status) query.status = options.status;

  return NotificationLog.find(query)
    .sort({ created_at: -1 })
    .limit(options?.limit || 100)
    .lean();
}

/**
 * Find logs by user ID.
 */
export async function findLogsByUser(
  tenant_db: string,
  user_id: string,
  options?: { channel?: LogChannel; limit?: number }
): Promise<INotificationLog[]> {
  const NotificationLog = await getNotificationLogModel();

  const query: Record<string, unknown> = { tenant_db, user_id };
  if (options?.channel) query.channel = options.channel;

  return NotificationLog.find(query)
    .sort({ created_at: -1 })
    .limit(options?.limit || 50)
    .lean();
}
