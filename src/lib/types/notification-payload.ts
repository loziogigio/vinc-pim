/**
 * Typed Notification Payload System
 *
 * Defines structured payloads for notifications based on category (object type).
 * All categories can optionally have media attached.
 *
 * Categories:
 * - generic: Text-only notifications (welcome, announcements)
 * - product: Product-related notifications (back in stock, new arrivals)
 * - order: Order lifecycle notifications (shipped, delivered)
 * - price: Price/discount notifications (flash sales, price drops)
 */

// ============================================
// MEDIA
// ============================================

/**
 * Media attachments for notifications.
 * Optional for all categories.
 */
export interface NotificationMedia {
  /** List view thumbnail (48x48) */
  icon?: string;
  /** Single large image for detail view */
  image?: string;
  /** Multiple images for grid display (max 4) */
  images?: string[];
}

// ============================================
// FILTERS (for search API integration)
// ============================================

/**
 * Search filters that can be passed directly to the search API.
 * Used by mobile/web app to filter products when notification is tapped.
 */
export interface NotificationFilters {
  /** Filter by SKU codes */
  sku?: string[];
  /** Filter by brand */
  brand?: string[];
  /** Filter by category */
  category?: string[];
  /** Any other dynamic filters */
  [key: string]: string[] | undefined;
}

// ============================================
// PRODUCT TYPES
// ============================================

/**
 * Basic product info for notifications.
 * The frontend/mobile app uses item_ref to navigate to the correct section.
 */
export interface NotificationProduct {
  sku: string;
  name: string;
  image?: string;
  /** Generic reference for navigation (e.g., SKU, product ID). Handled by frontend. */
  item_ref?: string;
}

/**
 * Product with pricing info for discount notifications.
 */
export interface NotificationProductWithPrice extends NotificationProduct {
  original_price: string;
  sale_price: string;
  /** Discount percentage, e.g., "-40%" */
  discount: string;
}

// ============================================
// ORDER TYPES
// ============================================

/**
 * Order item for order notifications.
 */
export interface NotificationOrderItem {
  sku: string;
  name: string;
  image?: string;
  quantity: number;
}

/**
 * Order details for order notifications.
 * The frontend/mobile app uses item_ref to navigate to the correct section.
 */
export interface NotificationOrder {
  id: string;
  number: string;
  status: string;
  total?: string;
  carrier?: string;
  /** Tracking number/code for shipment tracking */
  tracking_code?: string;
  /** Generic reference for navigation (e.g., order ID). Handled by frontend. */
  item_ref?: string;
  items?: NotificationOrderItem[];
}

// ============================================
// CATEGORY PAYLOADS
// ============================================

/**
 * Notification payload categories.
 */
export const NOTIFICATION_CATEGORIES = ["generic", "product", "order", "price"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/**
 * Generic notification - text only, optional media.
 * Use for: welcome, newsletter, announcements, system messages.
 */
export interface GenericPayload {
  category: "generic";
  media?: NotificationMedia;
  /** URL for documents, catalogs, external links */
  url?: string;
  /** Open URL in new tab/external browser (default: true) */
  open_in_new_tab?: boolean;
}

/**
 * Product notification - about one or more products.
 * Use for: back in stock, new arrivals, wishlist updates.
 */
export interface ProductPayload {
  category: "product";
  media?: NotificationMedia;
  products: NotificationProduct[];
  /** Search filters for the mobile/web app to use when navigating */
  filters?: NotificationFilters;
  /** Raw search URL for "See All" navigation (e.g., "shop?text=moon&filters-brand_id=004") */
  products_url?: string;
}

/**
 * Order notification - about an order lifecycle event.
 * Use for: confirmation, shipped, delivered, cancelled.
 */
export interface OrderPayload {
  category: "order";
  media?: NotificationMedia;
  order: NotificationOrder;
}

/**
 * Price notification - about discounts and price changes.
 * Use for: flash sales, price drops, abandoned cart with prices.
 */
export interface PricePayload {
  category: "price";
  media?: NotificationMedia;
  /** ISO timestamp for countdown (when offer expires) */
  expires_at?: string;
  /** Discount label, e.g., "Fino al 40%" */
  discount_label?: string;
  products: NotificationProductWithPrice[];
  /** Search filters for the mobile/web app to use when navigating */
  filters?: NotificationFilters;
}

/**
 * Union type for all notification payloads.
 * Discriminated by the `category` field.
 */
export type NotificationPayload =
  | GenericPayload
  | ProductPayload
  | OrderPayload
  | PricePayload;

// ============================================
// TRIGGER → CATEGORY MAPPING
// ============================================

import type { NotificationTrigger } from "@/lib/constants/notification";

/**
 * Maps notification triggers to their default category.
 */
export const TRIGGER_CATEGORY_MAP: Record<NotificationTrigger, NotificationCategory> = {
  // Generic
  welcome: "generic",
  newsletter: "generic",
  custom: "generic",
  registration_request_admin: "generic",
  registration_request_customer: "generic",
  forgot_password: "generic",
  reset_password: "generic",
  // Product
  back_in_stock: "product",
  // Order
  order_confirmation: "order",
  order_shipped: "order",
  order_delivered: "order",
  order_cancelled: "order",
  // Price
  price_drop_alert: "price",
  abandoned_cart: "price",
};

/**
 * Get the default category for a trigger.
 */
export function getCategoryForTrigger(trigger: NotificationTrigger): NotificationCategory {
  return TRIGGER_CATEGORY_MAP[trigger] || "generic";
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get the list view icon from a notification payload.
 * Priority: explicit media.icon → first product image → null (use trigger icon)
 */
export function getPayloadIcon(payload: NotificationPayload | undefined): string | null {
  if (!payload) return null;

  // 1. Explicit media icon
  if (payload.media?.icon) return payload.media.icon;

  // 2. First product/item image based on category
  switch (payload.category) {
    case "product":
      if (payload.products?.[0]?.image) return payload.products[0].image;
      break;
    case "price":
      if (payload.products?.[0]?.image) return payload.products[0].image;
      break;
    case "order":
      if (payload.order?.items?.[0]?.image) return payload.order.items[0].image;
      break;
  }

  // 3. Fallback to null (caller should use trigger-based icon)
  return null;
}

/**
 * Get detail view images from a notification payload.
 * Returns array of image URLs for modal display.
 */
export function getPayloadImages(payload: NotificationPayload | undefined): string[] {
  if (!payload) return [];

  // 1. Explicit media images
  if (payload.media?.images?.length) return payload.media.images;

  // 2. Single explicit image
  if (payload.media?.image) return [payload.media.image];

  // 3. Product images based on category
  switch (payload.category) {
    case "product":
      return payload.products?.map((p) => p.image).filter(Boolean) as string[] || [];
    case "price":
      return payload.products?.map((p) => p.image).filter(Boolean) as string[] || [];
    case "order":
      return payload.order?.items?.map((i) => i.image).filter(Boolean) as string[] || [];
  }

  return [];
}

/**
 * Type guard to check if payload is a specific category.
 */
export function isGenericPayload(payload: NotificationPayload): payload is GenericPayload {
  return payload.category === "generic";
}

export function isProductPayload(payload: NotificationPayload): payload is ProductPayload {
  return payload.category === "product";
}

export function isOrderPayload(payload: NotificationPayload): payload is OrderPayload {
  return payload.category === "order";
}

export function isPricePayload(payload: NotificationPayload): payload is PricePayload {
  return payload.category === "price";
}
