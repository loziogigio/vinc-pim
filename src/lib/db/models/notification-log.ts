/**
 * Notification Log Model
 *
 * Unified logging for all notification channels (email, mobile, web_in_app).
 * Tracks delivery status and engagement events (opens, clicks, reads).
 *
 * Stored in vinc-admin database for centralized analytics.
 */

import mongoose, { Schema, Document, Model, Connection } from "mongoose";
import { nanoid } from "nanoid";
import {
  LOG_CHANNELS,
  LOG_SOURCES,
  LOG_STATUSES,
  LOG_EVENT_TYPES,
  type LogChannel,
  type LogSource,
  type LogStatus,
  type LogEventType,
} from "@/lib/constants/notification";
import { connectToAdminDatabase } from "@/lib/db/admin-connection";

// ============================================
// INTERFACES
// ============================================

export type TrackingPlatform = "mobile" | "web";

export interface ILogEvent {
  type: LogEventType;
  timestamp: Date;
  metadata?: {
    url?: string;
    ip?: string;
    user_agent?: string;
    platform?: TrackingPlatform;
    // Click tracking details
    sku?: string;          // Product SKU clicked
    order_number?: string; // Order number clicked
    screen?: string;       // Screen navigated to
    click_type?: string;   // Type of click: "product", "link", "order", etc.
  };
}

export interface INotificationLog extends Document {
  log_id: string;

  // Channel & Source
  channel: LogChannel;
  source: LogSource;
  campaign_id?: string;
  trigger?: string;

  // Target
  tenant_db: string;
  user_id?: string;
  recipient?: string;

  // Content
  title: string;
  body: string;
  action_url?: string;

  // Delivery Status
  status: LogStatus;
  sent_at?: Date;
  error?: string;

  // Engagement Events
  events: ILogEvent[];

  // Quick aggregation fields (total)
  open_count: number;
  click_count: number;
  is_read: boolean;

  // Platform-specific counters (for web_in_app channel)
  mobile_open_count: number;
  mobile_click_count: number;
  web_open_count: number;
  web_click_count: number;

  // Timestamps
  created_at: Date;
  updated_at: Date;

  // Methods
  recordEvent(event: Omit<ILogEvent, "timestamp">): Promise<void>;
  markAsSent(): Promise<void>;
  markAsFailed(error: string): Promise<void>;
}

// ============================================
// SCHEMA
// ============================================

const LogEventSchema = new Schema<ILogEvent>(
  {
    type: {
      type: String,
      enum: LOG_EVENT_TYPES,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      url: String,
      ip: String,
      user_agent: String,
      platform: {
        type: String,
        enum: ["mobile", "web"],
      },
      // Click tracking details
      sku: String,
      order_number: String,
      screen: String,
      click_type: String,
    },
  },
  { _id: false }
);

const NotificationLogSchema = new Schema<INotificationLog>(
  {
    log_id: {
      type: String,
      unique: true,
      default: () => `nlog_${nanoid(12)}`,
    },

    // Channel & Source
    channel: {
      type: String,
      enum: LOG_CHANNELS,
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: LOG_SOURCES,
      required: true,
      index: true,
    },
    campaign_id: {
      type: String,
      index: true,
    },
    trigger: {
      type: String,
      index: true,
    },

    // Target
    tenant_db: {
      type: String,
      required: true,
      index: true,
    },
    user_id: {
      type: String,
      index: true,
    },
    recipient: String,

    // Content
    title: {
      type: String,
      required: true,
    },
    body: String,
    action_url: String,

    // Delivery Status
    status: {
      type: String,
      enum: LOG_STATUSES,
      default: "queued",
      index: true,
    },
    sent_at: Date,
    error: String,

    // Engagement Events
    events: [LogEventSchema],

    // Quick aggregation fields (total)
    open_count: {
      type: Number,
      default: 0,
    },
    click_count: {
      type: Number,
      default: 0,
    },
    is_read: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Platform-specific counters (for web_in_app channel)
    mobile_open_count: {
      type: Number,
      default: 0,
    },
    mobile_click_count: {
      type: Number,
      default: 0,
    },
    web_open_count: {
      type: Number,
      default: 0,
    },
    web_click_count: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "notificationlogs",
  }
);

// ============================================
// INDEXES
// ============================================

// Campaign stats aggregation
NotificationLogSchema.index({ tenant_db: 1, campaign_id: 1 });

// Channel performance queries
NotificationLogSchema.index({ tenant_db: 1, channel: 1, status: 1 });

// User notifications history
NotificationLogSchema.index({ tenant_db: 1, user_id: 1, created_at: -1 });

// Trigger analytics
NotificationLogSchema.index({ source: 1, trigger: 1 });

// Queue processing
NotificationLogSchema.index({ status: 1, created_at: 1 });

// 90-day TTL for automatic cleanup
NotificationLogSchema.index({ created_at: 1 }, { expireAfterSeconds: 7776000 });

// ============================================
// METHODS
// ============================================

/**
 * Record an engagement event (open, click, read, dismiss)
 */
NotificationLogSchema.methods.recordEvent = async function (
  event: Omit<ILogEvent, "timestamp">
): Promise<void> {
  const fullEvent: ILogEvent = {
    ...event,
    timestamp: new Date(),
  };

  this.events.push(fullEvent);

  // Update aggregation fields
  if (event.type === "opened") {
    this.open_count += 1;
  } else if (event.type === "clicked") {
    this.click_count += 1;
  } else if (event.type === "read") {
    this.is_read = true;
  }

  await this.save();
};

/**
 * Mark notification as sent
 */
NotificationLogSchema.methods.markAsSent = async function (): Promise<void> {
  this.status = "sent";
  this.sent_at = new Date();
  await this.save();
};

/**
 * Mark notification as failed
 */
NotificationLogSchema.methods.markAsFailed = async function (
  error: string
): Promise<void> {
  this.status = "failed";
  this.error = error;
  await this.save();
};

// ============================================
// MODEL
// ============================================

// Cached model per connection
let adminNotificationLogModel: Model<INotificationLog> | null = null;

/**
 * Get the NotificationLog model bound to the admin database connection.
 * Must await this function as it ensures the admin connection is ready.
 */
export async function getNotificationLogModel(): Promise<Model<INotificationLog>> {
  const adminConnection = await connectToAdminDatabase();

  // Return cached model if exists on this connection
  if (adminNotificationLogModel) {
    return adminNotificationLogModel;
  }

  // Check if model already registered on admin connection
  if (adminConnection.models.NotificationLog) {
    adminNotificationLogModel = adminConnection.models.NotificationLog as Model<INotificationLog>;
    return adminNotificationLogModel;
  }

  // Create model on admin connection
  adminNotificationLogModel = adminConnection.model<INotificationLog>(
    "NotificationLog",
    NotificationLogSchema
  );
  return adminNotificationLogModel;
}

export { NotificationLogSchema };
