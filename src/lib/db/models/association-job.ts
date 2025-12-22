/**
 * Association Job Model
 * Tracks brand/collection/category/product-type association import jobs
 */

import mongoose, { Schema, Document } from "mongoose";

export interface IAssociationJob extends Document {
  job_id: string;
  // wholesaler_id removed - database per wholesaler provides isolation

  // Job details
  job_type: "brand_import" | "collection_import" | "category_import" | "product_type_import" | "synonym_dictionary_import";
  entity_type: "brand" | "collection" | "category" | "product_type" | "synonym_dictionary";
  entity_id: string;
  entity_name: string;

  action: "add" | "remove";
  status: "pending" | "processing" | "completed" | "failed";

  // Progress tracking
  total_items: number;
  processed_items: number;
  successful_items: number;
  failed_items: number;

  // Metadata
  metadata?: {
    file_name?: string;
    entity_codes?: string[];
  };

  // Timing
  started_at?: Date;
  completed_at?: Date;

  // Error details
  error_message?: string;

  created_at: Date;
  updated_at: Date;
}

const AssociationJobSchema = new Schema<IAssociationJob>(
  {
    job_id: { type: String, required: true, unique: true, index: true },
    // wholesaler_id removed - database per wholesaler provides isolation

    job_type: {
      type: String,
      enum: ["brand_import", "collection_import", "category_import", "product_type_import", "synonym_dictionary_import"],
      required: true,
      index: true,
    },
    entity_type: {
      type: String,
      enum: ["brand", "collection", "category", "product_type", "synonym_dictionary"],
      required: true,
    },
    entity_id: { type: String, required: true, index: true },
    entity_name: { type: String, required: true },

    action: {
      type: String,
      enum: ["add", "remove"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },

    total_items: { type: Number, default: 0 },
    processed_items: { type: Number, default: 0 },
    successful_items: { type: Number, default: 0 },
    failed_items: { type: Number, default: 0 },

    metadata: {
      file_name: String,
      entity_codes: [String],
    },

    started_at: { type: Date },
    completed_at: { type: Date },
    error_message: { type: String },

    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Indexes (no wholesaler_id - database provides isolation)
AssociationJobSchema.index({ status: 1 });
AssociationJobSchema.index({ entity_type: 1, entity_id: 1 });

export const AssociationJobModel =
  mongoose.models.AssociationJob ||
  mongoose.model<IAssociationJob>("AssociationJob", AssociationJobSchema);
