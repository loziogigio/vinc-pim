/**
 * Admin Platform App Model
 *
 * Stores platform-level applications that can be enabled/disabled per tenant.
 * Each app has a redirect URL, display metadata, and activation status.
 * Managed via the super-admin panel.
 */

import { Schema, type Document, type Model } from "mongoose";
import { connectToAdminDatabase } from "../admin-connection";

export interface IPlatformApp {
  app_id: string;
  name: string;
  description?: string;
  url: string;
  icon?: string;
  color?: string;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface IPlatformAppDocument extends IPlatformApp, Document {}

const PlatformAppSchema = new Schema<IPlatformAppDocument>(
  {
    app_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    url: { type: String, required: true, trim: true },
    icon: { type: String, trim: true },
    color: { type: String, trim: true },
    is_active: { type: Boolean, default: true },
    sort_order: { type: Number, default: 0 },
  },
  {
    collection: "platformapps",
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

PlatformAppSchema.index({ app_id: 1 }, { unique: true });
PlatformAppSchema.index({ is_active: 1, sort_order: 1 });

let PlatformAppModel: Model<IPlatformAppDocument> | null = null;

/**
 * Get the PlatformApp model bound to the admin database connection.
 */
export async function getPlatformAppModel(): Promise<Model<IPlatformAppDocument>> {
  const adminConnection = await connectToAdminDatabase();

  if (PlatformAppModel && PlatformAppModel.db !== adminConnection) {
    PlatformAppModel = null;
  }

  if (PlatformAppModel) return PlatformAppModel;

  if (adminConnection.models.PlatformApp) {
    PlatformAppModel = adminConnection.models
      .PlatformApp as Model<IPlatformAppDocument>;
    return PlatformAppModel;
  }

  PlatformAppModel = adminConnection.model<IPlatformAppDocument>(
    "PlatformApp",
    PlatformAppSchema
  );

  return PlatformAppModel;
}
