/**
 * Activity Log Model
 * MongoDB model for tracking B2B activity and audit trail
 */

import mongoose from "mongoose";
import type { ActivityLog } from "@/lib/types/b2b";

const { Schema, models, model } = mongoose;

const ActivityLogSchema = new Schema<ActivityLog>(
  {
    type: {
      type: String,
      enum: ["erp_sync", "bulk_enhancement", "product_update", "image_upload", "user_login", "catalog_export"],
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    details: {
      type: Schema.Types.Mixed,
    },
    performedBy: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
ActivityLogSchema.index({ type: 1 });
ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ performedBy: 1 });

// Export schema for model-registry
export { ActivityLogSchema };

export const ActivityLogModel = models.ActivityLog ?? model("ActivityLog", ActivityLogSchema);
