/**
 * Feed Item State Model — per (destination, product) push state.
 * content_hash is the sha256 of the canonical FeedProduct: delta sync
 * pushes only items whose hash changed.
 * Collection: feeditemstates
 */
import { Schema } from "mongoose";

export const FEED_ITEM_STATUSES = ["pushed", "error", "deleted"] as const;
export type FeedItemStatus = (typeof FEED_ITEM_STATUSES)[number];

export interface IFeedItemState {
  _id?: string;
  destination_id: string;
  entity_code: string;
  content_hash: string;
  remote_status: FeedItemStatus;
  last_pushed_at?: Date;
  last_error?: string;
  last_run_id?: string;
  created_at: Date;
  updated_at: Date;
}

const FeedItemStateSchema = new Schema(
  {
    destination_id: { type: String, required: true },
    entity_code: { type: String, required: true },
    content_hash: { type: String, required: true },
    remote_status: { type: String, enum: FEED_ITEM_STATUSES, required: true },
    last_pushed_at: { type: Date },
    last_error: { type: String },
    last_run_id: { type: String },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "feeditemstates",
  },
);

FeedItemStateSchema.index(
  { destination_id: 1, entity_code: 1 },
  { unique: true },
);
FeedItemStateSchema.index({ destination_id: 1, remote_status: 1 });

export { FeedItemStateSchema };
