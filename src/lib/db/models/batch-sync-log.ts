/**
 * Batch Sync Log Model
 * Tracks PIM batch sync operations (cleanup + resync to Solr)
 */

import mongoose from "mongoose";

const { Schema, models, model } = mongoose;

export interface IBatchSyncLog {
  _id: string;
  job_id: string;
  status: "running" | "completed" | "failed";
  params: {
    cleanup_mode: "clear_all" | "by_score" | "by_missing_fields" | "none";
    cleanup_min_score?: number;
    cleanup_required_fields?: string[];
    resync: boolean;
    resync_min_score?: number;
    recalculate_scores?: boolean;
    batch_size?: number;
  };
  cleanup_result?: {
    mode: string;
    removed_count?: number;
  };
  resync_result?: {
    total: number;
    eligible: number;
    indexed: number;
    failed: number;
    batches_processed: number;
    score_updates: number;
    errors: string[];
  };
  started_by: string;
  duration_ms?: number;
  error_message?: string;
  created_at: Date;
  updated_at: Date;
}

const BatchSyncLogSchema = new Schema<IBatchSyncLog>(
  {
    job_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["running", "completed", "failed"],
      required: true,
      default: "running",
    },
    params: {
      type: Schema.Types.Mixed,
      required: true,
    },
    cleanup_result: {
      type: Schema.Types.Mixed,
    },
    resync_result: {
      type: Schema.Types.Mixed,
    },
    started_by: {
      type: String,
      required: true,
      trim: true,
    },
    duration_ms: {
      type: Number,
    },
    error_message: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "batchsynclogs",
  }
);

BatchSyncLogSchema.index({ status: 1 });
BatchSyncLogSchema.index({ created_at: -1 });

export { BatchSyncLogSchema };

export const BatchSyncLogModel =
  models.BatchSyncLog ?? model("BatchSyncLog", BatchSyncLogSchema);
