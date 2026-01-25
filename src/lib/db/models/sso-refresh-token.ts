/**
 * SSO Refresh Token Model
 *
 * Tracks refresh tokens for token rotation and revocation.
 * Stored in vinc-admin database.
 */

import { Schema, Model, Document } from "mongoose";
import { connectToAdminDatabase } from "../admin-connection";

// ============================================
// INTERFACE
// ============================================

export interface IRefreshToken {
  token_hash: string;
  session_id: string;
  tenant_id: string;
  user_id: string;
  client_id: string;

  // Token rotation tracking
  family_id: string;
  generation: number;

  // Timestamps
  created_at: Date;
  expires_at: Date;
  used_at?: Date;
  revoked_at?: Date;

  // Status
  is_active: boolean;
  revoke_reason?: string;
}

export interface IRefreshTokenDocument extends IRefreshToken, Document {}

export interface IRefreshTokenModel extends Model<IRefreshTokenDocument> {
  findByTokenHash(tokenHash: string): Promise<IRefreshTokenDocument | null>;
  consumeToken(tokenHash: string): Promise<IRefreshTokenDocument | null>;
  revokeTokenFamily(familyId: string, reason?: string): Promise<number>;
  revokeUserTokens(tenantId: string, userId: string, reason?: string): Promise<number>;
}

// ============================================
// SCHEMA
// ============================================

const RefreshTokenSchema = new Schema<IRefreshTokenDocument>(
  {
    token_hash: {
      type: String,
      required: true,
      unique: true,
    },
    session_id: {
      type: String,
      required: true,
    },
    tenant_id: {
      type: String,
      required: true,
    },
    user_id: {
      type: String,
      required: true,
    },
    client_id: {
      type: String,
      required: true,
    },

    // Token rotation tracking
    family_id: {
      type: String,
      required: true,
    },
    generation: {
      type: Number,
      default: 1,
    },

    // Timestamps
    expires_at: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index
    },
    used_at: { type: Date },
    revoked_at: { type: Date },

    // Status
    is_active: {
      type: Boolean,
      default: true,
    },
    revoke_reason: { type: String },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
  }
);

// ============================================
// INDEXES
// ============================================

RefreshTokenSchema.index({ token_hash: 1 }, { unique: true });
RefreshTokenSchema.index({ session_id: 1 });
RefreshTokenSchema.index({ tenant_id: 1, user_id: 1 });
RefreshTokenSchema.index({ family_id: 1 });
RefreshTokenSchema.index({ is_active: 1, expires_at: 1 });

// ============================================
// STATICS
// ============================================

RefreshTokenSchema.statics.findByTokenHash = function (
  tokenHash: string
): Promise<IRefreshTokenDocument | null> {
  return this.findOne({
    token_hash: tokenHash,
    is_active: true,
    expires_at: { $gt: new Date() },
    used_at: { $exists: false },
  });
};

RefreshTokenSchema.statics.consumeToken = async function (
  tokenHash: string
): Promise<IRefreshTokenDocument | null> {
  return this.findOneAndUpdate(
    {
      token_hash: tokenHash,
      is_active: true,
      expires_at: { $gt: new Date() },
      used_at: { $exists: false },
    },
    { $set: { used_at: new Date() } },
    { new: true }
  );
};

RefreshTokenSchema.statics.revokeTokenFamily = async function (
  familyId: string,
  reason?: string
): Promise<number> {
  const result = await this.updateMany(
    { family_id: familyId, is_active: true },
    {
      $set: {
        is_active: false,
        revoked_at: new Date(),
        revoke_reason: reason || "family_revocation",
      },
    }
  );
  return result.modifiedCount;
};

RefreshTokenSchema.statics.revokeUserTokens = async function (
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
        revoke_reason: reason || "user_revocation",
      },
    }
  );
  return result.modifiedCount;
};

// ============================================
// MODEL GETTER
// ============================================

let RefreshTokenModel: IRefreshTokenModel | null = null;

/**
 * Get the RefreshToken model.
 * Must call connectToAdminDatabase() first.
 */
export async function getRefreshTokenModel(): Promise<IRefreshTokenModel> {
  const connection = await connectToAdminDatabase();

  if (RefreshTokenModel && RefreshTokenModel.db !== connection) {
    RefreshTokenModel = null;
  }

  if (RefreshTokenModel) {
    return RefreshTokenModel;
  }

  if (connection.models.RefreshToken) {
    RefreshTokenModel = connection.models.RefreshToken as IRefreshTokenModel;
  } else {
    RefreshTokenModel = connection.model<IRefreshTokenDocument, IRefreshTokenModel>(
      "RefreshToken",
      RefreshTokenSchema
    );
  }

  return RefreshTokenModel;
}
