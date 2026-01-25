/**
 * SSO Auth Client Model
 *
 * Registered OAuth client applications that can authenticate via SSO.
 * Stored in vinc-admin database.
 */

import { Schema, Model, Document } from "mongoose";
import { connectToAdminDatabase } from "../admin-connection";

// ============================================
// CONSTANTS
// ============================================

export const CLIENT_TYPES = ["web", "mobile", "api"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

// ============================================
// INTERFACE
// ============================================

export interface IAuthClient {
  client_id: string;
  client_secret_hash: string;
  name: string;
  type: ClientType;
  redirect_uris: string[];
  allowed_origins?: string[];
  logo_url?: string;
  description?: string;
  is_active: boolean;
  is_first_party: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface IAuthClientDocument extends IAuthClient, Document {}

export interface IAuthClientModel extends Model<IAuthClientDocument> {
  findByClientId(clientId: string): Promise<IAuthClientDocument | null>;
}

// ============================================
// SCHEMA
// ============================================

const AuthClientSchema = new Schema<IAuthClientDocument>(
  {
    client_id: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, "Client ID must be lowercase alphanumeric with dashes"],
    },
    client_secret_hash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: CLIENT_TYPES,
      default: "web",
    },
    redirect_uris: [{
      type: String,
      required: true,
    }],
    allowed_origins: [{ type: String }],
    logo_url: { type: String },
    description: { type: String },
    is_active: {
      type: Boolean,
      default: true,
    },
    is_first_party: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// ============================================
// INDEXES
// ============================================

AuthClientSchema.index({ client_id: 1 }, { unique: true });
AuthClientSchema.index({ is_active: 1 });

// ============================================
// STATICS
// ============================================

AuthClientSchema.statics.findByClientId = function (
  clientId: string
): Promise<IAuthClientDocument | null> {
  return this.findOne({ client_id: clientId.toLowerCase(), is_active: true });
};

// ============================================
// MODEL GETTER
// ============================================

let AuthClientModel: IAuthClientModel | null = null;

/**
 * Get the AuthClient model.
 * Must call connectToAdminDatabase() first.
 */
export async function getAuthClientModel(): Promise<IAuthClientModel> {
  const connection = await connectToAdminDatabase();

  if (AuthClientModel && AuthClientModel.db !== connection) {
    AuthClientModel = null;
  }

  if (AuthClientModel) {
    return AuthClientModel;
  }

  if (connection.models.AuthClient) {
    AuthClientModel = connection.models.AuthClient as IAuthClientModel;
  } else {
    AuthClientModel = connection.model<IAuthClientDocument, IAuthClientModel>(
      "AuthClient",
      AuthClientSchema
    );
  }

  return AuthClientModel;
}
