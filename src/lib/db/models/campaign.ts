/**
 * Campaign Model
 *
 * Stores notification campaigns for draft saving and historical tracking.
 * Supports email, mobile (FCM), and web in-app notification channels.
 *
 * Collection: campaigns
 */

import { Schema, Model, Document, Connection } from "mongoose";
import { nanoid } from "nanoid";
import {
  TEMPLATE_TYPES,
  NOTIFICATION_CHANNELS,
  CAMPAIGN_STATUSES,
  RECIPIENT_TYPES,
  type TemplateType,
  type NotificationChannel,
  type CampaignStatus,
  type RecipientType,
  type ITemplateProduct,
} from "@/lib/constants/notification";

// Re-export for convenience
export { CAMPAIGN_STATUSES, RECIPIENT_TYPES };
export type { CampaignStatus, RecipientType, ISelectedUser };

// ============================================
// INTERFACES
// ============================================

export interface ICampaignResults {
  email: {
    sent: number;
    failed: number;
    opened: number;
    clicked: number;
  };
  mobile: {
    sent: number;
    failed: number;
    clicked: number;
  };
  web_in_app: {
    sent: number;
    failed: number;
    read: number;
  };
}

/**
 * Selected user for campaign targeting
 */
export interface ISelectedUser {
  id: string;
  email: string;
  name: string;
}

export interface ICampaign {
  campaign_id: string;
  name: string;
  slug: string;
  status: CampaignStatus;
  type: TemplateType;

  // Content
  title: string;
  body: string;
  push_image?: string;
  email_subject?: string;
  email_html?: string;
  products_url?: string;
  products?: ITemplateProduct[];
  url?: string;
  image?: string;
  open_in_new_tab?: boolean;

  // Channels
  channels: NotificationChannel[];

  // Recipients
  recipient_type: RecipientType;
  selected_user_ids?: string[];
  selected_users?: ISelectedUser[];
  tag_ids?: string[];
  recipient_count?: number;

  // Timing
  scheduled_at?: Date;
  sent_at?: Date;

  // Results (populated after send)
  results?: ICampaignResults;

  // Metadata
  created_by?: string;
  updated_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ICampaignDocument extends ICampaign, Document {}

export interface ICampaignModel extends Model<ICampaignDocument> {
  findByCampaignId(campaignId: string): Promise<ICampaignDocument | null>;
  findBySlug(slug: string): Promise<ICampaignDocument | null>;
  listByStatus(status: CampaignStatus): Promise<ICampaignDocument[]>;
}

// ============================================
// SCHEMAS
// ============================================

const CampaignResultsSchema = new Schema(
  {
    email: {
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      opened: { type: Number, default: 0 },
      clicked: { type: Number, default: 0 },
    },
    mobile: {
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      clicked: { type: Number, default: 0 },
    },
    web_in_app: {
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      read: { type: Number, default: 0 },
    },
  },
  { _id: false }
);

const TemplateProductSchema = new Schema(
  {
    sku: { type: String, required: true },
    name: { type: String, required: true },
    image: { type: String, required: true },
    item_ref: { type: String, required: true },
  },
  { _id: false }
);

const SelectedUserSchema = new Schema(
  {
    id: { type: String, required: true },
    email: { type: String, required: true },
    name: { type: String, required: true },
  },
  { _id: false }
);

/**
 * Generate slug from name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[àáâãäå]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/[ñ]/g, "n")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const CampaignSchema = new Schema<ICampaignDocument>(
  {
    campaign_id: {
      type: String,
      required: true,
      unique: true,
      default: () => `camp_${nanoid(12)}`,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: CAMPAIGN_STATUSES,
      default: "draft",
      index: true,
    },
    type: {
      type: String,
      enum: TEMPLATE_TYPES,
      required: true,
    },

    // Content
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    push_image: {
      type: String,
      trim: true,
    },
    email_subject: {
      type: String,
      trim: true,
    },
    email_html: {
      type: String,
    },
    products_url: {
      type: String,
      trim: true,
    },
    products: {
      type: [TemplateProductSchema],
      default: undefined,
    },
    url: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
      trim: true,
    },
    open_in_new_tab: {
      type: Boolean,
      default: true,
    },

    // Channels
    channels: {
      type: [String],
      enum: NOTIFICATION_CHANNELS,
      required: true,
      validate: {
        validator: (v: string[]) => v.length > 0,
        message: "At least one channel is required",
      },
    },

    // Recipients
    recipient_type: {
      type: String,
      enum: RECIPIENT_TYPES,
      required: true,
    },
    selected_user_ids: {
      type: [String],
      default: undefined,
    },
    selected_users: {
      type: [SelectedUserSchema],
      default: undefined,
    },
    tag_ids: {
      type: [String],
      default: undefined,
    },
    recipient_count: {
      type: Number,
    },

    // Timing
    scheduled_at: {
      type: Date,
    },
    sent_at: {
      type: Date,
    },

    // Results
    results: {
      type: CampaignResultsSchema,
      default: undefined,
    },

    // Metadata
    created_by: {
      type: String,
      trim: true,
    },
    updated_by: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "campaigns",
  }
);

// ============================================
// INDEXES
// ============================================

CampaignSchema.index({ status: 1, created_at: -1 });
CampaignSchema.index({ sent_at: -1 });
CampaignSchema.index({ type: 1 });
CampaignSchema.index({ slug: 1 });
CampaignSchema.index({ name: "text" }); // Text search on name

// ============================================
// PRE-VALIDATE HOOK
// ============================================

// Use pre-validate to generate slug BEFORE validation runs
// (required fields are validated after this hook)
CampaignSchema.pre("validate", function (next) {
  // Auto-generate slug from name if not set or if name changed
  if (this.isModified("name") || !this.slug) {
    this.slug = generateSlug(this.name);
  }
  next();
});

// ============================================
// STATICS
// ============================================

CampaignSchema.statics.findByCampaignId = function (
  campaignId: string
): Promise<ICampaignDocument | null> {
  return this.findOne({ campaign_id: campaignId });
};

CampaignSchema.statics.findBySlug = function (
  slug: string
): Promise<ICampaignDocument | null> {
  return this.findOne({ slug });
};

CampaignSchema.statics.listByStatus = function (
  status: CampaignStatus
): Promise<ICampaignDocument[]> {
  return this.find({ status }).sort({ created_at: -1 });
};

// ============================================
// MODEL FACTORY
// ============================================

export function getCampaignModel(connection: Connection): ICampaignModel {
  return (
    connection.models.Campaign ||
    connection.model<ICampaignDocument, ICampaignModel>(
      "Campaign",
      CampaignSchema
    )
  );
}

export { CampaignSchema };
