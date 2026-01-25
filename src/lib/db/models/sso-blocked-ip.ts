/**
 * SSO Blocked IP Model
 *
 * Global and per-tenant IP blocklist for security.
 * Stored in vinc-admin database.
 */

import { Schema, Model, Document } from "mongoose";
import { connectToAdminDatabase } from "../admin-connection";

// ============================================
// CONSTANTS
// ============================================

export const BLOCK_REASONS = [
  "brute_force",
  "suspicious_activity",
  "manual_block",
  "rate_limit_exceeded",
  "geo_restriction",
] as const;
export type BlockReason = (typeof BLOCK_REASONS)[number];

// ============================================
// INTERFACE
// ============================================

export interface IBlockedIP {
  ip_address: string;
  tenant_id?: string; // null for global block
  is_global: boolean;

  reason: BlockReason;
  description?: string;
  attempt_count?: number;

  blocked_at: Date;
  blocked_by?: string;
  expires_at?: Date; // null for permanent

  is_active: boolean;
  unblocked_at?: Date;
  unblocked_by?: string;
}

export interface IBlockedIPDocument extends IBlockedIP, Document {}

export interface IBlockedIPModel extends Model<IBlockedIPDocument> {
  isIPBlocked(ip: string, tenantId?: string): Promise<boolean>;
  blockIP(data: Omit<IBlockedIP, "blocked_at" | "is_active">): Promise<IBlockedIPDocument>;
  unblockIP(ip: string, tenantId?: string, unblockedBy?: string): Promise<IBlockedIPDocument | null>;
  getBlockedIPs(tenantId?: string): Promise<IBlockedIPDocument[]>;
}

// ============================================
// SCHEMA
// ============================================

const BlockedIPSchema = new Schema<IBlockedIPDocument>(
  {
    ip_address: {
      type: String,
      required: true,
    },
    tenant_id: { type: String },
    is_global: {
      type: Boolean,
      default: false,
    },

    reason: {
      type: String,
      enum: BLOCK_REASONS,
      required: true,
    },
    description: { type: String },
    attempt_count: { type: Number },

    blocked_at: {
      type: Date,
      default: Date.now,
    },
    blocked_by: { type: String },
    expires_at: { type: Date },

    is_active: {
      type: Boolean,
      default: true,
    },
    unblocked_at: { type: Date },
    unblocked_by: { type: String },
  },
  {
    timestamps: false,
  }
);

// ============================================
// INDEXES
// ============================================

BlockedIPSchema.index({ ip_address: 1, tenant_id: 1 }, { unique: true, sparse: true });
BlockedIPSchema.index({ ip_address: 1, is_global: 1 });
BlockedIPSchema.index({ tenant_id: 1, is_active: 1 });
BlockedIPSchema.index({ is_global: 1, is_active: 1 });
BlockedIPSchema.index({ expires_at: 1 });

// ============================================
// STATICS
// ============================================

BlockedIPSchema.statics.isIPBlocked = async function (
  ip: string,
  tenantId?: string
): Promise<boolean> {
  const now = new Date();

  // Check global block first
  const globalBlock = await this.findOne({
    ip_address: ip,
    is_global: true,
    is_active: true,
    $or: [{ expires_at: { $exists: false } }, { expires_at: { $gt: now } }],
  });

  if (globalBlock) return true;

  // Check tenant-specific block
  if (tenantId) {
    const tenantBlock = await this.findOne({
      ip_address: ip,
      tenant_id: tenantId,
      is_active: true,
      $or: [{ expires_at: { $exists: false } }, { expires_at: { $gt: now } }],
    });

    if (tenantBlock) return true;
  }

  return false;
};

BlockedIPSchema.statics.blockIP = async function (
  data: Omit<IBlockedIP, "blocked_at" | "is_active">
): Promise<IBlockedIPDocument> {
  // Check if already blocked
  const existing = await this.findOne({
    ip_address: data.ip_address,
    tenant_id: data.tenant_id,
    is_active: true,
  });

  if (existing) {
    // Update existing block
    existing.reason = data.reason;
    existing.description = data.description;
    existing.expires_at = data.expires_at;
    existing.attempt_count = (existing.attempt_count || 0) + (data.attempt_count || 1);
    return existing.save();
  }

  // Create new block
  return this.create({
    ...data,
    blocked_at: new Date(),
    is_active: true,
  });
};

BlockedIPSchema.statics.unblockIP = async function (
  ip: string,
  tenantId?: string,
  unblockedBy?: string
): Promise<IBlockedIPDocument | null> {
  const query: Record<string, unknown> = {
    ip_address: ip,
    is_active: true,
  };

  if (tenantId) {
    query.tenant_id = tenantId;
  } else {
    query.is_global = true;
  }

  return this.findOneAndUpdate(
    query,
    {
      $set: {
        is_active: false,
        unblocked_at: new Date(),
        unblocked_by: unblockedBy,
      },
    },
    { new: true }
  );
};

BlockedIPSchema.statics.getBlockedIPs = function (
  tenantId?: string
): Promise<IBlockedIPDocument[]> {
  const query: Record<string, unknown> = { is_active: true };

  if (tenantId) {
    query.$or = [{ tenant_id: tenantId }, { is_global: true }];
  } else {
    query.is_global = true;
  }

  return this.find(query).sort({ blocked_at: -1 });
};

// ============================================
// MODEL GETTER
// ============================================

let BlockedIPModel: IBlockedIPModel | null = null;

/**
 * Get the BlockedIP model.
 * Must call connectToAdminDatabase() first.
 */
export async function getBlockedIPModel(): Promise<IBlockedIPModel> {
  const connection = await connectToAdminDatabase();

  if (BlockedIPModel && BlockedIPModel.db !== connection) {
    BlockedIPModel = null;
  }

  if (BlockedIPModel) {
    return BlockedIPModel;
  }

  if (connection.models.BlockedIP) {
    BlockedIPModel = connection.models.BlockedIP as IBlockedIPModel;
  } else {
    BlockedIPModel = connection.model<IBlockedIPDocument, IBlockedIPModel>(
      "BlockedIP",
      BlockedIPSchema
    );
  }

  return BlockedIPModel;
}
