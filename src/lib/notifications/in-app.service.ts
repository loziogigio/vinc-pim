/**
 * In-App Notification Service
 *
 * Handles creation and retrieval of in-app notifications
 * (Facebook-style bell icon dropdown).
 */

import { connectWithModels } from "@/lib/db/connection";
import type { NotificationTrigger } from "@/lib/constants/notification";
import type { NotificationUserType, INotificationDocument, NotificationPayload } from "@/lib/db/models/notification";
import { createNotificationLog, recordEngagement, markLogAsSent } from "./notification-log.service";

// ============================================
// TYPES
// ============================================

export interface CreateInAppNotificationOptions {
  tenantDb: string;
  user_id: string;
  user_type?: NotificationUserType;
  trigger: NotificationTrigger;
  title: string;
  body: string;
  icon?: string;
  action_url?: string;
  /** Typed payload by category (generic, product, order, price) */
  payload?: NotificationPayload;
  /** Campaign ID for linking notification to campaign stats */
  campaign_id?: string;
}

export interface GetNotificationsOptions {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  trigger?: NotificationTrigger;
}

export interface NotificationListResult {
  notifications: INotificationDocument[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  unread_count: number;
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Create an in-app notification for a user.
 *
 * @example
 * ```ts
 * await createInAppNotification({
 *   tenantDb: "vinc-hidros-it",
 *   user_id: "user123",
 *   trigger: "order_shipped",
 *   title: "Order Shipped",
 *   body: "Your order #12345 has been shipped",
 *   action_url: "/orders/12345"
 * });
 * ```
 */
export async function createInAppNotification(
  options: CreateInAppNotificationOptions
): Promise<INotificationDocument> {
  const {
    tenantDb,
    user_id,
    user_type = "b2b_user",
    trigger,
    title,
    body,
    icon,
    action_url,
    payload,
    campaign_id,
  } = options;

  const { Notification } = await connectWithModels(tenantDb);

  const notification = await Notification.create({
    user_id,
    user_type,
    trigger,
    title,
    body,
    icon,
    action_url,
    payload,
    campaign_id,
    is_read: false,
  });

  // Create unified notification log for analytics
  const notificationLog = await createNotificationLog({
    channel: "web_in_app",
    source: campaign_id ? "campaign" : (trigger && trigger !== "custom" ? "trigger" : "manual"),
    campaign_id,
    trigger,
    tenant_db: tenantDb,
    user_id,
    title,
    body,
    action_url,
    status: "sent", // In-app notifications are immediately "sent" (delivered)
  });

  // Mark as sent immediately
  await markLogAsSent(notificationLog.log_id);

  // Store the log ID in payload for tracking
  const updatedNotification = await Notification.findOneAndUpdate(
    { notification_id: notification.notification_id },
    { $set: { "payload.notification_log_id": notificationLog.log_id } },
    { new: true }
  ).lean() as INotificationDocument;

  console.log(`[InApp] Created notification for user ${user_id}: ${trigger} (log_id: ${notificationLog.log_id})`);

  return updatedNotification || notification;
}

/**
 * Get notifications for a user with pagination.
 */
export async function getNotifications(
  tenantDb: string,
  userId: string,
  options: GetNotificationsOptions = {}
): Promise<NotificationListResult> {
  const { page = 1, limit = 20, unreadOnly = false, trigger } = options;

  const { Notification } = await connectWithModels(tenantDb);

  const skip = (page - 1) * limit;
  const cappedLimit = Math.min(limit, 100);

  // Build query
  const query: Record<string, unknown> = { user_id: userId };
  if (unreadOnly) {
    query.is_read = false;
  }
  if (trigger) {
    query.trigger = trigger;
  }

  // Get notifications and counts in parallel
  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(cappedLimit)
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ user_id: userId, is_read: false }),
  ]);

  return {
    notifications: notifications as unknown as INotificationDocument[],
    pagination: {
      page,
      limit: cappedLimit,
      total,
      totalPages: Math.ceil(total / cappedLimit),
    },
    unread_count: unreadCount,
  };
}

/**
 * Get unread notification count for a user.
 */
export async function getUnreadCount(
  tenantDb: string,
  userId: string
): Promise<number> {
  const { Notification } = await connectWithModels(tenantDb);
  return Notification.countDocuments({ user_id: userId, is_read: false });
}

/**
 * Get a single notification by ID.
 */
export async function getNotificationById(
  tenantDb: string,
  notificationId: string
): Promise<INotificationDocument | null> {
  const { Notification } = await connectWithModels(tenantDb);
  return Notification.findOne({ notification_id: notificationId }).lean() as Promise<INotificationDocument | null>;
}

/**
 * Mark a notification as read.
 */
export async function markAsRead(
  tenantDb: string,
  notificationId: string
): Promise<INotificationDocument | null> {
  const { Notification } = await connectWithModels(tenantDb);

  const notification = await Notification.findOneAndUpdate(
    { notification_id: notificationId, is_read: false },
    { is_read: true, read_at: new Date() },
    { new: true }
  ).lean() as INotificationDocument | null;

  // Record read engagement in unified notification log
  if (notification) {
    const notificationLogId = (notification.payload as { notification_log_id?: string })?.notification_log_id;
    if (notificationLogId) {
      await recordEngagement({
        log_id: notificationLogId,
        event_type: "read",
      });
    }
  }

  return notification;
}

/**
 * Mark multiple notifications as read.
 */
export async function markManyAsRead(
  tenantDb: string,
  notificationIds: string[]
): Promise<number> {
  const { Notification } = await connectWithModels(tenantDb);

  const result = await Notification.updateMany(
    { notification_id: { $in: notificationIds }, is_read: false },
    { is_read: true, read_at: new Date() }
  );

  return result.modifiedCount;
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllAsRead(
  tenantDb: string,
  userId: string
): Promise<number> {
  const { Notification } = await connectWithModels(tenantDb);

  const result = await Notification.updateMany(
    { user_id: userId, is_read: false },
    { is_read: true, read_at: new Date() }
  );

  return result.modifiedCount;
}

/**
 * Delete a notification by ID.
 */
export async function deleteNotification(
  tenantDb: string,
  notificationId: string
): Promise<boolean> {
  const { Notification } = await connectWithModels(tenantDb);

  const result = await Notification.deleteOne({ notification_id: notificationId });
  return result.deletedCount > 0;
}

/**
 * Delete multiple notifications by IDs.
 */
export async function deleteManyNotifications(
  tenantDb: string,
  notificationIds: string[]
): Promise<number> {
  const { Notification } = await connectWithModels(tenantDb);

  const result = await Notification.deleteMany({ notification_id: { $in: notificationIds } });
  return result.deletedCount;
}
