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
}

export interface ITenantDocument extends ITenant, Document {}

export interface ITenantModel extends Model<ITenantDocument> {
  findByTenantId(tenantId: string): Promise<ITenantDocument | null>;
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

// ============================================
// STATICS
// ============================================

TenantSchema.statics.findByTenantId = function (
  tenantId: string
): Promise<ITenantDocument | null> {
  return this.findOne({ tenant_id: tenantId.toLowerCase() });
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
