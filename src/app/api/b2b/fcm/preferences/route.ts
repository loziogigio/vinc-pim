/**
 * FCM Notification Preferences Endpoint
 *
 * GET /api/b2b/fcm/preferences - Get user's notification preferences
 * PATCH /api/b2b/fcm/preferences - Update preferences
 *
 * Manages FCM push notification preferences for mobile app users.
 * Supports both B2B Session and API Key authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  getTokensByUser,
  updateUserPreferences,
  getToken,
  updatePreferences
} from "@/lib/fcm/token.service";
import type { FCMPreferences } from "@/lib/fcm/types";

/**
 * GET - Get user's notification preferences
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate using session or API key (userId required)
    const auth = await requireTenantAuth(req, { requireUserId: true });
    if (!auth.success) return auth.response;

    const { tenantDb, userId } = auth;

    // Get token ID from query (optional)
    const { searchParams } = new URL(req.url);
    const tokenId = searchParams.get("token_id");

    if (tokenId) {
      // Get specific token preferences
      const token = await getToken(tenantDb, tokenId);

      if (!token) {
        return NextResponse.json(
          { error: "Token not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        token_id: token.token_id,
        preferences: token.preferences
      });
    }

    // Get all user's tokens and their preferences
    const tokens = await getTokensByUser(tenantDb, userId);

    if (tokens.length === 0) {
      return NextResponse.json({
        success: true,
        tokens: [],
        // Return default preferences for UI
        defaultPreferences: {
          order_updates: true,
          price_alerts: true,
          marketing: false,
          system: true
        }
      });
    }

    return NextResponse.json({
      success: true,
      tokens: tokens.map((token) => ({
        token_id: token.token_id,
        platform: token.platform,
        device_model: token.device_model,
        is_active: token.is_active,
        preferences: token.preferences,
        last_used_at: token.last_used_at
      }))
    });
  } catch (error) {
    console.error("[fcm/preferences] GET Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update notification preferences
 */
export async function PATCH(req: NextRequest) {
  try {
    // Authenticate using session or API key (userId required)
    const auth = await requireTenantAuth(req, { requireUserId: true });
    if (!auth.success) return auth.response;

    const { tenantDb, userId } = auth;

    // Parse request body
    const body = await req.json();
    const { token_id, preferences, update_all } = body as {
      token_id?: string;
      preferences: Partial<FCMPreferences>;
      update_all?: boolean;
    };

    if (!preferences || typeof preferences !== "object") {
      return NextResponse.json(
        { error: "Preferences object required" },
        { status: 400 }
      );
    }

    // Validate preference keys
    const validKeys: (keyof FCMPreferences)[] = [
      "order_updates",
      "price_alerts",
      "marketing",
      "system"
    ];

    const filteredPreferences: Partial<FCMPreferences> = {};
    for (const key of validKeys) {
      if (key in preferences && typeof preferences[key] === "boolean") {
        filteredPreferences[key] = preferences[key];
      }
    }

    if (Object.keys(filteredPreferences).length === 0) {
      return NextResponse.json(
        { error: "No valid preferences provided" },
        { status: 400 }
      );
    }

    if (update_all || !token_id) {
      // Update all user's tokens
      const updated = await updateUserPreferences(
        tenantDb,
        userId,
        filteredPreferences
      );

      return NextResponse.json({
        success: true,
        updated_count: updated,
        preferences: filteredPreferences
      });
    }

    // Update specific token
    const success = await updatePreferences(
      tenantDb,
      token_id,
      filteredPreferences
    );

    if (!success) {
      return NextResponse.json(
        { error: "Token not found or not updated" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      token_id,
      preferences: filteredPreferences
    });
  } catch (error) {
    console.error("[fcm/preferences] PATCH Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
