/**
 * Stripe Connect Mapping Model
 *
 * Maps Stripe Connect account_id → tenant_id in the admin database.
 * Used by the platform-level webhook to quickly find which tenant
 * an account.updated event belongs to.
 *
 * Collection: "stripeconnectmappings" (in vinc-admin database)
 */

import { Schema, type Document, type Model } from "mongoose";
import { connectToAdminDatabase } from "../admin-connection";

// ============================================
// INTERFACE
// ============================================

export interface IStripeConnectMapping {
  account_id: string;
  tenant_id: string;
  created_at: Date;
}

export interface IStripeConnectMappingDocument
  extends IStripeConnectMapping,
    Document {}

// ============================================
// SCHEMA
// ============================================

const StripeConnectMappingSchema = new Schema<IStripeConnectMappingDocument>(
  {
    account_id: { type: String, required: true, unique: true },
    tenant_id: { type: String, required: true, index: true },
  },
  {
    collection: "stripeconnectmappings",
    timestamps: { createdAt: "created_at", updatedAt: false },
  }
);

// ============================================
// MODEL ACCESSOR
// ============================================

let MappingModel: Model<IStripeConnectMappingDocument> | null = null;

/**
 * Get the StripeConnectMapping model bound to the admin database connection.
 */
export async function getStripeConnectMappingModel(): Promise<
  Model<IStripeConnectMappingDocument>
> {
  if (MappingModel) return MappingModel;

  const adminConnection = await connectToAdminDatabase();

  if (adminConnection.models.StripeConnectMapping) {
    MappingModel = adminConnection.models
      .StripeConnectMapping as Model<IStripeConnectMappingDocument>;
    return MappingModel;
  }

  MappingModel = adminConnection.model<IStripeConnectMappingDocument>(
    "StripeConnectMapping",
    StripeConnectMappingSchema
  );

  return MappingModel;
}
