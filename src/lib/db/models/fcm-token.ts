/**
 * FCM Token Model
 *
 * Stores Firebase Cloud Messaging tokens for native mobile apps (iOS/Android).
 * Separate from PushSubscription which is for Web Push (VAPID-based browser notifications).
 *
 * Collection: fcmtokens (in tenant database)
 */

import mongoose, { Schema, Document, Model } from "mongoose";
import { nanoid } from "nanoid";

// ============================================
// TYPES
// ============================================

export type FCMPlatform = "ios" | "android";
export type FCMUserType = "b2b_user" | "portal_user";

export interface FCMPreferences {
  order_updates: boolean;
  price_alerts: boolean;
  marketing: boolean;
  system: boolean;
}

export const DEFAULT_FCM_PREFERENCES: FCMPreferences = {
  order_updates: true,
  price_alerts: true,
  marketing: false,
  system: true,
};

// ============================================
// INTERFACES
// ============================================

export interface IFCMToken {
  token_id: string;
  tenant_id: string;

  // User identification (optional for anonymous/pre-login devices)
  user_id?: string;
  user_type: FCMUserType;
  customer_id?: string;

  // FCM token data
  fcm_token: string;
  platform: FCMPlatform;

  // Device metadata
  device_id?: string;
  device_model?: string;
  app_version?: string;
  os_version?: string;

  // Notification preferences
  preferences: FCMPreferences;

  // Status
  is_active: boolean;
  last_used_at?: Date;
  failure_count: number;

  created_at: Date;
  updated_at: Date;
}

export interface IFCMTokenDocument extends IFCMToken, Document {
  _id: mongoose.Types.ObjectId;
}

export interface IFCMTokenModel extends Model<IFCMTokenDocument> {
  findByTokenId(tokenId: string): Promise<IFCMTokenDocument | null>;
  findByFCMToken(fcmToken: string): Promise<IFCMTokenDocument | null>;
  findActiveByUserId(userId: string): Promise<IFCMTokenDocument[]>;
  findActiveByPreference(preferenceKey: keyof FCMPreferences): Promise<IFCMTokenDocument[]>;
  incrementFailureCount(tokenId: string): Promise<void>;
  resetFailureCount(tokenId: string): Promise<void>;
  deactivateByFCMToken(fcmToken: string): Promise<void>;
}

// ============================================
// SCHEMA
// ============================================

const FCMPreferencesSchema = new Schema(
  {
    order_updates: { type: Boolean, default: true },
    price_alerts: { type: Boolean, default: true },
    marketing: { type: Boolean, default: false },
    system: { type: Boolean, default: true }
  },
  { _id: false }
);

export const FCMTokenSchema = new Schema<IFCMTokenDocument>(
  {
    token_id: {
      type: String,
      required: true,
      unique: true,
      default: () => `fcm_${nanoid(12)}`
    },
    tenant_id: {
      type: String,
      required: true,
      index: true
    },
    user_id: {
      type: String,
      required: false, // Optional for anonymous/pre-login devices
      index: true
    },
    user_type: {
      type: String,
      enum: ["b2b_user", "portal_user"],
      default: "portal_user"
    },
    customer_id: {
      type: String,
      index: true
    },
    fcm_token: {
      type: String,
      required: true,
      index: true
    },
    platform: {
      type: String,
      enum: ["ios", "android"],
      required: true
    },
    device_id: { type: String },
    device_model: { type: String },
    app_version: { type: String },
    os_version: { type: String },
    preferences: {
      type: FCMPreferencesSchema,
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
    collection: "fcmtokens"
  }
);

// Compound indexes for common queries
FCMTokenSchema.index({ tenant_id: 1, is_active: 1 });
FCMTokenSchema.index({ tenant_id: 1, user_id: 1, is_active: 1 });
FCMTokenSchema.index({ tenant_id: 1, fcm_token: 1 }, { unique: true });
FCMTokenSchema.index({ tenant_id: 1, platform: 1, is_active: 1 });

// ============================================
// STATIC METHODS
// ============================================

FCMTokenSchema.statics.findByTokenId = async function (
  tokenId: string
): Promise<IFCMTokenDocument | null> {
  return this.findOne({ token_id: tokenId });
};

FCMTokenSchema.statics.findByFCMToken = async function (
  fcmToken: string
): Promise<IFCMTokenDocument | null> {
  return this.findOne({ fcm_token: fcmToken });
};

FCMTokenSchema.statics.findActiveByUserId = async function (
  userId: string
): Promise<IFCMTokenDocument[]> {
  return this.find({ user_id: userId, is_active: true });
};

FCMTokenSchema.statics.findActiveByPreference = async function (
  preferenceKey: keyof FCMPreferences
): Promise<IFCMTokenDocument[]> {
  return this.find({
    is_active: true,
    [`preferences.${preferenceKey}`]: true
  });
};

FCMTokenSchema.statics.incrementFailureCount = async function (
  tokenId: string
): Promise<void> {
  const MAX_FAILURES = 5;
  const result = await this.findOneAndUpdate(
    { token_id: tokenId },
    { $inc: { failure_count: 1 } },
    { new: true }
  );

  // Deactivate if too many failures
  if (result && result.failure_count >= MAX_FAILURES) {
    await this.updateOne(
      { token_id: tokenId },
      { is_active: false }
    );
  }
};

FCMTokenSchema.statics.resetFailureCount = async function (
  tokenId: string
): Promise<void> {
  await this.updateOne(
    { token_id: tokenId },
    { failure_count: 0, last_used_at: new Date() }
  );
};

FCMTokenSchema.statics.deactivateByFCMToken = async function (
  fcmToken: string
): Promise<void> {
  await this.updateOne({ fcm_token: fcmToken }, { is_active: false });
};

// ============================================
// MODEL EXPORT
// ============================================

// Default export for direct imports (uses default connection)
export const FCMTokenModel =
  mongoose.models.FCMToken ||
  mongoose.model<IFCMTokenDocument, IFCMTokenModel>(
    "FCMToken",
    FCMTokenSchema
  );

/**
 * Get FCMToken model for a specific connection
 * Use this for multi-tenant database access
 */
export function getFCMTokenModel(
  connection: mongoose.Connection
): IFCMTokenModel {
  return (
    connection.models.FCMToken ||
    connection.model<IFCMTokenDocument, IFCMTokenModel>(
      "FCMToken",
      FCMTokenSchema
    )
  );
}
