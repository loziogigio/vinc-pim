/**
 * Feed Run Model — history of one sync execution per destination.
 * Collection: feedruns
 */
import { Schema } from "mongoose";

export const FEED_RUN_MODES = ["delta", "full", "manual"] as const;
export type FeedRunMode = (typeof FEED_RUN_MODES)[number];

export const FEED_RUN_STATUSES = [
  "running",
  "success",
  "partial",
  "failed",
] as const;
export type FeedRunStatus = (typeof FEED_RUN_STATUSES)[number];

export interface IFeedRun {
  _id?: string;
  run_id: string; // "fr_{nanoid(10)}"
  destination_id: string;
  mode: FeedRunMode;
  status: FeedRunStatus;
  scanned: number;
  pushed: number;
  skipped: number;
  failed: number;
  deleted: number;
  started_at: Date;
  finished_at?: Date;
  error_summary?: string;
  created_at: Date;
  updated_at: Date;
}

const FeedRunSchema = new Schema(
  {
    run_id: { type: String, required: true, unique: true },
    destination_id: { type: String, required: true },
    mode: { type: String, enum: FEED_RUN_MODES, required: true },
    status: { type: String, enum: FEED_RUN_STATUSES, default: "running" },
    scanned: { type: Number, default: 0 },
    pushed: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    deleted: { type: Number, default: 0 },
    started_at: { type: Date, default: Date.now },
    finished_at: { type: Date },
    error_summary: { type: String },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "feedruns",
  },
);

FeedRunSchema.index({ destination_id: 1, started_at: -1 });

export { FeedRunSchema };
