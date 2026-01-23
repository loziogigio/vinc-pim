/**
 * Admin Token Model
 *
 * Stores admin tokens for authentication between services.
 * Used by vinc-b2b to validate cache clear requests from vinc-commerce-suite.
 */

import { Schema, type Document, type Model } from "mongoose";
import { connectToAdminDatabase } from "../admin-connection";

export interface IAdminToken {
  token: string;
  description?: string;
  is_active: boolean;
  expires_at?: Date | null;
  created_at: Date;
  created_by?: string;
}

export interface IAdminTokenDocument extends IAdminToken, Document {}

const AdminTokenSchema = new Schema<IAdminTokenDocument>(
  {
    token: { type: String, required: true, unique: true },
    description: { type: String },
    is_active: { type: Boolean, default: true },
    expires_at: { type: Date, default: null },
    created_by: { type: String },
  },
  {
    collection: "admin_tokens",
    timestamps: { createdAt: "created_at", updatedAt: false },
  }
);

// Index for token lookup
AdminTokenSchema.index({ token: 1 });
AdminTokenSchema.index({ is_active: 1, expires_at: 1 });

let AdminTokenModel: Model<IAdminTokenDocument> | null = null;

/**
 * Get the AdminToken model bound to the admin database connection.
 */
export async function getAdminTokenModel(): Promise<Model<IAdminTokenDocument>> {
  if (AdminTokenModel) return AdminTokenModel;

  const adminConnection = await connectToAdminDatabase();

  // Check if model already exists on this connection
  if (adminConnection.models.AdminToken) {
    AdminTokenModel = adminConnection.models.AdminToken as Model<IAdminTokenDocument>;
    return AdminTokenModel;
  }

  AdminTokenModel = adminConnection.model<IAdminTokenDocument>(
    "AdminToken",
    AdminTokenSchema
  );

  return AdminTokenModel;
}
