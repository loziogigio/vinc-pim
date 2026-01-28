/**
 * Notification Constants
 *
 * Client-safe constants for notification templates.
 * These can be safely imported in both server and client components.
 */

// ============================================
// SHARED DEFAULTS
// ============================================

/** Default primary color for email templates and buttons */
export const DEFAULT_PRIMARY_COLOR = "#009f7f";

/** Default pagination limit for notification lists */
export const DEFAULT_PAGINATION_LIMIT = 20;

/** Default max pagination limit */
export const MAX_PAGINATION_LIMIT = 100;

// ============================================
// TEMPLATE TYPES
// ============================================

export const TEMPLATE_TYPES = ["product", "generic"] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];

export const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  product: "Prodotti",
  generic: "Comunicazione Generica",
};

// ============================================
// CHANNELS (simplified to 3)
// ============================================

export const NOTIFICATION_CHANNELS = ["email", "mobile", "web_in_app"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: "Email",
  mobile: "Mobile App",
  web_in_app: "Web Push / In-App",
};

// Legacy channel mapping for backward compatibility
export const LEGACY_CHANNELS = ["email", "web_push", "mobile_push", "sms", "in_app"] as const;
export type LegacyNotificationChannel = (typeof LEGACY_CHANNELS)[number];

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
// NEW CHANNEL CONTENT INTERFACES (simplified)
// ============================================

/** Email channel - uses header/footer components */
export interface IEmailChannel {
  enabled: boolean;
  /** Override subject (uses template title if empty) */
  subject?: string;
  /** Custom HTML body (auto-generated if empty) */
  html_body?: string;
}

/** Mobile channel - push + in-app for mobile apps */
export interface IMobileChannel {
  enabled: boolean;
  /** Uses title/body from main template */
}

/** Web In-App channel - browser push + bell dropdown */
export interface IWebInAppChannel {
  enabled: boolean;
  icon?: string;
  action_url?: string;
}

/** Simplified 3-channel structure */
export interface ITemplateChannels {
  email?: IEmailChannel;
  mobile?: IMobileChannel;
  web_in_app?: IWebInAppChannel;
}

// ============================================
// LEGACY CHANNEL CONTENT INTERFACES (for backward compatibility)
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

export interface IInAppChannelContent {
  enabled: boolean;
  title: string;
  body: string;
  icon?: string;
  action_url?: string;
}

export interface INotificationChannels {
  email?: IEmailChannelContent;
  web_push?: IWebPushChannelContent;
  mobile_push?: IMobilePushChannelContent;
  sms?: ISmsChannelContent;
  in_app?: IInAppChannelContent;
}

// ============================================
// TEMPLATE PRODUCT (for product templates)
// ============================================

export interface ITemplateProduct {
  sku: string;
  name: string;
  image: string;
  item_ref: string;
}

// ============================================
// TEMPLATE INTERFACE (for client-side use)
// ============================================

export interface INotificationTemplate {
  template_id: string;
  name: string;
  description?: string;

  // NEW: Template type determines editor and content structure
  type: TemplateType;

  trigger: NotificationTrigger;

  // NEW: Common content fields (used across all channels)
  title: string;
  body: string;

  // NEW: Product template fields
  products?: ITemplateProduct[];
  filters?: Record<string, string[]>;

  // NEW: Generic template fields
  url?: string;
  image?: string;
  open_in_new_tab?: boolean;

  // NEW: Simplified 3-channel structure
  template_channels: ITemplateChannels;

  // Legacy: Old 5-channel structure (for backward compatibility)
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
