/**
 * VAPID Public Key Endpoint
 *
 * GET /api/b2b/push/vapid-public-key
 *
 * Returns the public VAPID key for client-side push subscription.
 * Supports both B2B Session and API Key authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getVapidPublicKey, isWebPushEnabled } from "@/lib/push";

export async function GET(req: NextRequest) {
  try {
    // Authenticate using session or API key
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb } = auth;

    // Check if web push is enabled
    const enabled = await isWebPushEnabled(tenantDb);
    if (!enabled) {
      return NextResponse.json(
        { error: "Web push notifications not enabled" },
        { status: 404 }
      );
    }

    // Get public key
    const publicKey = await getVapidPublicKey(tenantDb);
    if (!publicKey) {
      return NextResponse.json(
        { error: "VAPID keys not configured" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      publicKey
    });
  } catch (error) {
    console.error("[vapid-public-key] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
