/**
 * VAPID Key Service
 *
 * Manages VAPID keys for web push notifications.
 * Each tenant has their own VAPID key pair stored in home-settings.
 */

import * as webpush from "web-push";
import { getHomeSettings, upsertHomeSettings } from "@/lib/db/home-settings";
import type { VapidConfig, WebPushSettings } from "./types";

// ============================================
// VAPID KEY GENERATION
// ============================================

/**
 * Generate a new VAPID key pair
 * @returns Object with publicKey and privateKey (base64 URL-safe encoded)
 */
export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  return webpush.generateVAPIDKeys();
}

// ============================================
// VAPID CONFIGURATION
// ============================================

/**
 * Get VAPID configuration for a tenant
 * Returns null if web push is not configured
 */
export async function getVapidConfig(tenantDb: string): Promise<VapidConfig | null> {
  const settings = await getHomeSettings(tenantDb);
  const webPushSettings = settings?.web_push_settings;

  if (!webPushSettings?.vapid_public_key || !webPushSettings?.vapid_private_key) {
    return null;
  }

  // Default subject if not configured
  const subject = webPushSettings.vapid_subject ||
    `mailto:noreply@${tenantDb.replace("vinc-", "")}.com`;

  return {
    publicKey: webPushSettings.vapid_public_key,
    privateKey: webPushSettings.vapid_private_key,
    subject
  };
}

/**
 * Get public VAPID key for client-side subscription
 * This is the only key that should be exposed to clients
 */
export async function getVapidPublicKey(tenantDb: string): Promise<string | null> {
  const settings = await getHomeSettings(tenantDb);
  return settings?.web_push_settings?.vapid_public_key || null;
}

/**
 * Check if web push is enabled for a tenant
 */
export async function isWebPushEnabled(tenantDb: string): Promise<boolean> {
  const settings = await getHomeSettings(tenantDb);
  const webPushSettings = settings?.web_push_settings;

  // Web push is enabled if:
  // 1. enabled flag is true
  // 2. VAPID keys are configured
  return !!(
    webPushSettings?.enabled &&
    webPushSettings?.vapid_public_key &&
    webPushSettings?.vapid_private_key
  );
}

/**
 * Get web push settings for a tenant
 */
export async function getWebPushSettings(tenantDb: string): Promise<WebPushSettings | null> {
  const settings = await getHomeSettings(tenantDb);
  return settings?.web_push_settings || null;
}

// ============================================
// VAPID KEY MANAGEMENT
// ============================================

/**
 * Initialize VAPID keys for a tenant
 * Generates new keys if none exist, or returns existing keys
 */
export async function initializeVapidKeys(
  tenantDb: string,
  options?: {
    subject?: string;
    defaultIcon?: string;
    defaultBadge?: string;
    forceRegenerate?: boolean;
  }
): Promise<VapidConfig> {
  const existingConfig = await getVapidConfig(tenantDb);

  // Return existing config unless force regenerate
  if (existingConfig && !options?.forceRegenerate) {
    return existingConfig;
  }

  // Generate new keys
  const { publicKey, privateKey } = generateVapidKeys();

  const tenantId = tenantDb.replace("vinc-", "");
  const subject = options?.subject || `mailto:noreply@${tenantId}.com`;

  // Store in home settings
  await updateWebPushSettings(tenantDb, {
    vapid_public_key: publicKey,
    vapid_private_key: privateKey,
    vapid_subject: subject,
    enabled: true,
    default_icon: options?.defaultIcon,
    default_badge: options?.defaultBadge
  });

  return { publicKey, privateKey, subject };
}

/**
 * Update web push settings for a tenant
 */
export async function updateWebPushSettings(
  tenantDb: string,
  settings: Partial<WebPushSettings>,
  lastModifiedBy?: string
): Promise<boolean> {
  try {
    // Build the update object using dot notation
    const updateFields: Record<string, unknown> = {};

    Object.entries(settings).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields[`web_push_settings.${key}`] = value;
      }
    });

    if (lastModifiedBy) {
      updateFields.lastModifiedBy = lastModifiedBy;
    }

    // Use upsertHomeSettings which handles the update logic
    const result = await upsertHomeSettings(
      { lastModifiedBy } as Parameters<typeof upsertHomeSettings>[0],
      tenantDb
    );

    // For web_push_settings, we need to do a direct update since upsertHomeSettings
    // doesn't handle web_push_settings yet
    const { connectWithModels } = await import("@/lib/db/connection");
    const models = await connectWithModels(tenantDb);
    const GLOBAL_HOME_SETTINGS_ID = process.env.HOME_SETTINGS_ID?.trim() || "global-b2b-home";

    await models.HomeSettings.findOneAndUpdate(
      { customerId: GLOBAL_HOME_SETTINGS_ID },
      { $set: updateFields },
      { upsert: true }
    );

    return true;
  } catch (error) {
    console.error("[vapid.service] Error updating web push settings:", error);
    return false;
  }
}

/**
 * Disable web push for a tenant
 */
export async function disableWebPush(
  tenantDb: string,
  lastModifiedBy?: string
): Promise<boolean> {
  return updateWebPushSettings(tenantDb, { enabled: false }, lastModifiedBy);
}

/**
 * Enable web push for a tenant (requires VAPID keys to be configured)
 */
export async function enableWebPush(
  tenantDb: string,
  lastModifiedBy?: string
): Promise<boolean> {
  const config = await getVapidConfig(tenantDb);
  if (!config) {
    console.error("[vapid.service] Cannot enable web push: VAPID keys not configured");
    return false;
  }

  return updateWebPushSettings(tenantDb, { enabled: true }, lastModifiedBy);
}

// ============================================
// WEB PUSH LIBRARY CONFIGURATION
// ============================================

/**
 * Configure web-push library with tenant's VAPID details
 * Must be called before sending notifications
 */
export function configureWebPush(config: VapidConfig): void {
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
}

/**
 * Get configured web-push instance for a tenant
 * Returns null if web push is not enabled or configured
 */
export async function getConfiguredWebPush(tenantDb: string): Promise<typeof webpush | null> {
  const enabled = await isWebPushEnabled(tenantDb);
  if (!enabled) {
    return null;
  }

  const config = await getVapidConfig(tenantDb);
  if (!config) {
    return null;
  }

  configureWebPush(config);
  return webpush;
}
