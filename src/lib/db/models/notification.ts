/**
 * In-App Notification Model
 *
 * Stores in-app notifications for users (Facebook-style bell icon dropdown).
 * Notifications are created when a notification template with in_app channel
 * enabled is triggered.
 *
 * Collection: notifications (in tenant database)
 */

import mongoose, { Schema, Document, Model } from "mongoose";
import { nanoid } from "nanoid";
import type { NotificationTrigger } from "@/lib/constants/notification";
import { NOTIFICATION_TRIGGERS } from "@/lib/constants/notification";
import type { NotificationPayload } from "@/lib/types/notification-payload";
import { NOTIFICATION_CATEGORIES } from "@/lib/types/notification-payload";

// Re-export payload types for convenience
export type { NotificationPayload } from "@/lib/types/notification-payload";
export {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type NotificationMedia,
  type NotificationProduct,
  type NotificationProductWithPrice,
  type NotificationOrder,
  type NotificationOrderItem,
  type GenericPayload,
  type ProductPayload,
  type OrderPayload,
  type PricePayload,
} from "@/lib/types/notification-payload";

// ============================================
// TYPES
// ============================================

export type NotificationUserType = "b2b_user" | "portal_user";

// ============================================
// INTERFACES
// ============================================

export interface INotification {
  notification_id: string;
  user_id: string;
  user_type: NotificationUserType;

  // Content (rendered from template)
  trigger: NotificationTrigger;
  title: string;
  body: string;
  icon?: string;
  action_url?: string;

  // Typed payload by category (generic, product, order, price)
  payload?: NotificationPayload;

  // Status
  is_read: boolean;
  read_at?: Date;

  // Timestamps
  created_at: Date;
  updated_at: Date;
}

export interface INotificationDocument extends INotification, Document {
  _id: mongoose.Types.ObjectId;
}

export interface INotificationModel extends Model<INotificationDocument> {
  findByNotificationId(notificationId: string): Promise<INotificationDocument | null>;
  findByUserId(
    userId: string,
    options?: { limit?: number; skip?: number; unreadOnly?: boolean; trigger?: NotificationTrigger }
  ): Promise<INotificationDocument[]>;
  countByUserId(userId: string, unreadOnly?: boolean): Promise<number>;
  markAsRead(notificationId: string): Promise<INotificationDocument | null>;
  markManyAsRead(notificationIds: string[]): Promise<number>;
  deleteByIds(notificationIds: string[]): Promise<number>;
}

// ============================================
// SCHEMA
// ============================================

export const NotificationSchema = new Schema<INotificationDocument>(
  {
    notification_id: {
      type: String,
      required: true,
      unique: true,
      default: () => `notif_${nanoid(12)}`
    },
    user_id: {
      type: String,
      required: true,
      index: true
    },
    user_type: {
      type: String,
      enum: ["b2b_user", "portal_user"],
      default: "b2b_user"
    },
    trigger: {
      type: String,
      enum: NOTIFICATION_TRIGGERS,
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true
    },
    body: {
      type: String,
      required: true
    },
    icon: { type: String },
    action_url: { type: String },
    // Typed payload with category discriminator
    payload: {
      type: new Schema(
        {
          category: {
            type: String,
            enum: NOTIFICATION_CATEGORIES,
            required: true
          },
          // Media (optional for all categories)
          media: {
            icon: { type: String },
            image: { type: String },
            images: [{ type: String }]
          },
          // Product category fields
          products: [
            {
              sku: { type: String },
              name: { type: String },
              image: { type: String },
              item_ref: { type: String },
              // Price fields (for price category)
              original_price: { type: String },
              sale_price: { type: String },
              discount: { type: String }
            }
          ],
          // Order category fields
          order: {
            id: { type: String },
            number: { type: String },
            status: { type: String },
            total: { type: String },
            carrier: { type: String },
            tracking_code: { type: String },
            item_ref: { type: String },
            items: [
              {
                sku: { type: String },
                name: { type: String },
                image: { type: String },
                quantity: { type: Number }
              }
            ]
          },
          // Price category specific fields
          expires_at: { type: String },
          discount_label: { type: String },
          // Generic category specific fields
          url: { type: String },
          open_in_new_tab: { type: Boolean, default: true },
          // Search filters for product/price categories
          filters: {
            type: Schema.Types.Mixed,
            default: undefined
          }
        },
        { _id: false }
      )
    },
    is_read: {
      type: Boolean,
      default: false,
      index: true
    },
    read_at: { type: Date }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "notifications"
  }
);

// Compound indexes for common queries
NotificationSchema.index({ user_id: 1, created_at: -1 }); // List by user (newest first)
NotificationSchema.index({ user_id: 1, is_read: 1 }); // Unread count
NotificationSchema.index({ user_id: 1, trigger: 1, created_at: -1 }); // Filter by trigger

// ============================================
// STATIC METHODS
// ============================================

NotificationSchema.statics.findByNotificationId = async function (
  notificationId: string
): Promise<INotificationDocument | null> {
  return this.findOne({ notification_id: notificationId });
};

NotificationSchema.statics.findByUserId = async function (
  userId: string,
  options: { limit?: number; skip?: number; unreadOnly?: boolean; trigger?: NotificationTrigger } = {}
): Promise<INotificationDocument[]> {
  const { limit = 20, skip = 0, unreadOnly = false, trigger } = options;

  const query: Record<string, unknown> = { user_id: userId };

  if (unreadOnly) {
    query.is_read = false;
  }

  if (trigger) {
    query.trigger = trigger;
  }

  return this.find(query)
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limit);
};

NotificationSchema.statics.countByUserId = async function (
  userId: string,
  unreadOnly = false
): Promise<number> {
  const query: Record<string, unknown> = { user_id: userId };

  if (unreadOnly) {
    query.is_read = false;
  }

  return this.countDocuments(query);
};

NotificationSchema.statics.markAsRead = async function (
  notificationId: string
): Promise<INotificationDocument | null> {
  return this.findOneAndUpdate(
    { notification_id: notificationId, is_read: false },
    { is_read: true, read_at: new Date() },
    { new: true }
  );
};

NotificationSchema.statics.markManyAsRead = async function (
  notificationIds: string[]
): Promise<number> {
  const result = await this.updateMany(
    { notification_id: { $in: notificationIds }, is_read: false },
    { is_read: true, read_at: new Date() }
  );
  return result.modifiedCount;
};

NotificationSchema.statics.deleteByIds = async function (
  notificationIds: string[]
): Promise<number> {
  const result = await this.deleteMany({ notification_id: { $in: notificationIds } });
  return result.deletedCount;
};

// ============================================
// MODEL EXPORT
// ============================================

// Default export for direct imports (uses default connection)
export const NotificationModel =
  mongoose.models.Notification ||
  mongoose.model<INotificationDocument, INotificationModel>(
    "Notification",
    NotificationSchema
  );

/**
 * Get Notification model for a specific connection
 * Use this for multi-tenant database access
 */
export function getNotificationModel(
  connection: mongoose.Connection
): INotificationModel {
  return (
    connection.models.Notification ||
    connection.model<INotificationDocument, INotificationModel>(
      "Notification",
      NotificationSchema
    )
  );
}
