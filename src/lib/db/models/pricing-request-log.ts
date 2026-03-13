/**
 * Pricing Request Log Model
 *
 * Logs pricing provider requests for monitoring and debugging.
 * Collection: "pricingrequestlogs" (per-tenant DB)
 * 30-day TTL auto-cleanup via MongoDB TTL index on created_at.
 */

import mongoose, { Schema, Document } from "mongoose";

// ============================================
// INTERFACES
// ============================================

export const PRICING_LOG_STATUSES = [
  "success",
  "failed",
  "timed_out",
  "circuit_open",
] as const;

export type PricingLogStatus = (typeof PRICING_LOG_STATUSES)[number];

export interface IPricingRequestLogDoc extends Document {
  log_id: string;
  provider: string;
  entity_codes: string[];
  entity_count: number;
  customer_code: string;
  status: PricingLogStatus;
  resolved_count: number;
  error_count: number;
  errors?: Record<string, unknown>;
  duration_ms: number;
  attempt_count: number;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// SCHEMA
// ============================================

export const PricingRequestLogSchema = new Schema<IPricingRequestLogDoc>(
  {
    log_id: {
      type: String,
      required: true,
      unique: true,
    },
    provider: {
      type: String,
      required: true,
    },
    entity_codes: {
      type: [String],
      default: [],
    },
    entity_count: {
      type: Number,
      required: true,
      default: 0,
    },
    customer_code: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: PRICING_LOG_STATUSES,
      required: true,
    },
    resolved_count: {
      type: Number,
      default: 0,
    },
    error_count: {
      type: Number,
      default: 0,
    },
    errors: {
      type: Schema.Types.Mixed,
    },
    duration_ms: {
      type: Number,
      required: true,
    },
    attempt_count: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "pricingrequestlogs",
  }
);

// Indexes
PricingRequestLogSchema.index({ status: 1, created_at: -1 });
PricingRequestLogSchema.index({ provider: 1, created_at: -1 });
PricingRequestLogSchema.index(
  { created_at: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 } // 30-day TTL
);

// Default model (for standalone use)
export const PricingRequestLogModel =
  mongoose.models.PricingRequestLog ||
  mongoose.model<IPricingRequestLogDoc>(
    "PricingRequestLog",
    PricingRequestLogSchema
  );
