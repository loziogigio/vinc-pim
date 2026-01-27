/**
 * Push Subscription Endpoint
 *
 * POST /api/b2b/push/subscribe - Create/update subscription
 * DELETE /api/b2b/push/subscribe - Remove subscription
 * GET /api/b2b/push/subscribe - Check subscription status
 *
 * Supports both B2B Session and API Key authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  createSubscription,
  deleteSubscriptionByEndpoint,
  getSubscriptionByEndpoint,
  isWebPushEnabled
} from "@/lib/push";
import type { PushPreferences } from "@/lib/push/types";

interface SubscribeRequestBody {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  preferences?: Partial<PushPreferences>;
  device_type?: "desktop" | "mobile" | "tablet";
}

/**
 * POST - Create or update push subscription
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate using session or API key
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantId, tenantDb, userId } = auth;

    // Check if web push is enabled
    const enabled = await isWebPushEnabled(tenantDb);
    if (!enabled) {
      return NextResponse.json(
        { error: "Web push notifications not enabled" },
        { status: 400 }
      );
    }

    // Parse request body
    const body: SubscribeRequestBody = await req.json();

    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json(
        { error: "Invalid subscription: endpoint and keys required" },
        { status: 400 }
      );
    }

    // Get user agent for device info
    const userAgent = req.headers.get("user-agent") || undefined;

    // Create subscription
    const subscription = await createSubscription(tenantDb, {
      tenant_id: tenantId,
      user_id: userId,
      user_type: "b2b_user",
      endpoint: body.endpoint,
      keys: body.keys,
      user_agent: userAgent,
      device_type: body.device_type,
      preferences: body.preferences
    });

    return NextResponse.json({
      success: true,
      subscription_id: subscription.subscription_id,
      preferences: subscription.preferences
    });
  } catch (error) {
    console.error("[push/subscribe] POST Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Remove push subscription
 */
export async function DELETE(req: NextRequest) {
  try {
    // Authenticate using session or API key
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb } = auth;

    // Get endpoint from query or body
    const { searchParams } = new URL(req.url);
    let endpoint = searchParams.get("endpoint");

    if (!endpoint) {
      try {
        const body = await req.json();
        endpoint = body.endpoint;
      } catch {
        // No body
      }
    }

    if (!endpoint) {
      return NextResponse.json(
        { error: "Endpoint required" },
        { status: 400 }
      );
    }

    // Delete subscription
    const deleted = await deleteSubscriptionByEndpoint(tenantDb, endpoint);

    return NextResponse.json({
      success: true,
      deleted
    });
  } catch (error) {
    console.error("[push/subscribe] DELETE Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET - Check subscription status
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate using session or API key
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb } = auth;

    // Get endpoint from query
    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get("endpoint");

    if (!endpoint) {
      return NextResponse.json(
        { error: "Endpoint required" },
        { status: 400 }
      );
    }

    // Check if subscription exists
    const subscription = await getSubscriptionByEndpoint(tenantDb, endpoint);

    if (!subscription) {
      return NextResponse.json({
        success: true,
        subscribed: false
      });
    }

    return NextResponse.json({
      success: true,
      subscribed: true,
      subscription_id: subscription.subscription_id,
      is_active: subscription.is_active,
      preferences: subscription.preferences
    });
  } catch (error) {
    console.error("[push/subscribe] GET Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
