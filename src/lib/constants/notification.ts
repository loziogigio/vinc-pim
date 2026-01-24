/**
 * Notification Constants
 *
 * Client-safe constants for notification templates.
 * These can be safely imported in both server and client components.
 */

// ============================================
// CHANNELS
// ============================================

export const NOTIFICATION_CHANNELS = ["email", "web_push", "mobile_push", "sms"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

// ============================================
// TRIGGERS
// ============================================

export const NOTIFICATION_TRIGGERS = [
  // Account templates (existing email flows)
  "registration_request_admin",
  "registration_request_customer",
  "welcome",
  "forgot_password",
  "reset_password",
  // Order templates (new)
  "order_confirmation",
  "order_shipped",
  "order_delivered",
  "order_cancelled",
  // Marketing templates (new)
  "price_drop_alert",
  "back_in_stock",
  "abandoned_cart",
  "newsletter",
  // Custom
  "custom"
] as const;
export type NotificationTrigger = (typeof NOTIFICATION_TRIGGERS)[number];

// Human-readable labels for triggers
export const TRIGGER_LABELS: Record<NotificationTrigger, string> = {
  registration_request_admin: "Registration Request (Admin)",
  registration_request_customer: "Registration Confirmation",
  welcome: "Welcome Email",
  forgot_password: "Forgot Password",
  reset_password: "Password Reset Confirmation",
  order_confirmation: "Order Confirmation",
  order_shipped: "Order Shipped",
  order_delivered: "Order Delivered",
  order_cancelled: "Order Cancelled",
  price_drop_alert: "Price Drop Alert",
  back_in_stock: "Back in Stock",
  abandoned_cart: "Abandoned Cart",
  newsletter: "Newsletter",
  custom: "Custom Template"
};

// ============================================
// CHANNEL CONTENT INTERFACES
// ============================================

export interface IEmailChannelContent {
  enabled: boolean;
  subject: string;
  html_body: string;
  text_body?: string;
}

export interface IWebPushChannelContent {
  enabled: boolean;
  title: string;
  body: string;
  icon?: string;
  action_url?: string;
}

export interface IMobilePushChannelContent {
  enabled: boolean;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface ISmsChannelContent {
  enabled: boolean;
  body: string;
}

export interface INotificationChannels {
  email?: IEmailChannelContent;
  web_push?: IWebPushChannelContent;
  mobile_push?: IMobilePushChannelContent;
  sms?: ISmsChannelContent;
}

// ============================================
// TEMPLATE INTERFACE (for client-side use)
// ============================================

export interface INotificationTemplate {
  template_id: string;
  name: string;
  description?: string;
  trigger: NotificationTrigger;
  channels: INotificationChannels;
  variables: string[];
  // Header/Footer settings for email
  header_id?: string;
  footer_id?: string;
  use_default_header: boolean;
  use_default_footer: boolean;
  is_active: boolean;
  is_default: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  created_by?: string;
  updated_by?: string;
}
