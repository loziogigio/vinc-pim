/**
 * SSO Auth Code Model
 *
 * Temporary authorization codes used in OAuth flow.
 * Stored in vinc-admin database with TTL expiration.
 */

import { Schema, Model, Document } from "mongoose";
import { connectToAdminDatabase } from "../admin-connection";

// ============================================
// INTERFACE
// ============================================

export interface IAuthCodeVincProfile {
  id: string;
  email: string;
  name?: string;
  role: string;
  status: string;
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
      street?: string;
      city?: string;
      zip?: string;
      province?: string;
      country?: string;
    }[];
  }[];
  has_password: boolean;
}

export interface IAuthCode {
  code: string;
  client_id: string;
  tenant_id: string;
  user_id: string;
  user_email: string;
  user_role: string;
  redirect_uri: string;
  state?: string;
  scope?: string;
  code_challenge?: string;
  code_challenge_method?: "plain" | "S256";
  // Full VINC profile for token exchange
  vinc_profile?: IAuthCodeVincProfile;
  expires_at: Date;
  used_at?: Date;
  created_at: Date;
}

export interface IAuthCodeDocument extends IAuthCode, Document {}

export interface IAuthCodeModel extends Model<IAuthCodeDocument> {
  findByCode(code: string): Promise<IAuthCodeDocument | null>;
  consumeCode(code: string): Promise<IAuthCodeDocument | null>;
}

// ============================================
// SCHEMA
// ============================================

const AuthCodeSchema = new Schema<IAuthCodeDocument>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
    },
    client_id: {
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
    user_email: {
      type: String,
      required: true,
      lowercase: true,
    },
    user_role: {
      type: String,
      required: true,
    },
    redirect_uri: {
      type: String,
      required: true,
    },
    state: { type: String },
    scope: { type: String },
    code_challenge: { type: String },
    code_challenge_method: {
      type: String,
      enum: ["plain", "S256"],
    },
    // Full VINC profile (stored as JSON for token exchange)
    vinc_profile: {
      type: Schema.Types.Mixed,
    },
    expires_at: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index - auto delete when expired
    },
    used_at: { type: Date },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
  }
);

// ============================================
// INDEXES
// ============================================

AuthCodeSchema.index({ code: 1 }, { unique: true });
AuthCodeSchema.index({ client_id: 1, tenant_id: 1 });

// ============================================
// STATICS
// ============================================

AuthCodeSchema.statics.findByCode = function (
  code: string
): Promise<IAuthCodeDocument | null> {
  return this.findOne({
    code,
    expires_at: { $gt: new Date() },
    used_at: { $exists: false },
  });
};

AuthCodeSchema.statics.consumeCode = async function (
  code: string
): Promise<IAuthCodeDocument | null> {
  const authCode = await this.findOneAndUpdate(
    {
      code,
      expires_at: { $gt: new Date() },
      used_at: { $exists: false },
    },
    { $set: { used_at: new Date() } },
    { new: true }
  );
  return authCode;
};

// ============================================
// MODEL GETTER
// ============================================

let AuthCodeModel: IAuthCodeModel | null = null;

/**
 * Get the AuthCode model.
 * Must call connectToAdminDatabase() first.
 */
export async function getAuthCodeModel(): Promise<IAuthCodeModel> {
  const connection = await connectToAdminDatabase();

  if (AuthCodeModel && AuthCodeModel.db !== connection) {
    AuthCodeModel = null;
  }

  if (AuthCodeModel) {
    return AuthCodeModel;
  }

  if (connection.models.AuthCode) {
    AuthCodeModel = connection.models.AuthCode as IAuthCodeModel;
  } else {
    AuthCodeModel = connection.model<IAuthCodeDocument, IAuthCodeModel>(
      "AuthCode",
      AuthCodeSchema
    );
  }

  return AuthCodeModel;
}
