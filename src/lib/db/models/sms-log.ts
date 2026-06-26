/**
 * SMS Log Model
 * Tracks all sent SMS messages with status, error, and metadata.
 * Mirrors email-log.ts minimally.
 */

import mongoose, { Schema, Document } from "mongoose";

export type SmsStatus = "queued" | "sending" | "sent" | "failed";

export interface ISmsLog extends Document {
  to: string;
  body: string;
  status: SmsStatus;
  error?: string;
  message_id?: string;
  channel: string;
  tenant_db: string;
  attempts: number;
  max_attempts: number;
  scheduled_at?: Date;
  sent_at?: Date;
  metadata?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export const SmsLogSchema = new Schema<ISmsLog>(
  {
    to: {
      type: String,
      required: true,
      index: true,
    },
    body: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["queued", "sending", "sent", "failed"],
      default: "queued",
    },
    error: String,
    message_id: String,
    channel: {
      type: String,
      default: "default",
      index: true,
    },
    tenant_db: {
      type: String,
      required: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    max_attempts: {
      type: Number,
      default: 3,
    },
    scheduled_at: Date,
    sent_at: Date,
    metadata: Schema.Types.Mixed,
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    collection: "smslogs",
  }
);

// Indexes
SmsLogSchema.index({ status: 1, scheduled_at: 1 });
SmsLogSchema.index({ created_at: -1 });

export const SmsLogModel =
  mongoose.models.SmsLog ||
  mongoose.model<ISmsLog>("SmsLog", SmsLogSchema);
