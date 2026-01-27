/**
 * Push Notification Preferences Endpoint
 *
 * GET /api/b2b/push/preferences - Get user's notification preferences
 * PATCH /api/b2b/push/preferences - Update preferences
 *
 * Manages push notification preferences for authenticated users.
 * Supports both B2B Session and API Key authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  getSubscriptionsByUser,
  updateUserPreferences,
  getSubscription,
  updatePreferences
} from "@/lib/push";
import type { PushPreferences } from "@/lib/push/types";

/**
 * GET - Get user's notification preferences
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate using session or API key (userId required)
    const auth = await requireTenantAuth(req, { requireUserId: true });
    if (!auth.success) return auth.response;

    const { tenantDb, userId } = auth;

    // Get subscription ID from query (optional)
    const { searchParams } = new URL(req.url);
    const subscriptionId = searchParams.get("subscription_id");

    if (subscriptionId) {
      // Get specific subscription preferences
      const subscription = await getSubscription(tenantDb, subscriptionId);

      if (!subscription) {
        return NextResponse.json(
          { error: "Subscription not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        subscription_id: subscription.subscription_id,
        preferences: subscription.preferences
      });
    }

    // Get all user's subscriptions and their preferences
    const subscriptions = await getSubscriptionsByUser(tenantDb, userId);

    if (subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        subscriptions: [],
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
      subscriptions: subscriptions.map((sub) => ({
        subscription_id: sub.subscription_id,
        device_type: sub.device_type,
        is_active: sub.is_active,
        preferences: sub.preferences,
        last_used_at: sub.last_used_at
      }))
    });
  } catch (error) {
    console.error("[push/preferences] GET Error:", error);
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
    const { subscription_id, preferences, update_all } = body as {
      subscription_id?: string;
      preferences: Partial<PushPreferences>;
      update_all?: boolean;
    };

    if (!preferences || typeof preferences !== "object") {
      return NextResponse.json(
        { error: "Preferences object required" },
        { status: 400 }
      );
    }

    // Validate preference keys
    const validKeys: (keyof PushPreferences)[] = [
      "order_updates",
      "price_alerts",
      "marketing",
      "system"
    ];

    const filteredPreferences: Partial<PushPreferences> = {};
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

    if (update_all || !subscription_id) {
      // Update all user's subscriptions
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

    // Update specific subscription
    const success = await updatePreferences(
      tenantDb,
      subscription_id,
      filteredPreferences
    );

    if (!success) {
      return NextResponse.json(
        { error: "Subscription not found or not updated" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      subscription_id,
      preferences: filteredPreferences
    });
  } catch (error) {
    console.error("[push/preferences] PATCH Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
