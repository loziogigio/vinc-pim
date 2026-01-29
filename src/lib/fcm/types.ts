/**
 * Firebase Cloud Messaging Types
 *
 * Type definitions for the FCM push notification system (iOS/Android).
 */

// ============================================
// FCM TOKEN TYPES
// ============================================

export type FCMPlatform = "ios" | "android";
export type FCMUserType = "b2b_user" | "portal_user";

export interface FCMPreferences {
  order_updates: boolean;
  price_alerts: boolean;
  marketing: boolean;
  system: boolean;
}

export const DEFAULT_FCM_PREFERENCES: FCMPreferences = {
  order_updates: true,
  price_alerts: true,
  marketing: false,
  system: true,
};

export interface RegisterFCMTokenInput {
  tenant_id: string;
  user_id?: string; // Optional for anonymous/pre-login devices
  user_type?: FCMUserType;
  customer_id?: string;
  fcm_token: string;
  platform: FCMPlatform;
  device_id?: string;
  device_model?: string;
  app_version?: string;
  os_version?: string;
  preferences?: Partial<FCMPreferences>;
}

// ============================================
// FCM CONFIGURATION
// ============================================

export interface FCMConfig {
  projectId: string;
  privateKey: string;
  clientEmail: string;
}

export interface FCMSettings {
  /** Is FCM enabled for this tenant */
  enabled?: boolean;
  /** Firebase project ID */
  project_id?: string;
  /** Firebase private key (from service account JSON) */
  private_key?: string;
  /** Firebase client email (from service account JSON) */
  client_email?: string;
  /** Default notification icon for Android */
  default_icon?: string;
  /** Default notification color for Android (hex) */
  default_color?: string;
  /** iOS badge count behavior */
  ios_badge_behavior?: "increment" | "set" | "none";
}

// ============================================
// SEND FCM OPTIONS
// ============================================

export interface SendFCMOptions {
  tenantDb: string;
  title: string;
  body: string;
  icon?: string;
  image?: string;
  action_url?: string;
  data?: Record<string, string>;
  /** Target specific user IDs */
  userIds?: string[];
  /** Target specific token IDs */
  tokenIds?: string[];
  /** Filter by preference type */
  preferenceType?: keyof FCMPreferences;
  /** Template reference */
  templateId?: string;
  trigger?: string;
  /** Queue instead of sending immediately */
  queue?: boolean;
  /** Priority (normal or high) */
  priority?: "normal" | "high";
  /** iOS-specific: badge count */
  badge?: number;
  /** Android-specific: channel ID */
  channelId?: string;
  /** Time-to-live in seconds */
  ttl?: number;
}

export interface SendFCMResult {
  success: boolean;
  queued?: number;
  sent?: number;
  failed?: number;
  errors?: Array<{ tokenId: string; error: string }>;
}

// ============================================
// FCM NOTIFICATION PAYLOAD
// ============================================

export interface FCMPayload {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  action_url?: string;
  data?: Record<string, string>;
}

// ============================================
// FCM JOB DATA (for BullMQ)
// ============================================

export interface FCMJobData {
  tenantDb: string;
  tokenId: string;
  fcmToken: string;
  platform: FCMPlatform;
  payload: FCMPayload;
  templateId?: string;
  trigger?: string;
  priority?: "normal" | "high";
  badge?: number;
  channelId?: string;
  ttl?: number;
}

// ============================================
// FCM LOG TYPES
// ============================================

export type FCMStatus = "queued" | "sending" | "sent" | "failed" | "expired";

export interface CreateFCMLogInput {
  token_id: string;
  tenant_db: string;
  title: string;
  body: string;
  icon?: string;
  image?: string;
  action_url?: string;
  data?: Record<string, string>;
  template_id?: string;
  trigger?: string;
  priority?: "normal" | "high";
  scheduled_at?: Date;
}
