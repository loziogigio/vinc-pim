/**
 * SSO Session Model
 *
 * Active user sessions across all client applications.
 * Stored in vinc-admin database.
 */

import { Schema, Model, Document } from "mongoose";
import { connectToAdminDatabase } from "../admin-connection";

// ============================================
// CONSTANTS
// ============================================

export const DEVICE_TYPES = ["desktop", "mobile", "tablet", "unknown"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export const CLIENT_APPS = ["vinc-b2b", "vinc-vetrina", "vinc-pim", "vinc-commerce-suite", "vinc-mobile", "other"] as const;
export type ClientApp = (typeof CLIENT_APPS)[number];

// ============================================
// INTERFACE
// ============================================

export interface ISSOSessionVincProfile {
  id: string;
  email: string;
  name?: string;
  role: string;
  supplier_id?: string;
  supplier_name?: string;
  customers: {
    id: string;
    erp_customer_id: string;
    name?: string;
    business_name?: string;
    addresses: {
      id: string;
      erp_address_id: string;
      label?: string;
      pricelist_code?: string;
    }[];
  }[];
  has_password: boolean;
}

export interface ISSOSession {
  session_id: string;
  tenant_id: string;
  user_id: string;
  user_email: string;
  user_role: string;
  company_name?: string;
  // Full VINC profile for API responses
  vinc_profile?: ISSOSessionVincProfile;

  // Client info
  client_app: ClientApp;
  storefront_id?: string;

  // Device tracking
  ip_address: string;
  country?: string;
  city?: string;
  device_type: DeviceType;
  browser?: string;
  browser_version?: string;
  os?: string;
  os_version?: string;
  user_agent?: string;
  device_fingerprint?: string;

  // Token tracking
  refresh_token_hash: string;
  access_token_jti?: string;

  // Timestamps
  created_at: Date;
  last_activity: Date;
  expires_at: Date;

  // Status
  is_active: boolean;
  revoked_at?: Date;
  revoked_reason?: string;
}

export interface ISSOSessionDocument extends ISSOSession, Document {}

export interface ISSOSessionModel extends Model<ISSOSessionDocument> {
  findBySessionId(sessionId: string): Promise<ISSOSessionDocument | null>;
  findActiveSessions(tenantId: string, userId: string): Promise<ISSOSessionDocument[]>;
  findAllActiveSessions(tenantId: string): Promise<ISSOSessionDocument[]>;
  revokeSession(sessionId: string, reason?: string): Promise<ISSOSessionDocument | null>;
  revokeAllUserSessions(tenantId: string, userId: string, reason?: string): Promise<number>;
  updateLastActivity(sessionId: string): Promise<void>;
}

// ============================================
// SCHEMA
// ============================================

const SSOSessionSchema = new Schema<ISSOSessionDocument>(
  {
    session_id: {
      type: String,
      required: true,
      unique: true,
    },
    tenant_id: {
      type: String,
      required: true,
    },
    user_id: {
      type: String,
      required: true,
    },
    user_email: {
      type: String,
      required: true,
      lowercase: true,
    },
    user_role: {
      type: String,
      required: true,
    },
    company_name: { type: String },
    // Full VINC profile (stored as JSON)
    vinc_profile: { type: Schema.Types.Mixed },

    // Client info
    client_app: {
      type: String,
      enum: CLIENT_APPS,
      default: "other",
    },
    storefront_id: { type: String },

    // Device tracking
    ip_address: {
      type: String,
      required: true,
    },
    country: { type: String },
    city: { type: String },
    device_type: {
      type: String,
      enum: DEVICE_TYPES,
      default: "unknown",
    },
    browser: { type: String },
    browser_version: { type: String },
    os: { type: String },
    os_version: { type: String },
    user_agent: { type: String },
    device_fingerprint: { type: String },

    // Token tracking
    refresh_token_hash: {
      type: String,
      required: true,
    },
    access_token_jti: { type: String },

    // Timestamps
    last_activity: {
      type: Date,
      default: Date.now,
    },
    expires_at: {
      type: Date,
      required: true,
    },

    // Status
    is_active: {
      type: Boolean,
      default: true,
    },
    revoked_at: { type: Date },
    revoked_reason: { type: String },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
  }
);

// ============================================
// INDEXES
// ============================================

SSOSessionSchema.index({ session_id: 1 }, { unique: true });
SSOSessionSchema.index({ tenant_id: 1, user_id: 1, is_active: 1 });
SSOSessionSchema.index({ tenant_id: 1, is_active: 1 });
SSOSessionSchema.index({ refresh_token_hash: 1 });
SSOSessionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 }); // TTL index
SSOSessionSchema.index({ last_activity: 1 });

// ============================================
// STATICS
// ============================================

SSOSessionSchema.statics.findBySessionId = function (
  sessionId: string
): Promise<ISSOSessionDocument | null> {
  return this.findOne({
    session_id: sessionId,
    is_active: true,
    expires_at: { $gt: new Date() },
  });
};

SSOSessionSchema.statics.findActiveSessions = function (
  tenantId: string,
  userId: string
): Promise<ISSOSessionDocument[]> {
  return this.find({
    tenant_id: tenantId,
    user_id: userId,
    is_active: true,
    expires_at: { $gt: new Date() },
  }).sort({ last_activity: -1 });
};

SSOSessionSchema.statics.findAllActiveSessions = function (
  tenantId: string
): Promise<ISSOSessionDocument[]> {
  return this.find({
    tenant_id: tenantId,
    is_active: true,
    expires_at: { $gt: new Date() },
  }).sort({ last_activity: -1 });
};

SSOSessionSchema.statics.revokeSession = function (
  sessionId: string,
  reason?: string
): Promise<ISSOSessionDocument | null> {
  return this.findOneAndUpdate(
    { session_id: sessionId, is_active: true },
    {
      $set: {
        is_active: false,
        revoked_at: new Date(),
        revoked_reason: reason || "manual_revocation",
      },
    },
    { new: true }
  );
};

SSOSessionSchema.statics.revokeAllUserSessions = async function (
  tenantId: string,
  userId: string,
  reason?: string
): Promise<number> {
  const result = await this.updateMany(
    { tenant_id: tenantId, user_id: userId, is_active: true },
    {
      $set: {
        is_active: false,
        revoked_at: new Date(),
        revoked_reason: reason || "bulk_revocation",
      },
    }
  );
  return result.modifiedCount;
};

SSOSessionSchema.statics.updateLastActivity = async function (
  sessionId: string
): Promise<void> {
  await this.updateOne(
    { session_id: sessionId },
    { $set: { last_activity: new Date() } }
  );
};

// ============================================
// MODEL GETTER
// ============================================

let SSOSessionModel: ISSOSessionModel | null = null;

/**
 * Get the SSOSession model.
 * Must call connectToAdminDatabase() first.
 */
export async function getSSOSessionModel(): Promise<ISSOSessionModel> {
  const connection = await connectToAdminDatabase();

  if (SSOSessionModel && SSOSessionModel.db !== connection) {
    SSOSessionModel = null;
  }

  if (SSOSessionModel) {
    return SSOSessionModel;
  }

  if (connection.models.SSOSession) {
    SSOSessionModel = connection.models.SSOSession as ISSOSessionModel;
  } else {
    SSOSessionModel = connection.model<ISSOSessionDocument, ISSOSessionModel>(
      "SSOSession",
      SSOSessionSchema
    );
  }

  return SSOSessionModel;
}
