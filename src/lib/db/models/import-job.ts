/**
 * Import Job Model
 * Tracks product import job progress
 */

import mongoose, { Schema, Document } from "mongoose";

export interface IImportJob extends Document {
  wholesaler_id: string;
  source_id: string;
  job_id: string; // BullMQ job ID
  job_type: "import" | "bulk_update"; // Type of job

  status: "pending" | "processing" | "completed" | "failed";

  // File info
  file_name?: string;
  file_size?: number;
  file_url?: string;

  // Progress tracking
  total_rows: number;
  processed_rows: number;
  successful_rows: number;
  failed_rows: number;
  auto_published_count: number;

  // Import errors (renamed from 'errors' to avoid Mongoose reserved field warning)
  import_errors: {
    row: number;
    entity_code: string;
    error: string;
    raw_data?: any; // The raw data that failed to import
  }[];

  // Timing
  started_at?: Date;
  completed_at?: Date;
  duration_seconds?: number;

  // Batch tracking (Phase 3)
  batch_id?: string; // Links multiple imports together
  batch_part?: number; // Which part of the batch (1, 2, 3...)
  batch_total_parts?: number; // Total expected parts
  batch_total_items?: number; // Total items across all parts
  parent_job_id?: string; // If this is a retry of another job

  created_at: Date;
  updated_at: Date;
}

const ImportJobSchema = new Schema<IImportJob>(
  {
    wholesaler_id: { type: String, required: true, index: true },
    source_id: { type: String, required: true, index: true },
    job_id: { type: String, required: true, unique: true },
    job_type: {
      type: String,
      enum: ["import", "bulk_update"],
      default: "import",
      index: true,
    },

    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },

    file_name: { type: String },
    file_size: { type: Number },
    file_url: { type: String },

    total_rows: { type: Number, default: 0 },
    processed_rows: { type: Number, default: 0 },
    successful_rows: { type: Number, default: 0 },
    failed_rows: { type: Number, default: 0 },
    auto_published_count: { type: Number, default: 0 },

    import_errors: [
      {
        row: { type: Number },
        entity_code: { type: String },
        error: { type: String },
        raw_data: { type: Schema.Types.Mixed }, // Store the raw data that failed
      },
    ],

    started_at: { type: Date },
    completed_at: { type: Date },
    duration_seconds: { type: Number },

    // Batch tracking (Phase 3)
    batch_id: { type: String, index: true },
    batch_part: { type: Number },
    batch_total_parts: { type: Number },
    batch_total_items: { type: Number },
    parent_job_id: { type: String, index: true },

    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Compound index for batch queries
ImportJobSchema.index({ batch_id: 1, batch_part: 1 });
ImportJobSchema.index({ wholesaler_id: 1, batch_id: 1 });

export const ImportJobModel =
  mongoose.models.ImportJob ||
  mongoose.model<IImportJob>("ImportJob", ImportJobSchema);
