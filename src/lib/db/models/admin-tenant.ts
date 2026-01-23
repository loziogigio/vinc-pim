/**
 * Admin Tenant Model
 *
 * Registry of all tenants in the system.
 * Stored in vinc-admin database.
 */

import { Schema, Model, Document } from "mongoose";
import { connectToAdminDatabase } from "../admin-connection";

// ============================================
// CONSTANTS
// ============================================

export const TENANT_STATUSES = ["active", "suspended", "pending"] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

// ============================================
// INTERFACE
// ============================================

export interface ITenantRateLimit {
  enabled: boolean;
  requests_per_minute: number;
  requests_per_day: number;
  max_concurrent: number;
}

export interface ITenantSettings {
  features?: string[];
  limits?: {
    max_products?: number;
    max_users?: number;
    max_orders?: number;
  };
  rate_limit?: ITenantRateLimit;
}

/**
 * Domain configuration for multi-tenant hostname resolution
 */
export interface ITenantDomain {
  hostname: string;
  protocol?: "http" | "https";
  is_primary?: boolean;
  is_active?: boolean;
}

/**
 * API configuration for external API access
 */
export interface ITenantApiConfig {
  pim_api_url?: string;
  b2b_api_url?: string;
  api_key_id?: string;
  api_secret?: string;
}

/**
 * Database configuration for tenant data storage
 */
export interface ITenantDbConfig {
  mongo_url?: string;
  mongo_db?: string;
}

export interface ITenant {
  tenant_id: string;
  name: string;
  status: TenantStatus;
  admin_email: string;
  solr_core: string;
  solr_url?: string;
  mongo_db: string;
  settings?: ITenantSettings;
  created_at: Date;
  updated_at: Date;
  created_by: string;

  // Multi-tenant support fields (optional for backwards compatibility)
  project_code?: string;
  domains?: ITenantDomain[];
  api?: ITenantApiConfig;
  database?: ITenantDbConfig;
  require_login?: boolean;
  home_settings_customer_id?: string;
  builder_url?: string;
}

export interface ITenantDocument extends ITenant, Document {}

export interface ITenantModel extends Model<ITenantDocument> {
  findByTenantId(tenantId: string): Promise<ITenantDocument | null>;
  findByDomain(hostname: string): Promise<ITenantDocument | null>;
}

// ============================================
// SCHEMA
// ============================================

const TenantSettingsSchema = new Schema(
  {
    features: [{ type: String }],
    limits: {
      max_products: { type: Number },
      max_users: { type: Number },
      max_orders: { type: Number },
    },
    rate_limit: {
      enabled: { type: Boolean, default: false },
      requests_per_minute: { type: Number, default: 0 },
      requests_per_day: { type: Number, default: 0 },
      max_concurrent: { type: Number, default: 0 },
    },
  },
  { _id: false }
);

const TenantDomainSchema = new Schema(
  {
    hostname: { type: String, required: true, lowercase: true, trim: true },
    protocol: { type: String, enum: ["http", "https"], default: "https" },
    is_primary: { type: Boolean, default: false },
    is_active: { type: Boolean, default: true },
  },
  { _id: false }
);

const TenantApiConfigSchema = new Schema(
  {
    pim_api_url: { type: String },
    b2b_api_url: { type: String },
    api_key_id: { type: String },
    api_secret: { type: String },
  },
  { _id: false }
);

const TenantDbConfigSchema = new Schema(
  {
    mongo_url: { type: String },
    mongo_db: { type: String },
  },
  { _id: false }
);

const TenantSchema = new Schema<ITenantDocument>(
  {
    tenant_id: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, "Tenant ID must be lowercase alphanumeric with dashes"],
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: TENANT_STATUSES,
      default: "pending",
    },
    admin_email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    solr_core: {
      type: String,
      required: true,
    },
    solr_url: {
      type: String,
    },
    mongo_db: {
      type: String,
      required: true,
    },
    settings: TenantSettingsSchema,
    created_by: {
      type: String,
      required: true,
    },

    // Multi-tenant support fields (optional for backwards compatibility)
    project_code: {
      type: String,
      trim: true,
    },
    domains: [TenantDomainSchema],
    api: TenantApiConfigSchema,
    database: TenantDbConfigSchema,
    require_login: {
      type: Boolean,
      default: false,
    },
    home_settings_customer_id: {
      type: String,
      trim: true,
    },
    builder_url: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// ============================================
// INDEXES
// ============================================

TenantSchema.index({ tenant_id: 1 }, { unique: true });
TenantSchema.index({ status: 1 });
TenantSchema.index({ admin_email: 1 });
TenantSchema.index({ "domains.hostname": 1 });

// ============================================
// STATICS
// ============================================

TenantSchema.statics.findByTenantId = function (
  tenantId: string
): Promise<ITenantDocument | null> {
  return this.findOne({ tenant_id: tenantId.toLowerCase() });
};

TenantSchema.statics.findByDomain = function (
  hostname: string
): Promise<ITenantDocument | null> {
  return this.findOne({
    "domains.hostname": hostname.toLowerCase(),
    "domains.is_active": { $ne: false },
    status: "active",
  });
};

// ============================================
// MODEL GETTER
// ============================================

let TenantModel: ITenantModel | null = null;

/**
 * Get the Tenant model.
 * Must call connectToAdminDatabase() first.
 */
export async function getTenantModel(): Promise<ITenantModel> {
  // Always get a fresh connection to ensure it's valid
  const connection = await connectToAdminDatabase();

  // If model is cached but connection changed, clear the cache
  if (TenantModel && TenantModel.db !== connection) {
    TenantModel = null;
  }

  if (TenantModel) {
    return TenantModel;
  }

  // Check if model already exists on this connection
  if (connection.models.Tenant) {
    TenantModel = connection.models.Tenant as ITenantModel;
  } else {
    TenantModel = connection.model<ITenantDocument, ITenantModel>(
      "Tenant",
      TenantSchema
    );
  }

  return TenantModel;
}
