/**
 * FCM Configuration Service
 *
 * Manages Firebase Cloud Messaging configuration for each tenant.
 * Each tenant has their own FCM settings stored in home-settings.
 */

import * as admin from "firebase-admin";
import { getHomeSettings } from "@/lib/db/home-settings";
import type { FCMConfig, FCMSettings } from "./types";

// ============================================
// FIREBASE APP CACHE
// ============================================

// Cache Firebase Admin apps per tenant to avoid re-initialization
const firebaseApps: Map<string, admin.app.App> = new Map();

// ============================================
// FCM CONFIGURATION
// ============================================

/**
 * Get FCM configuration for a tenant
 * Returns null if FCM is not configured
 */
export async function getFCMConfig(tenantDb: string): Promise<FCMConfig | null> {
  const settings = await getHomeSettings(tenantDb);
  const fcmSettings = settings?.fcm_settings;

  if (!fcmSettings?.project_id || !fcmSettings?.private_key || !fcmSettings?.client_email) {
    return null;
  }

  return {
    projectId: fcmSettings.project_id,
    privateKey: fcmSettings.private_key,
    clientEmail: fcmSettings.client_email
  };
}

/**
 * Check if FCM is enabled for a tenant
 */
export async function isFCMEnabled(tenantDb: string): Promise<boolean> {
  const settings = await getHomeSettings(tenantDb);
  const fcmSettings = settings?.fcm_settings;

  // FCM is enabled if:
  // 1. enabled flag is true
  // 2. Firebase credentials are configured
  return !!(
    fcmSettings?.enabled &&
    fcmSettings?.project_id &&
    fcmSettings?.private_key &&
    fcmSettings?.client_email
  );
}

/**
 * Get FCM settings for a tenant
 */
export async function getFCMSettings(tenantDb: string): Promise<FCMSettings | null> {
  const settings = await getHomeSettings(tenantDb);
  return settings?.fcm_settings || null;
}

// ============================================
// FIREBASE ADMIN MANAGEMENT
// ============================================

/**
 * Get or initialize Firebase Admin app for a tenant
 * Returns null if FCM is not configured
 */
export async function getFirebaseApp(tenantDb: string): Promise<admin.app.App | null> {
  // Check if app already exists in Firebase (handles server restarts, HMR, etc.)
  try {
    const existingApp = admin.app(tenantDb);
    if (existingApp) {
      firebaseApps.set(tenantDb, existingApp);
      return existingApp;
    }
  } catch {
    // App doesn't exist yet, continue to create it
  }

  // Return cached app if exists and is not deleted
  if (firebaseApps.has(tenantDb)) {
    const app = firebaseApps.get(tenantDb)!;
    try {
      // Check if app is still valid
      app.name;
      return app;
    } catch {
      // App was deleted, remove from cache
      firebaseApps.delete(tenantDb);
    }
  }

  const config = await getFCMConfig(tenantDb);
  if (!config) {
    return null;
  }

  try {
    // Initialize new Firebase app with tenant-specific name
    const app = admin.initializeApp(
      {
        credential: admin.credential.cert({
          projectId: config.projectId,
          privateKey: config.privateKey.replace(/\\n/g, "\n"), // Handle escaped newlines
          clientEmail: config.clientEmail,
        }),
      },
      tenantDb // Use tenantDb as app name for isolation
    );

    firebaseApps.set(tenantDb, app);
    return app;
  } catch (error) {
    console.error(`[FCM] Failed to initialize Firebase for ${tenantDb}:`, error);
    return null;
  }
}

/**
 * Delete Firebase app for a tenant (cleanup)
 */
export async function deleteFirebaseApp(tenantDb: string): Promise<void> {
  const app = firebaseApps.get(tenantDb);
  if (app) {
    try {
      await app.delete();
    } catch {
      // Ignore errors during cleanup
    }
    firebaseApps.delete(tenantDb);
  }
}

/**
 * Get Firebase Messaging instance for a tenant
 * Returns null if FCM is not enabled or configured
 */
export async function getFirebaseMessaging(
  tenantDb: string
): Promise<admin.messaging.Messaging | null> {
  const enabled = await isFCMEnabled(tenantDb);
  if (!enabled) {
    return null;
  }

  const app = await getFirebaseApp(tenantDb);
  if (!app) {
    return null;
  }

  return app.messaging();
}

// ============================================
// FCM SETTINGS MANAGEMENT
// ============================================

/**
 * Update FCM settings for a tenant
 */
export async function updateFCMSettings(
  tenantDb: string,
  settings: Partial<FCMSettings>,
  lastModifiedBy?: string
): Promise<boolean> {
  try {
    // Build the update object using dot notation
    const updateFields: Record<string, unknown> = {};

    Object.entries(settings).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields[`fcm_settings.${key}`] = value;
      }
    });

    if (lastModifiedBy) {
      updateFields.lastModifiedBy = lastModifiedBy;
    }

    const { connectWithModels } = await import("@/lib/db/connection");
    const models = await connectWithModels(tenantDb);
    const GLOBAL_HOME_SETTINGS_ID = process.env.HOME_SETTINGS_ID?.trim() || "global-b2b-home";

    await models.HomeSettings.findOneAndUpdate(
      { customerId: GLOBAL_HOME_SETTINGS_ID },
      { $set: updateFields },
      { upsert: true }
    );

    // Clear cached Firebase app to pick up new credentials
    if (settings.project_id || settings.private_key || settings.client_email) {
      await deleteFirebaseApp(tenantDb);
    }

    return true;
  } catch (error) {
    console.error("[fcm.service] Error updating FCM settings:", error);
    return false;
  }
}

/**
 * Initialize FCM settings for a tenant
 * @param credentials Firebase service account credentials
 */
export async function initializeFCMSettings(
  tenantDb: string,
  credentials: {
    projectId: string;
    privateKey: string;
    clientEmail: string;
  },
  options?: {
    defaultIcon?: string;
    defaultColor?: string;
    iosBadgeBehavior?: "increment" | "set" | "none";
  }
): Promise<boolean> {
  return updateFCMSettings(tenantDb, {
    enabled: true,
    project_id: credentials.projectId,
    private_key: credentials.privateKey,
    client_email: credentials.clientEmail,
    default_icon: options?.defaultIcon,
    default_color: options?.defaultColor,
    ios_badge_behavior: options?.iosBadgeBehavior || "increment"
  });
}

/**
 * Disable FCM for a tenant
 */
export async function disableFCM(
  tenantDb: string,
  lastModifiedBy?: string
): Promise<boolean> {
  await deleteFirebaseApp(tenantDb);
  return updateFCMSettings(tenantDb, { enabled: false }, lastModifiedBy);
}

/**
 * Enable FCM for a tenant (requires credentials to be configured)
 */
export async function enableFCM(
  tenantDb: string,
  lastModifiedBy?: string
): Promise<boolean> {
  const config = await getFCMConfig(tenantDb);
  if (!config) {
    console.error("[fcm.service] Cannot enable FCM: credentials not configured");
    return false;
  }

  return updateFCMSettings(tenantDb, { enabled: true }, lastModifiedBy);
}
