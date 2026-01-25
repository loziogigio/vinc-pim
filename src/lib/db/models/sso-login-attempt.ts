/**
 * SSO Login Attempt Model
 *
 * Tracks all login attempts for security monitoring.
 * Stored in vinc-admin database.
 */

import { Schema, Model, Document } from "mongoose";
import { connectToAdminDatabase } from "../admin-connection";

// ============================================
// CONSTANTS
// ============================================

export const FAILURE_REASONS = [
  "invalid_credentials",
  "user_not_found",
  "user_blocked",
  "tenant_blocked",
  "ip_blocked",
  "rate_limited",
  "mfa_failed",
  "expired_password",
  "account_locked",
] as const;
export type FailureReason = (typeof FAILURE_REASONS)[number];

// ============================================
// INTERFACE
// ============================================

export interface ILoginAttempt {
  tenant_id?: string;
  email: string;
  ip_address: string;

  success: boolean;
  failure_reason?: FailureReason;

  // Device info
  device_type?: string;
  browser?: string;
  browser_version?: string;
  os?: string;
  user_agent?: string;

  // Location
  country?: string;
  city?: string;

  // Client
  client_id?: string;

  timestamp: Date;
}

export interface ILoginAttemptDocument extends ILoginAttempt, Document {}

export interface ILoginAttemptModel extends Model<ILoginAttemptDocument> {
  countRecentAttempts(
    email: string,
    ip: string,
    tenantId: string | undefined,
    minutesAgo: number
  ): Promise<{ total: number; failed: number }>;
  countRecentIPAttempts(ip: string, minutesAgo: number): Promise<number>;
  getRecentAttempts(tenantId: string, limit?: number): Promise<ILoginAttemptDocument[]>;
}

// ============================================
// SCHEMA
// ============================================

const LoginAttemptSchema = new Schema<ILoginAttemptDocument>(
  {
    tenant_id: { type: String },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    ip_address: {
      type: String,
      required: true,
    },

    success: {
      type: Boolean,
      required: true,
    },
    failure_reason: {
      type: String,
      enum: FAILURE_REASONS,
    },

    // Device info
    device_type: { type: String },
    browser: { type: String },
    browser_version: { type: String },
    os: { type: String },
    user_agent: { type: String },

    // Location
    country: { type: String },
    city: { type: String },

    // Client
    client_id: { type: String },

    timestamp: {
      type: Date,
      default: Date.now,
      index: { expires: 60 * 60 * 24 * 30 }, // TTL: 30 days
    },
  },
  {
    timestamps: false,
  }
);

// ============================================
// INDEXES
// ============================================

LoginAttemptSchema.index({ email: 1, timestamp: -1 });
LoginAttemptSchema.index({ ip_address: 1, timestamp: -1 });
LoginAttemptSchema.index({ tenant_id: 1, timestamp: -1 });
LoginAttemptSchema.index({ email: 1, ip_address: 1, tenant_id: 1, timestamp: -1 });
LoginAttemptSchema.index({ success: 1, timestamp: -1 });

// ============================================
// STATICS
// ============================================

LoginAttemptSchema.statics.countRecentAttempts = async function (
  email: string,
  ip: string,
  tenantId: string | undefined,
  minutesAgo: number
): Promise<{ total: number; failed: number }> {
  const since = new Date(Date.now() - minutesAgo * 60 * 1000);

  const query: Record<string, unknown> = {
    $or: [{ email: email.toLowerCase() }, { ip_address: ip }],
    timestamp: { $gte: since },
  };

  if (tenantId) {
    query.tenant_id = tenantId;
  }

  const attempts = await this.find(query);
  const total = attempts.length;
  const failed = attempts.filter((a: ILoginAttemptDocument) => !a.success).length;

  return { total, failed };
};

LoginAttemptSchema.statics.countRecentIPAttempts = async function (
  ip: string,
  minutesAgo: number
): Promise<number> {
  const since = new Date(Date.now() - minutesAgo * 60 * 1000);

  return this.countDocuments({
    ip_address: ip,
    success: false,
    timestamp: { $gte: since },
  });
};

LoginAttemptSchema.statics.getRecentAttempts = function (
  tenantId: string,
  limit = 100
): Promise<ILoginAttemptDocument[]> {
  return this.find({ tenant_id: tenantId })
    .sort({ timestamp: -1 })
    .limit(limit);
};

// ============================================
// MODEL GETTER
// ============================================

let LoginAttemptModel: ILoginAttemptModel | null = null;

/**
 * Get the LoginAttempt model.
 * Must call connectToAdminDatabase() first.
 */
export async function getLoginAttemptModel(): Promise<ILoginAttemptModel> {
  const connection = await connectToAdminDatabase();

  if (LoginAttemptModel && LoginAttemptModel.db !== connection) {
    LoginAttemptModel = null;
  }

  if (LoginAttemptModel) {
    return LoginAttemptModel;
  }

  if (connection.models.LoginAttempt) {
    LoginAttemptModel = connection.models.LoginAttempt as ILoginAttemptModel;
  } else {
    LoginAttemptModel = connection.model<ILoginAttemptDocument, ILoginAttemptModel>(
      "LoginAttempt",
      LoginAttemptSchema
    );
  }

  return LoginAttemptModel;
}
