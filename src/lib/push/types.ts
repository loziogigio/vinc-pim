/**
 * Web Push Notification Types
 *
 * Type definitions for the web push notification system.
 */

// ============================================
// PUSH SUBSCRIPTION TYPES
// ============================================

export type PushUserType = "b2b_user" | "portal_user" | "anonymous";

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushPreferences {
  order_updates: boolean;
  price_alerts: boolean;
  marketing: boolean;
  system: boolean;
}

export const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  order_updates: true,
  price_alerts: true,
  marketing: false,
  system: true,
};

export interface CreateSubscriptionInput {
  tenant_id: string;
  user_id?: string;
  user_type?: PushUserType;
  customer_id?: string;
  endpoint: string;
  keys: PushSubscriptionKeys;
  user_agent?: string;
  device_type?: "desktop" | "mobile" | "tablet";
  preferences?: Partial<PushPreferences>;
}

// ============================================
// PUSH LOG TYPES
// ============================================

export type PushStatus = "queued" | "sending" | "sent" | "failed" | "expired";

export interface CreatePushLogInput {
  subscription_id: string;
  tenant_db: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  action_url?: string;
  data?: Record<string, unknown>;
  template_id?: string;
  trigger?: string;
  priority?: number;
  scheduled_at?: Date;
}

// ============================================
// VAPID CONFIGURATION
// ============================================

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export interface WebPushSettings {
  /** VAPID public key (Base64 URL-safe) */
  vapid_public_key?: string;
  /** VAPID private key (Base64 URL-safe) */
  vapid_private_key?: string;
  /** Subject (mailto: or https: URL for push service) */
  vapid_subject?: string;
  /** Is web push enabled for this tenant */
  enabled?: boolean;
  /** Default icon URL for push notifications */
  default_icon?: string;
  /** Default badge URL */
  default_badge?: string;
}

// ============================================
// SEND PUSH OPTIONS
// ============================================

export interface SendPushOptions {
  tenantDb: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  action_url?: string;
  data?: Record<string, unknown>;
  /** Target specific user IDs */
  userIds?: string[];
  /** Target specific subscription IDs */
  subscriptionIds?: string[];
  /** Filter by preference type */
  preferenceType?: keyof PushPreferences;
  /** Template reference */
  templateId?: string;
  trigger?: string;
  /** Queue instead of sending immediately */
  queue?: boolean;
  /** Priority (1-10, higher = more important) */
  priority?: number;
}

export interface SendPushResult {
  success: boolean;
  queued?: number;
  sent?: number;
  failed?: number;
  errors?: Array<{ subscriptionId: string; error: string }>;
}

// ============================================
// PUSH NOTIFICATION PAYLOAD
// ============================================

export interface PushPayload {
  push_id: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  action_url?: string;
  data?: Record<string, unknown>;
  timestamp: number;
}
