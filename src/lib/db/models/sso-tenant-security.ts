/**
 * SSO Tenant Security Config Model
 *
 * Per-tenant security settings and IP blocklist.
 * Stored in vinc-admin database.
 */

import { Schema, Model, Document } from "mongoose";
import { connectToAdminDatabase } from "../admin-connection";

// ============================================
// INTERFACE
// ============================================

export interface ITenantSecurityConfig {
  tenant_id: string;

  // Session limits
  max_sessions_per_user: number;
  session_timeout_hours: number;

  // Login protection
  max_login_attempts: number;
  lockout_minutes: number;
  enable_progressive_delay: boolean;

  // Password policy
  require_strong_password: boolean;
  password_expiry_days?: number;

  // Notifications
  notify_on_new_device: boolean;
  notify_on_suspicious_login: boolean;
  notify_on_password_change: boolean;
  alert_email?: string;

  // IP restrictions
  allowed_ips?: string[];
  blocked_ips?: string[];

  created_at: Date;
  updated_at: Date;
}

export interface ITenantSecurityConfigDocument extends ITenantSecurityConfig, Document {}

export interface ITenantSecurityConfigModel extends Model<ITenantSecurityConfigDocument> {
  findByTenantId(tenantId: string): Promise<ITenantSecurityConfigDocument | null>;
  getOrCreateDefault(tenantId: string): Promise<ITenantSecurityConfigDocument>;
}

// ============================================
// DEFAULTS
// ============================================

export const DEFAULT_SECURITY_CONFIG: Omit<ITenantSecurityConfig, "tenant_id" | "created_at" | "updated_at"> = {
  max_sessions_per_user: 5,
  session_timeout_hours: 24,
  max_login_attempts: 5,
  lockout_minutes: 15,
  enable_progressive_delay: true,
  require_strong_password: true,
  notify_on_new_device: true,
  notify_on_suspicious_login: true,
  notify_on_password_change: true,
};

// ============================================
// SCHEMA
// ============================================

const TenantSecurityConfigSchema = new Schema<ITenantSecurityConfigDocument>(
  {
    tenant_id: {
      type: String,
      required: true,
      unique: true,
    },

    // Session limits
    max_sessions_per_user: {
      type: Number,
      default: DEFAULT_SECURITY_CONFIG.max_sessions_per_user,
    },
    session_timeout_hours: {
      type: Number,
      default: DEFAULT_SECURITY_CONFIG.session_timeout_hours,
    },

    // Login protection
    max_login_attempts: {
      type: Number,
      default: DEFAULT_SECURITY_CONFIG.max_login_attempts,
    },
    lockout_minutes: {
      type: Number,
      default: DEFAULT_SECURITY_CONFIG.lockout_minutes,
    },
    enable_progressive_delay: {
      type: Boolean,
      default: DEFAULT_SECURITY_CONFIG.enable_progressive_delay,
    },

    // Password policy
    require_strong_password: {
      type: Boolean,
      default: DEFAULT_SECURITY_CONFIG.require_strong_password,
    },
    password_expiry_days: { type: Number },

    // Notifications
    notify_on_new_device: {
      type: Boolean,
      default: DEFAULT_SECURITY_CONFIG.notify_on_new_device,
    },
    notify_on_suspicious_login: {
      type: Boolean,
      default: DEFAULT_SECURITY_CONFIG.notify_on_suspicious_login,
    },
    notify_on_password_change: {
      type: Boolean,
      default: DEFAULT_SECURITY_CONFIG.notify_on_password_change,
    },
    alert_email: { type: String },

    // IP restrictions
    allowed_ips: [{ type: String }],
    blocked_ips: [{ type: String }],
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// ============================================
// INDEXES
// ============================================

// Note: tenant_id index already created by unique: true in field definition

// ============================================
// STATICS
// ============================================

TenantSecurityConfigSchema.statics.findByTenantId = function (
  tenantId: string
): Promise<ITenantSecurityConfigDocument | null> {
  return this.findOne({ tenant_id: tenantId });
};

TenantSecurityConfigSchema.statics.getOrCreateDefault = async function (
  tenantId: string
): Promise<ITenantSecurityConfigDocument> {
  let config = await this.findOne({ tenant_id: tenantId });

  if (!config) {
    config = await this.create({
      tenant_id: tenantId,
      ...DEFAULT_SECURITY_CONFIG,
    });
  }

  return config;
};

// ============================================
// MODEL GETTER
// ============================================

let TenantSecurityConfigModel: ITenantSecurityConfigModel | null = null;

/**
 * Get the TenantSecurityConfig model.
 * Must call connectToAdminDatabase() first.
 */
export async function getTenantSecurityConfigModel(): Promise<ITenantSecurityConfigModel> {
  const connection = await connectToAdminDatabase();

  if (TenantSecurityConfigModel && TenantSecurityConfigModel.db !== connection) {
    TenantSecurityConfigModel = null;
  }

  if (TenantSecurityConfigModel) {
    return TenantSecurityConfigModel;
  }

  if (connection.models.TenantSecurityConfig) {
    TenantSecurityConfigModel = connection.models.TenantSecurityConfig as ITenantSecurityConfigModel;
  } else {
    TenantSecurityConfigModel = connection.model<ITenantSecurityConfigDocument, ITenantSecurityConfigModel>(
      "TenantSecurityConfig",
      TenantSecurityConfigSchema
    );
  }

  return TenantSecurityConfigModel;
}
