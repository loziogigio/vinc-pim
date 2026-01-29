/**
 * FCM Token Registration Endpoint
 *
 * POST /api/b2b/fcm/register - Register/update FCM token from mobile app
 * DELETE /api/b2b/fcm/register - Remove FCM token (logout)
 * GET /api/b2b/fcm/register - Check token status
 *
 * Supports both B2B Session and API Key authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  registerToken,
  deleteTokenByFCMToken,
  getTokenByFCMToken,
  deleteAllUserTokens
} from "@/lib/fcm/token.service";
import { isFCMEnabled } from "@/lib/fcm/fcm.service";
import type { FCMPreferences, FCMPlatform } from "@/lib/fcm/types";

interface RegisterRequestBody {
  fcm_token: string;
  platform: FCMPlatform;
  device_id?: string;
  device_model?: string;
  app_version?: string;
  os_version?: string;
  preferences?: Partial<FCMPreferences>;
  // Optional: can be provided from body when using API key auth
  user_id?: string;
  user_type?: "portal_user" | "b2b_user";
}

/**
 * POST - Register or update FCM token
 *
 * Supports two modes:
 * 1. Anonymous registration (API key only) - no user_id, for pre-login
 * 2. User registration (API key + user context) - with user_id, after login
 *
 * When user logs in, call this endpoint again to associate token with user.
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate using session or API key
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantId, tenantDb } = auth;

    // Check if FCM is enabled
    const enabled = await isFCMEnabled(tenantDb);
    if (!enabled) {
      return NextResponse.json(
        { error: "FCM push notifications not enabled" },
        { status: 400 }
      );
    }

    // Parse request body
    const body: RegisterRequestBody = await req.json();

    if (!body.fcm_token || !body.platform) {
      return NextResponse.json(
        { error: "Invalid request: fcm_token and platform required" },
        { status: 400 }
      );
    }

    if (!["ios", "android"].includes(body.platform)) {
      return NextResponse.json(
        { error: "Invalid platform: must be 'ios' or 'android'" },
        { status: 400 }
      );
    }

    // Determine user_id and user_type:
    // Priority: auth context > request body > undefined (anonymous)
    const userId = auth.userId || body.user_id;
    const userType = body.user_type || "portal_user"; // Default to portal_user for mobile apps

    // Register token
    const token = await registerToken(tenantDb, {
      tenant_id: tenantId,
      user_id: userId, // Can be undefined for anonymous devices
      user_type: userType,
      fcm_token: body.fcm_token,
      platform: body.platform,
      device_id: body.device_id,
      device_model: body.device_model,
      app_version: body.app_version,
      os_version: body.os_version,
      preferences: body.preferences
    });

    return NextResponse.json({
      success: true,
      token_id: token.token_id,
      user_id: userId || null, // Let client know if user was associated
      preferences: token.preferences
    });
  } catch (error) {
    console.error("[fcm/register] POST Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Remove FCM token (single token or all user tokens)
 */
export async function DELETE(req: NextRequest) {
  try {
    // Authenticate using session or API key
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb, userId } = auth;

    // Get fcm_token from query or body
    const { searchParams } = new URL(req.url);
    let fcmToken = searchParams.get("fcm_token");
    const logoutAll = searchParams.get("logout_all") === "true";

    if (!fcmToken && !logoutAll) {
      try {
        const body = await req.json();
        fcmToken = body.fcm_token;
      } catch {
        // No body
      }
    }

    // Logout all devices
    if (logoutAll) {
      if (!userId) {
        return NextResponse.json(
          { error: "User identification required for logout_all" },
          { status: 400 }
        );
      }
      const count = await deleteAllUserTokens(tenantDb, userId);
      return NextResponse.json({
        success: true,
        deleted: count,
        message: `Removed ${count} token(s)`
      });
    }

    if (!fcmToken) {
      return NextResponse.json(
        { error: "fcm_token required" },
        { status: 400 }
      );
    }

    // Delete single token
    const deleted = await deleteTokenByFCMToken(tenantDb, fcmToken);

    return NextResponse.json({
      success: true,
      deleted
    });
  } catch (error) {
    console.error("[fcm/register] DELETE Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET - Check token status
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate using session or API key
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb } = auth;

    // Get fcm_token from query
    const { searchParams } = new URL(req.url);
    const fcmToken = searchParams.get("fcm_token");

    if (!fcmToken) {
      return NextResponse.json(
        { error: "fcm_token required" },
        { status: 400 }
      );
    }

    // Check if token exists
    const token = await getTokenByFCMToken(tenantDb, fcmToken);

    if (!token) {
      return NextResponse.json({
        success: true,
        registered: false
      });
    }

    return NextResponse.json({
      success: true,
      registered: true,
      token_id: token.token_id,
      platform: token.platform,
      is_active: token.is_active,
      preferences: token.preferences
    });
  } catch (error) {
    console.error("[fcm/register] GET Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
