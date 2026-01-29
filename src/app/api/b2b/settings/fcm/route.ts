/**
 * FCM Settings API
 *
 * GET - Retrieve current FCM configuration (without private key)
 * POST - Save FCM configuration
 * DELETE - Disable FCM
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import type { FCMSettings } from "@/lib/types/home-settings";

// ============================================
// GET - Get FCM settings (masked)
// ============================================

export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbName = `vinc-${session.tenantId}`;
    const { HomeSettings } = await connectWithModels(dbName);
    const settings = await HomeSettings.findOne({}).lean();

    const fcmSettings = (settings as { fcm_settings?: FCMSettings })?.fcm_settings;

    if (!fcmSettings) {
      return NextResponse.json({
        configured: false,
        enabled: false,
      });
    }

    // Return settings with masked private key
    return NextResponse.json({
      configured: true,
      enabled: fcmSettings.enabled ?? false,
      project_id: fcmSettings.project_id || "",
      client_email: fcmSettings.client_email || "",
      private_key_set: !!fcmSettings.private_key,
      default_icon: fcmSettings.default_icon || "",
      default_color: fcmSettings.default_color || "",
      ios_badge_behavior: fcmSettings.ios_badge_behavior || "increment",
      // Client-side config
      messaging_sender_id: fcmSettings.messaging_sender_id || "",
      storage_bucket: fcmSettings.storage_bucket || "",
      // Android
      android_api_key: fcmSettings.android_api_key || "",
      android_app_id: fcmSettings.android_app_id || "",
      // iOS
      ios_api_key: fcmSettings.ios_api_key || "",
      ios_app_id: fcmSettings.ios_app_id || "",
      ios_bundle_id: fcmSettings.ios_bundle_id || "",
    });
  } catch (error) {
    console.error("[FCM Settings] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch FCM settings" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Save FCM settings
// ============================================

export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      project_id,
      client_email,
      private_key,
      default_icon,
      default_color,
      ios_badge_behavior,
      enabled,
      // Client-side config
      messaging_sender_id,
      storage_bucket,
      // Android
      android_api_key,
      android_app_id,
      // iOS
      ios_api_key,
      ios_app_id,
      ios_bundle_id,
    } = body;

    // Validate required fields
    if (!project_id || !client_email) {
      return NextResponse.json(
        { error: "project_id and client_email are required" },
        { status: 400 }
      );
    }

    const dbName = `vinc-${session.tenantId}`;
    const { HomeSettings } = await connectWithModels(dbName);

    // Get existing settings to preserve private key if not provided
    const existing = await HomeSettings.findOne({}).lean();
    const existingFcm = (existing as { fcm_settings?: FCMSettings })?.fcm_settings;

    // Build FCM settings object
    const fcmSettings: FCMSettings = {
      enabled: enabled ?? true,
      project_id,
      client_email,
      // Keep existing private key if new one not provided
      private_key: private_key || existingFcm?.private_key || "",
      default_icon: default_icon || "",
      default_color: default_color || "",
      ios_badge_behavior: ios_badge_behavior || "increment",
      // Client-side config
      messaging_sender_id: messaging_sender_id || existingFcm?.messaging_sender_id || "",
      storage_bucket: storage_bucket || existingFcm?.storage_bucket || "",
      // Android
      android_api_key: android_api_key || existingFcm?.android_api_key || "",
      android_app_id: android_app_id || existingFcm?.android_app_id || "",
      // iOS
      ios_api_key: ios_api_key || existingFcm?.ios_api_key || "",
      ios_app_id: ios_app_id || existingFcm?.ios_app_id || "",
      ios_bundle_id: ios_bundle_id || existingFcm?.ios_bundle_id || "",
    };

    // Validate private key is set (either new or existing)
    if (!fcmSettings.private_key) {
      return NextResponse.json(
        { error: "private_key is required for initial setup" },
        { status: 400 }
      );
    }

    // Update home settings
    await HomeSettings.updateOne(
      {},
      { $set: { fcm_settings: fcmSettings } },
      { upsert: true }
    );

    console.log(`[FCM Settings] Saved for tenant ${session.tenantId}`);

    return NextResponse.json({
      success: true,
      message: "FCM settings saved successfully",
      configured: true,
      enabled: fcmSettings.enabled,
    });
  } catch (error) {
    console.error("[FCM Settings] POST error:", error);
    return NextResponse.json(
      { error: "Failed to save FCM settings" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Disable FCM
// ============================================

export async function DELETE(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbName = `vinc-${session.tenantId}`;
    const { HomeSettings } = await connectWithModels(dbName);

    // Disable FCM but keep configuration
    await HomeSettings.updateOne(
      {},
      { $set: { "fcm_settings.enabled": false } }
    );

    console.log(`[FCM Settings] Disabled for tenant ${session.tenantId}`);

    return NextResponse.json({
      success: true,
      message: "FCM disabled",
    });
  } catch (error) {
    console.error("[FCM Settings] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to disable FCM" },
      { status: 500 }
    );
  }
}
