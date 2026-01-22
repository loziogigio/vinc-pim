/**
 * Mobile Home Config Model
 *
 * Stores the mobile home page configuration including blocks and versioning.
 * Similar to HomeTemplate but focused on mobile app/PWA layout.
 */

import mongoose, { Schema, Document } from "mongoose";
import type { MobileBlock, MobileAppIdentity } from "@/lib/types/mobile-builder";

// Interface for the document
export interface IMobileHomeConfig extends Document {
  config_id: string;
  app_identity: MobileAppIdentity;
  blocks: MobileBlock[];
  version: number;
  status: "draft" | "published";
  published_at?: Date;
  created_by?: string;
  updated_by?: string;
  is_current: boolean;
  is_current_published: boolean;
  created_at: Date;
  updated_at: Date;
}

// Schema definition
const MobileHomeConfigSchema = new Schema<IMobileHomeConfig>(
  {
    config_id: {
      type: String,
      required: true,
      index: true,
    },
    app_identity: {
      type: Schema.Types.Mixed,
      required: true,
      default: {
        app_name: "",
        logo_url: "",
        logo_width: 64,
      },
    },
    blocks: {
      type: Schema.Types.Mixed,
      required: true,
      default: [],
    },
    version: {
      type: Number,
      required: true,
      default: 1,
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    published_at: {
      type: Date,
    },
    created_by: {
      type: String,
    },
    updated_by: {
      type: String,
    },
    is_current: {
      type: Boolean,
      default: false,
      index: true,
    },
    is_current_published: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    collection: "mobilehomeconfigs",
  }
);

// Compound indexes
MobileHomeConfigSchema.index({ config_id: 1, version: 1 }, { unique: true });
MobileHomeConfigSchema.index({ config_id: 1, is_current: 1 });
MobileHomeConfigSchema.index({ config_id: 1, is_current_published: 1 });

export { MobileHomeConfigSchema };

// Export the model (for direct use - avoid in multi-tenant context)
export const MobileHomeConfigModel =
  mongoose.models.MobileHomeConfig ||
  mongoose.model<IMobileHomeConfig>("MobileHomeConfig", MobileHomeConfigSchema);
