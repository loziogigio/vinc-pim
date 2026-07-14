/**
 * Feed Destination Model
 *
 * One document per external product-feed destination (Google Merchant,
 * Meta catalog, TrovaPrezzi) configured by the tenant. Credentials are
 * stored AES-256-GCM-encrypted (see @/lib/utils/encryption) in the
 * *_encrypted fields; API responses mask them with SECRET_MASK.
 *
 * Collection: feeddestinations
 */
import { Schema } from "mongoose";

export const FEED_DESTINATION_TYPES = [
  "google_merchant",
  "meta_catalog",
  "trovaprezzi",
] as const;
export type FeedDestinationType = (typeof FEED_DESTINATION_TYPES)[number];

export const FEED_DESTINATION_STATUSES = ["active", "paused", "error"] as const;
export type FeedDestinationStatus = (typeof FEED_DESTINATION_STATUSES)[number];

export interface IFeedLastRunSummary {
  run_id?: string;
  finished_at?: Date;
  status?: string; // "success" | "partial" | "failed"
  pushed?: number;
  failed?: number;
  deleted?: number;
}

export interface IFeedDestination {
  _id?: string;
  destination_id: string; // "fd_{nanoid(8)}"
  type: FeedDestinationType;
  name: string;
  status: FeedDestinationStatus;
  status_message?: string; // human-readable reason when status = "error"

  // Product selection
  channel: string; // sales-channel code (saleschannels.code)
  lang: string; // language for multilingual fields, e.g. "it"
  currency: string; // e.g. "EUR"
  product_url_template: string; // "https://shop.x.it/p/{slug}" — {slug} | {entity_code}
  brand_labels?: string[]; // filter: only these brand labels (empty = all)
  category_ids?: string[]; // filter: only these category_ids (empty = all)
  in_stock_only: boolean;

  // Scheduling
  delta_interval_minutes: number; // default 60
  full_reconcile_hour: number; // 0-23 local (Europe/Rome), default 2

  // Google Merchant
  google_merchant_account_id?: string;
  google_service_account_json_encrypted?: string;

  // Meta catalog
  meta_catalog_id?: string;
  meta_system_user_token_encrypted?: string;

  // TrovaPrezzi (pull feed)
  feed_token?: string; // random URL token; regenerable
  shipping_cost?: number; // flat shipping cost included in the feed

  // Alerting
  notification_email?: string; // degraded-run alert recipient (optional)

  last_run?: IFeedLastRunSummary;
  last_full_run_at?: Date;

  created_at: Date;
  updated_at: Date;
}

const FeedLastRunSchema = new Schema(
  {
    run_id: { type: String },
    finished_at: { type: Date },
    status: { type: String },
    pushed: { type: Number },
    failed: { type: Number },
    deleted: { type: Number },
  },
  { _id: false }
);

const FeedDestinationSchema = new Schema(
  {
    destination_id: { type: String, required: true, unique: true },
    type: { type: String, enum: FEED_DESTINATION_TYPES, required: true },
    name: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: FEED_DESTINATION_STATUSES,
      default: "active",
    },
    status_message: { type: String },

    channel: { type: String, required: true, trim: true, lowercase: true },
    lang: { type: String, required: true, trim: true, lowercase: true },
    currency: { type: String, required: true, trim: true, uppercase: true },
    product_url_template: { type: String, required: true, trim: true },
    brand_labels: { type: [String], default: [] },
    category_ids: { type: [String], default: [] },
    in_stock_only: { type: Boolean, default: false },

    delta_interval_minutes: { type: Number, default: 60, min: 5 },
    full_reconcile_hour: { type: Number, default: 2, min: 0, max: 23 },

    google_merchant_account_id: { type: String, trim: true },
    google_service_account_json_encrypted: { type: String },

    meta_catalog_id: { type: String, trim: true },
    meta_system_user_token_encrypted: { type: String },

    feed_token: { type: String },
    shipping_cost: { type: Number },

    notification_email: { type: String, trim: true },

    last_run: { type: FeedLastRunSchema },
    last_full_run_at: { type: Date },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "feeddestinations",
  }
);

// destination_id index created by unique: true in the field definition
FeedDestinationSchema.index({ type: 1, status: 1 });

export { FeedDestinationSchema };
