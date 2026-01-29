/**
 * Push Log Model
 *
 * Tracks all push notifications sent across tenants.
 * Stored in vinc-admin database for centralized tracking and analytics.
 *
 * Collection: pushlogs (in vinc-admin database)
 */

import mongoose, { Schema, Document, Model } from "mongoose";
import { nanoid } from "nanoid";
import type { PushStatus } from "@/lib/push/types";

// ============================================
// INTERFACES
// ============================================

export interface IPushLog {
  push_id: string;
  subscription_id: string;
  tenant_db: string;

  // Content
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  action_url?: string;
  data?: Record<string, unknown>;

  // Template reference
  template_id?: string;
  trigger?: string;

  // Campaign reference
  campaign_id?: string;

  // Status tracking
  status: PushStatus;
  error?: string;

  // Timing
  scheduled_at?: Date;
  sent_at?: Date;

  // Interaction tracking
  clicked_at?: Date;
  clicked_url?: string;
  dismissed_at?: Date;

  // Queue info
  priority: number;
  attempts: number;

  created_at: Date;
  updated_at: Date;
}

export interface IPushLogDocument extends IPushLog, Document {
  _id: mongoose.Types.ObjectId;
}

export interface IPushLogModel extends Model<IPushLogDocument> {
  findByPushId(pushId: string): Promise<IPushLogDocument | null>;
  findByTenant(tenantDb: string, options?: { limit?: number; skip?: number }): Promise<IPushLogDocument[]>;
  countByTenant(tenantDb: string): Promise<number>;
  getStats(tenantDb: string): Promise<{
    total: number;
    sent: number;
    failed: number;
    clicked: number;
    clickRate: number;
  }>;
  markAsSent(pushId: string): Promise<void>;
  markAsFailed(pushId: string, error: string): Promise<void>;
  recordClick(pushId: string, url?: string): Promise<boolean>;
  recordDismiss(pushId: string): Promise<boolean>;
}

// ============================================
// SCHEMA
// ============================================

export const PushLogSchema = new Schema<IPushLogDocument>(
  {
    push_id: {
      type: String,
      required: true,
      unique: true,
      default: () => `plog_${nanoid(12)}`
    },
    subscription_id: {
      type: String,
      required: true,
      index: true
    },
    tenant_db: {
      type: String,
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
    badge: { type: String },
    action_url: { type: String },
    data: {
      type: Schema.Types.Mixed
    },
    template_id: { type: String },
    trigger: { type: String },
    campaign_id: {
      type: String,
      index: true
    },
    status: {
      type: String,
      enum: ["queued", "sending", "sent", "failed", "expired"],
      default: "queued",
      index: true
    },
    error: { type: String },
    scheduled_at: { type: Date },
    sent_at: { type: Date },
    clicked_at: { type: Date },
    clicked_url: { type: String },
    dismissed_at: { type: Date },
    priority: {
      type: Number,
      default: 5,
      min: 1,
      max: 10
    },
    attempts: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "pushlogs"
  }
);

// Compound indexes
PushLogSchema.index({ tenant_db: 1, status: 1 });
PushLogSchema.index({ tenant_db: 1, created_at: -1 });
PushLogSchema.index({ status: 1, scheduled_at: 1 }); // For queue processing
PushLogSchema.index({ created_at: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // TTL: 90 days

// ============================================
// STATIC METHODS
// ============================================

PushLogSchema.statics.findByPushId = async function (
  pushId: string
): Promise<IPushLogDocument | null> {
  return this.findOne({ push_id: pushId });
};

PushLogSchema.statics.findByTenant = async function (
  tenantDb: string,
  options: { limit?: number; skip?: number } = {}
): Promise<IPushLogDocument[]> {
  const { limit = 50, skip = 0 } = options;
  return this.find({ tenant_db: tenantDb })
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limit);
};

PushLogSchema.statics.countByTenant = async function (
  tenantDb: string
): Promise<number> {
  return this.countDocuments({ tenant_db: tenantDb });
};

PushLogSchema.statics.getStats = async function (
  tenantDb: string
): Promise<{
  total: number;
  sent: number;
  failed: number;
  clicked: number;
  clickRate: number;
}> {
  const [stats] = await this.aggregate([
    { $match: { tenant_db: tenantDb } },
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

  if (!stats) {
    return { total: 0, sent: 0, failed: 0, clicked: 0, clickRate: 0 };
  }

  const clickRate = stats.sent > 0 ? (stats.clicked / stats.sent) * 100 : 0;

  return {
    total: stats.total,
    sent: stats.sent,
    failed: stats.failed,
    clicked: stats.clicked,
    clickRate: Math.round(clickRate * 100) / 100
  };
};

PushLogSchema.statics.markAsSent = async function (
  pushId: string
): Promise<void> {
  await this.updateOne(
    { push_id: pushId },
    {
      status: "sent",
      sent_at: new Date(),
      $inc: { attempts: 1 }
    }
  );
};

PushLogSchema.statics.markAsFailed = async function (
  pushId: string,
  error: string
): Promise<void> {
  await this.updateOne(
    { push_id: pushId },
    {
      status: "failed",
      error,
      $inc: { attempts: 1 }
    }
  );
};

PushLogSchema.statics.recordClick = async function (
  pushId: string,
  url?: string
): Promise<boolean> {
  const result = await this.updateOne(
    { push_id: pushId, clicked_at: null },
    {
      clicked_at: new Date(),
      ...(url && { clicked_url: url })
    }
  );
  return result.modifiedCount > 0;
};

PushLogSchema.statics.recordDismiss = async function (
  pushId: string
): Promise<boolean> {
  const result = await this.updateOne(
    { push_id: pushId, dismissed_at: null },
    { dismissed_at: new Date() }
  );
  return result.modifiedCount > 0;
};

// ============================================
// MODEL EXPORT
// ============================================

// Note: This model is for the admin database (vinc-admin)
// Use getPushLogModel with admin connection for multi-tenant access

export const PushLogSchema_ = PushLogSchema;

/**
 * Get PushLog model for admin database connection
 * This should be used with the admin database connection
 */
export function getPushLogModel(
  connection: mongoose.Connection
): IPushLogModel {
  return (
    connection.models.PushLog ||
    connection.model<IPushLogDocument, IPushLogModel>("PushLog", PushLogSchema)
  );
}

// Default model for when using default connection
export const PushLogModel =
  mongoose.models.PushLog ||
  mongoose.model<IPushLogDocument, IPushLogModel>("PushLog", PushLogSchema);
