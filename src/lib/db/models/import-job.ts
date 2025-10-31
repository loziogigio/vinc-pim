/**
 * Import Job Model
 * Tracks product import job progress
 */

import mongoose, { Schema, Document } from "mongoose";

export interface IImportJob extends Document {
  wholesaler_id: string;
  source_id: string;
  job_id: string; // BullMQ job ID

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

  created_at: Date;
  updated_at: Date;
}

const ImportJobSchema = new Schema<IImportJob>(
  {
    wholesaler_id: { type: String, required: true, index: true },
    source_id: { type: String, required: true, index: true },
    job_id: { type: String, required: true, unique: true },

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

    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

export const ImportJobModel =
  mongoose.models.ImportJob ||
  mongoose.model<IImportJob>("ImportJob", ImportJobSchema);
