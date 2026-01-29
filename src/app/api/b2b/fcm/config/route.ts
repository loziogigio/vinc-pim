/**
 * FCM Public Config API
 *
 * GET - Returns client-side Firebase configuration for mobile apps
 *
 * This endpoint is accessible via:
 * - API key auth (for mobile apps)
 * - Session auth (for browser/admin access)
 *
 * Returns ONLY public configuration (no secrets like private_key)
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import { connectWithModels } from "@/lib/db/connection";
import type { FCMSettings } from "@/lib/types/home-settings";

export async function GET(req: NextRequest) {
  try {
    // Unified auth: support both API key and session auth
    const authMethod = req.headers.get("x-auth-method");
    let dbName: string;

    if (authMethod === "api-key") {
      // Mobile app using API key
      const apiKeyResult = await verifyAPIKeyFromRequest(req);
      if (!apiKeyResult.authenticated) {
        return NextResponse.json(
          { error: apiKeyResult.error || "Unauthorized" },
          { status: apiKeyResult.statusCode || 401 }
        );
      }
      dbName = apiKeyResult.tenantDb!;
    } else {
      // Browser session auth
      const session = await getB2BSession();
      if (!session || !session.isLoggedIn || !session.tenantId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      dbName = `vinc-${session.tenantId}`;
    }
    const { HomeSettings } = await connectWithModels(dbName);
    const settings = await HomeSettings.findOne({}).lean();

    const fcmSettings = (settings as { fcm_settings?: FCMSettings })?.fcm_settings;

    if (!fcmSettings || !fcmSettings.enabled) {
      return NextResponse.json({
        enabled: false,
        error: "FCM is not configured or disabled",
      });
    }

    // Return ONLY client-side safe configuration
    // NO private_key, NO client_email (server-side only)
    return NextResponse.json({
      enabled: true,
      project_id: fcmSettings.project_id || "",
      messaging_sender_id: fcmSettings.messaging_sender_id || "",
      storage_bucket: fcmSettings.storage_bucket || "",

      // Android config
      android: {
        api_key: fcmSettings.android_api_key || "",
        app_id: fcmSettings.android_app_id || "",
      },

      // iOS config
      ios: {
        api_key: fcmSettings.ios_api_key || "",
        app_id: fcmSettings.ios_app_id || "",
        bundle_id: fcmSettings.ios_bundle_id || "",
      },

      // Notification defaults
      default_icon: fcmSettings.default_icon || "",
      default_color: fcmSettings.default_color || "",
    });
  } catch (error) {
    console.error("[FCM Config] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch FCM config" },
      { status: 500 }
    );
  }
}
