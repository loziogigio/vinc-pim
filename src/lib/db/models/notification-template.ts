/**
 * Notification Template Model
 *
 * Stores multi-channel notification templates with support for email,
 * web push, mobile push, and SMS. Used by the Notifications app.
 *
 * Collection: notificationtemplates
 */

import { Schema, Model, Document } from "mongoose";

// Re-export constants from client-safe location
// Use these exports for client components to avoid Mongoose import issues
export {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TRIGGERS,
  TRIGGER_LABELS,
  TEMPLATE_TYPES,
  TEMPLATE_TYPE_LABELS,
  CHANNEL_LABELS,
  type NotificationChannel,
  type NotificationTrigger,
  type TemplateType,
  type IEmailChannelContent,
  type IWebPushChannelContent,
  type IMobilePushChannelContent,
  type ISmsChannelContent,
  type IInAppChannelContent,
  type INotificationChannels,
  type IEmailChannel,
  type IMobileChannel,
  type IWebInAppChannel,
  type ITemplateChannels,
  type ITemplateProduct,
} from "@/lib/constants/notification";

// Import for use in schema
import {
  NOTIFICATION_TRIGGERS as TRIGGERS,
  TEMPLATE_TYPES,
  type NotificationTrigger as TriggerType,
  type INotificationChannels as ChannelsType,
} from "@/lib/constants/notification";

// ============================================
// DOCUMENT INTERFACES (Mongoose-specific)
// ============================================

import type { INotificationTemplate } from "@/lib/constants/notification";
export type { INotificationTemplate };

export interface INotificationTemplateDocument extends INotificationTemplate, Document {}

export interface INotificationTemplateModel extends Model<INotificationTemplateDocument> {
  findByTemplateId(templateId: string): Promise<INotificationTemplateDocument | null>;
  findByTrigger(trigger: TriggerType): Promise<INotificationTemplateDocument | null>;
}

// ============================================
// SCHEMAS
// ============================================

const EmailChannelSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    subject: { type: String, default: "" },
    html_body: { type: String, default: "" },
    text_body: { type: String }
  },
  { _id: false }
);

const WebPushChannelSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    title: { type: String, default: "" },
    body: { type: String, default: "" },
    icon: { type: String },
    action_url: { type: String }
  },
  { _id: false }
);

const MobilePushChannelSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    title: { type: String, default: "" },
    body: { type: String, default: "" },
    data: { type: Schema.Types.Mixed }
  },
  { _id: false }
);

const SmsChannelSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    body: { type: String, default: "" }
  },
  { _id: false }
);

const InAppChannelSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    title: { type: String, default: "" },
    body: { type: String, default: "" },
    icon: { type: String },
    action_url: { type: String }
  },
  { _id: false }
);

// Legacy 5-channel structure (for backward compatibility)
const NotificationChannelsSchema = new Schema(
  {
    email: { type: EmailChannelSchema },
    web_push: { type: WebPushChannelSchema },
    mobile_push: { type: MobilePushChannelSchema },
    sms: { type: SmsChannelSchema },
    in_app: { type: InAppChannelSchema }
  },
  { _id: false }
);

// ============================================
// NEW SIMPLIFIED SCHEMAS
// ============================================

const NewEmailChannelSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    subject: { type: String },
    html_body: { type: String }
  },
  { _id: false }
);

const NewMobileChannelSchema = new Schema(
  {
    enabled: { type: Boolean, default: true }
  },
  { _id: false }
);

const NewWebInAppChannelSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    icon: { type: String },
    action_url: { type: String }
  },
  { _id: false }
);

const TemplateChannelsSchema = new Schema(
  {
    email: { type: NewEmailChannelSchema },
    mobile: { type: NewMobileChannelSchema },
    web_in_app: { type: NewWebInAppChannelSchema }
  },
  { _id: false }
);

// Product schema for product templates
const TemplateProductSchema = new Schema(
  {
    sku: { type: String, required: true },
    name: { type: String, required: true },
    image: { type: String, required: true },
    item_ref: { type: String, required: true }
  },
  { _id: false }
);

const NotificationTemplateSchema = new Schema<INotificationTemplateDocument>(
  {
    template_id: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9_-]+$/, "Template ID must be lowercase alphanumeric with underscores or dashes"]
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },

    // NEW: Template type (product or generic)
    type: {
      type: String,
      enum: TEMPLATE_TYPES,
      default: "generic"
    },

    trigger: {
      type: String,
      enum: TRIGGERS,
      required: true
    },

    // NEW: Common content fields
    title: {
      type: String,
      trim: true,
      default: ""
    },
    body: {
      type: String,
      trim: true,
      default: ""
    },

    // NEW: Product template fields
    products: {
      type: [TemplateProductSchema],
      default: undefined
    },
    filters: {
      type: Schema.Types.Mixed,
      default: undefined
    },

    // NEW: Generic template fields
    url: {
      type: String,
      trim: true
    },
    image: {
      type: String,
      trim: true
    },
    open_in_new_tab: {
      type: Boolean,
      default: true
    },

    // NEW: Simplified 3-channel structure
    template_channels: {
      type: TemplateChannelsSchema,
      default: () => ({
        email: { enabled: true },
        mobile: { enabled: true },
        web_in_app: { enabled: true }
      })
    },

    // Legacy: Old 5-channel structure (for backward compatibility)
    channels: {
      type: NotificationChannelsSchema,
      default: () => ({})
    },

    variables: {
      type: [String],
      default: []
    },
    // Header/Footer settings for email
    header_id: {
      type: String,
      trim: true
    },
    footer_id: {
      type: String,
      trim: true
    },
    use_default_header: {
      type: Boolean,
      default: true
    },
    use_default_footer: {
      type: Boolean,
      default: true
    },
    is_active: {
      type: Boolean,
      default: true
    },
    is_default: {
      type: Boolean,
      default: false
    },
    created_by: {
      type: String,
      trim: true
    },
    updated_by: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "notificationtemplates"
  }
);

// ============================================
// INDEXES
// ============================================

// Note: template_id index already created by unique: true in field definition
NotificationTemplateSchema.index({ trigger: 1 });
NotificationTemplateSchema.index({ type: 1 });
NotificationTemplateSchema.index({ is_active: 1 });
NotificationTemplateSchema.index({ is_default: 1 });

// ============================================
// STATICS
// ============================================

NotificationTemplateSchema.statics.findByTemplateId = function (
  templateId: string
): Promise<INotificationTemplateDocument | null> {
  return this.findOne({ template_id: templateId.toLowerCase() });
};

NotificationTemplateSchema.statics.findByTrigger = function (
  trigger: TriggerType
): Promise<INotificationTemplateDocument | null> {
  return this.findOne({ trigger, is_active: true });
};

export { NotificationTemplateSchema };
