/**
 * Push Subscription Model
 *
 * Stores web push subscriptions for users.
 * Each subscription represents a browser/device that can receive push notifications.
 *
 * Collection: pushsubscriptions (in tenant database)
 */

import mongoose, { Schema, Document, Model } from "mongoose";
import { nanoid } from "nanoid";
import type { PushUserType, PushPreferences, PushSubscriptionKeys } from "@/lib/push/types";

// ============================================
// INTERFACES
// ============================================

export interface IPushSubscription {
  subscription_id: string;
  tenant_id: string;

  // User identification (optional - can be anonymous)
  user_id?: string;
  user_type?: PushUserType;
  customer_id?: string;

  // Push subscription data (from browser PushSubscription)
  endpoint: string;
  keys: PushSubscriptionKeys;

  // Device metadata
  user_agent?: string;
  device_type?: "desktop" | "mobile" | "tablet";

  // Notification preferences
  preferences: PushPreferences;

  // Status
  is_active: boolean;
  last_used_at?: Date;
  failure_count: number;

  created_at: Date;
  updated_at: Date;
}

export interface IPushSubscriptionDocument extends IPushSubscription, Document {
  _id: mongoose.Types.ObjectId;
}

export interface IPushSubscriptionModel extends Model<IPushSubscriptionDocument> {
  findBySubscriptionId(subscriptionId: string): Promise<IPushSubscriptionDocument | null>;
  findByEndpoint(endpoint: string): Promise<IPushSubscriptionDocument | null>;
  findActiveByUserId(userId: string): Promise<IPushSubscriptionDocument[]>;
  findActiveByPreference(preferenceKey: keyof PushPreferences): Promise<IPushSubscriptionDocument[]>;
  incrementFailureCount(subscriptionId: string): Promise<void>;
  resetFailureCount(subscriptionId: string): Promise<void>;
  deactivateByEndpoint(endpoint: string): Promise<void>;
}

// ============================================
// SCHEMA
// ============================================

const PushSubscriptionKeysSchema = new Schema(
  {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true }
  },
  { _id: false }
);

const PushPreferencesSchema = new Schema(
  {
    order_updates: { type: Boolean, default: true },
    price_alerts: { type: Boolean, default: true },
    marketing: { type: Boolean, default: false },
    system: { type: Boolean, default: true }
  },
  { _id: false }
);

export const PushSubscriptionSchema = new Schema<IPushSubscriptionDocument>(
  {
    subscription_id: {
      type: String,
      required: true,
      unique: true,
      default: () => `push_${nanoid(12)}`
    },
    tenant_id: {
      type: String,
      required: true,
      index: true
    },
    user_id: {
      type: String,
      index: true
    },
    user_type: {
      type: String,
      enum: ["b2b_user", "portal_user", "anonymous"]
    },
    customer_id: {
      type: String,
      index: true
    },
    endpoint: {
      type: String,
      required: true,
      index: true
    },
    keys: {
      type: PushSubscriptionKeysSchema,
      required: true
    },
    user_agent: { type: String },
    device_type: {
      type: String,
      enum: ["desktop", "mobile", "tablet"]
    },
    preferences: {
      type: PushPreferencesSchema,
      default: () => ({
        order_updates: true,
        price_alerts: true,
        marketing: false,
        system: true
      })
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true
    },
    last_used_at: { type: Date },
    failure_count: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "pushsubscriptions"
  }
);

// Compound indexes for common queries
PushSubscriptionSchema.index({ tenant_id: 1, is_active: 1 });
PushSubscriptionSchema.index({ tenant_id: 1, user_id: 1, is_active: 1 });
PushSubscriptionSchema.index({ tenant_id: 1, endpoint: 1 }, { unique: true });

// ============================================
// STATIC METHODS
// ============================================

PushSubscriptionSchema.statics.findBySubscriptionId = async function (
  subscriptionId: string
): Promise<IPushSubscriptionDocument | null> {
  return this.findOne({ subscription_id: subscriptionId });
};

PushSubscriptionSchema.statics.findByEndpoint = async function (
  endpoint: string
): Promise<IPushSubscriptionDocument | null> {
  return this.findOne({ endpoint });
};

PushSubscriptionSchema.statics.findActiveByUserId = async function (
  userId: string
): Promise<IPushSubscriptionDocument[]> {
  return this.find({ user_id: userId, is_active: true });
};

PushSubscriptionSchema.statics.findActiveByPreference = async function (
  preferenceKey: keyof PushPreferences
): Promise<IPushSubscriptionDocument[]> {
  return this.find({
    is_active: true,
    [`preferences.${preferenceKey}`]: true
  });
};

PushSubscriptionSchema.statics.incrementFailureCount = async function (
  subscriptionId: string
): Promise<void> {
  const MAX_FAILURES = 5;
  const result = await this.findOneAndUpdate(
    { subscription_id: subscriptionId },
    { $inc: { failure_count: 1 } },
    { new: true }
  );

  // Deactivate if too many failures
  if (result && result.failure_count >= MAX_FAILURES) {
    await this.updateOne(
      { subscription_id: subscriptionId },
      { is_active: false }
    );
  }
};

PushSubscriptionSchema.statics.resetFailureCount = async function (
  subscriptionId: string
): Promise<void> {
  await this.updateOne(
    { subscription_id: subscriptionId },
    { failure_count: 0, last_used_at: new Date() }
  );
};

PushSubscriptionSchema.statics.deactivateByEndpoint = async function (
  endpoint: string
): Promise<void> {
  await this.updateOne({ endpoint }, { is_active: false });
};

// ============================================
// MODEL EXPORT
// ============================================

// Default export for direct imports (uses default connection)
export const PushSubscriptionModel =
  mongoose.models.PushSubscription ||
  mongoose.model<IPushSubscriptionDocument, IPushSubscriptionModel>(
    "PushSubscription",
    PushSubscriptionSchema
  );

/**
 * Get PushSubscription model for a specific connection
 * Use this for multi-tenant database access
 */
export function getPushSubscriptionModel(
  connection: mongoose.Connection
): IPushSubscriptionModel {
  return (
    connection.models.PushSubscription ||
    connection.model<IPushSubscriptionDocument, IPushSubscriptionModel>(
      "PushSubscription",
      PushSubscriptionSchema
    )
  );
}
