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
  type NotificationChannel,
  type NotificationTrigger,
  type IEmailChannelContent,
  type IWebPushChannelContent,
  type IMobilePushChannelContent,
  type ISmsChannelContent,
  type INotificationChannels,
} from "@/lib/constants/notification";

// Import for use in schema
import {
  NOTIFICATION_TRIGGERS as TRIGGERS,
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

const NotificationChannelsSchema = new Schema(
  {
    email: { type: EmailChannelSchema },
    web_push: { type: WebPushChannelSchema },
    mobile_push: { type: MobilePushChannelSchema },
    sms: { type: SmsChannelSchema }
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
    trigger: {
      type: String,
      enum: TRIGGERS,
      required: true
    },
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

NotificationTemplateSchema.index({ template_id: 1 }, { unique: true });
NotificationTemplateSchema.index({ trigger: 1 });
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
