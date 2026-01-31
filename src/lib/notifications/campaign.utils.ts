/**
 * Campaign Utilities
 *
 * Shared utilities for campaign validation and payload building.
 * Used by both test and send routes to ensure DRY principle.
 */

import type { NotificationChannel, TemplateType, ITemplateProduct } from "@/lib/constants/notification";

// ============================================
// TYPES
// ============================================

export interface CampaignPayload {
  type: TemplateType;
  title?: string;
  body?: string;
  push_image?: string;
  email_subject?: string;
  email_html?: string;
  products_url?: string;
  channels: NotificationChannel[];
  products?: ITemplateProduct[];
  url?: string;
  image?: string;
  open_in_new_tab?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface NotificationPayload {
  category: "product" | "generic";
  products?: { sku: string; name: string; image: string; item_ref: string }[];
  filters?: { sku: string[] };
  /** Raw search URL for "See All" navigation (e.g., "shop?text=moon&filters-brand_id=004") */
  products_url?: string;
  media?: { image: string };
  url?: string;
  open_in_new_tab?: boolean;
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validates campaign payload for required fields based on channels
 */
export function validateCampaignPayload(payload: CampaignPayload): ValidationResult {
  const { type, title, body, email_html, channels } = payload;

  // Validate type
  if (!type || !["product", "generic"].includes(type)) {
    return { valid: false, error: "Invalid campaign type" };
  }

  // Validate channels
  if (!channels || !Array.isArray(channels) || channels.length === 0) {
    return { valid: false, error: "At least one channel must be selected" };
  }

  // Push notification validation (mobile or web_in_app)
  const hasPush = channels.includes("mobile") || channels.includes("web_in_app");
  if (hasPush) {
    if (!title?.trim()) {
      return { valid: false, error: "Title is required for push notifications" };
    }
    if (!body?.trim()) {
      return { valid: false, error: "Message body is required for push notifications" };
    }
  }

  // Email validation
  if (channels.includes("email") && !email_html?.trim()) {
    return { valid: false, error: "Email HTML content is required" };
  }

  return { valid: true };
}

// ============================================
// PAYLOAD BUILDERS
// ============================================

/**
 * Builds notification payload for mobile/web channels
 */
export function buildNotificationPayload(
  type: TemplateType,
  options: {
    products?: ITemplateProduct[];
    products_url?: string;
    push_image?: string;
    url?: string;
    image?: string;
    open_in_new_tab?: boolean;
    campaign_id?: string;
  }
): NotificationPayload {
  const { products, products_url, push_image, url, image, open_in_new_tab, campaign_id } = options;

  if (type === "product") {
    return {
      category: "product",
      products: products?.map((p) => ({
        sku: p.sku,
        name: p.name,
        image: p.image,
        item_ref: p.item_ref,
      })),
      filters: products && products.length > 0 ? { sku: products.map((p) => p.sku) } : undefined,
      products_url: products_url || undefined,
      media: push_image ? { image: push_image } : undefined,
      ...(campaign_id && { campaign_id }),
    };
  }

  return {
    category: "generic",
    url,
    open_in_new_tab,
    media: image ? { image } : undefined,
    ...(campaign_id && { campaign_id }),
  };
}

/**
 * Gets the notification icon (push_image takes priority over generic image)
 */
export function getNotificationIcon(push_image?: string, image?: string): string | undefined {
  return push_image || image;
}

/**
 * Builds in-app notification payload
 */
export function buildInAppPayload(
  type: TemplateType,
  options: {
    products?: ITemplateProduct[];
    products_url?: string;
    url?: string;
    open_in_new_tab?: boolean;
  }
): { category: "product" | "generic"; products?: ITemplateProduct[]; products_url?: string; url?: string; open_in_new_tab?: boolean } {
  const { products, products_url, url, open_in_new_tab } = options;

  if (type === "product") {
    return {
      category: "product",
      products: products || [],
      products_url: products_url || undefined,
    };
  }

  return {
    category: "generic",
    url,
    open_in_new_tab,
  };
}

// ============================================
// RESULT TRACKING
// ============================================

export interface ChannelResults {
  email: { sent: number; failed: number };
  mobile: { sent: number; failed: number };
  web_in_app: { sent: number; failed: number };
}

/**
 * Creates an empty results tracker
 */
export function createResultsTracker(): ChannelResults {
  return {
    email: { sent: 0, failed: 0 },
    mobile: { sent: 0, failed: 0 },
    web_in_app: { sent: 0, failed: 0 },
  };
}
