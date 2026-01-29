/**
 * Email Log Model
 * Tracks all sent emails with open/click tracking
 */

import mongoose, { Schema, Document } from "mongoose";

export type EmailStatus = "queued" | "sending" | "sent" | "failed" | "bounced";

export interface IEmailLog extends Document {
  email_id: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  from: string;
  from_name?: string;
  reply_to?: string;
  subject: string;
  html?: string;
  text?: string;
  template_id?: string;
  template_data?: Record<string, any>;
  status: EmailStatus;
  error?: string;
  message_id?: string;
  // Tracking
  tracking_enabled: boolean;
  opens: {
    opened_at: Date;
    ip?: string;
    user_agent?: string;
  }[];
  clicks: {
    url: string;
    clicked_at: Date;
    ip?: string;
    user_agent?: string;
  }[];
  open_count: number;
  click_count: number;
  first_opened_at?: Date;
  last_opened_at?: Date;
  // Queue info
  priority: number;
  attempts: number;
  max_attempts: number;
  scheduled_at?: Date;
  sent_at?: Date;
  // Metadata
  tags?: string[];
  metadata?: Record<string, any>;
  // Campaign reference
  campaign_id?: string;
  // Tenant info (for queue processing)
  tenant_db?: string;
  created_at: Date;
  updated_at: Date;
}

export const EmailLogSchema = new Schema<IEmailLog>(
  {
    email_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    to: {
      type: Schema.Types.Mixed,
      required: true,
    },
    cc: Schema.Types.Mixed,
    bcc: Schema.Types.Mixed,
    from: {
      type: String,
      required: true,
    },
    from_name: String,
    reply_to: String,
    subject: {
      type: String,
      required: true,
    },
    html: String,
    text: String,
    template_id: String,
    template_data: Schema.Types.Mixed,
    status: {
      type: String,
      enum: ["queued", "sending", "sent", "failed", "bounced"],
      default: "queued",
      // Note: index created via schema.index() below
    },
    error: String,
    message_id: String,
    // Tracking
    tracking_enabled: {
      type: Boolean,
      default: true,
    },
    opens: [
      {
        opened_at: { type: Date, required: true },
        ip: String,
        user_agent: String,
      },
    ],
    clicks: [
      {
        url: { type: String, required: true },
        clicked_at: { type: Date, required: true },
        ip: String,
        user_agent: String,
      },
    ],
    open_count: {
      type: Number,
      default: 0,
    },
    click_count: {
      type: Number,
      default: 0,
    },
    first_opened_at: Date,
    last_opened_at: Date,
    // Queue info
    priority: {
      type: Number,
      default: 0,
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
    // Metadata
    tags: [String],
    metadata: Schema.Types.Mixed,
    // Campaign reference
    campaign_id: {
      type: String,
      index: true,
    },
    // Tenant info (for queue processing)
    tenant_db: String,
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

// Indexes
EmailLogSchema.index({ status: 1, scheduled_at: 1 });
EmailLogSchema.index({ to: 1 });
EmailLogSchema.index({ created_at: -1 });
EmailLogSchema.index({ tags: 1 });

export const EmailLogModel =
  mongoose.models.EmailLog ||
  mongoose.model<IEmailLog>("EmailLog", EmailLogSchema);
