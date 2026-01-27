/**
 * Push Notification Click Tracking Endpoint
 *
 * GET /api/push/track/click/[pushId]
 *
 * Records push notification clicks and optionally redirects to action URL.
 * This endpoint does NOT require authentication (called by service worker).
 */

import { NextRequest, NextResponse } from "next/server";
import { recordPushClick } from "@/lib/push";
import { connectToAdminDatabase } from "@/lib/db/admin-connection";
import { getPushLogModel } from "@/lib/db/models/push-log";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pushId: string }> }
) {
  try {
    const { pushId } = await params;

    if (!pushId) {
      return NextResponse.json(
        { error: "Push ID required" },
        { status: 400 }
      );
    }

    // Get optional redirect URL from query
    const { searchParams } = new URL(req.url);
    const redirectUrl = searchParams.get("url");

    // Record the click
    const recorded = await recordPushClick(pushId, redirectUrl || undefined);

    // If redirect URL provided, redirect to it
    if (redirectUrl) {
      return NextResponse.redirect(redirectUrl, 302);
    }

    // Otherwise, return JSON response
    return NextResponse.json({
      success: true,
      recorded
    });
  } catch (error) {
    console.error("[push/track/click] Error:", error);

    // Even on error, try to redirect if URL provided
    const { searchParams } = new URL(req.url);
    const redirectUrl = searchParams.get("url");
    if (redirectUrl) {
      return NextResponse.redirect(redirectUrl, 302);
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST - Alternative method for recording clicks
 * Useful when the service worker wants to send additional data
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pushId: string }> }
) {
  try {
    const { pushId } = await params;

    if (!pushId) {
      return NextResponse.json(
        { error: "Push ID required" },
        { status: 400 }
      );
    }

    // Parse optional body
    let url: string | undefined;
    try {
      const body = await req.json();
      url = body.url;
    } catch {
      // No body or invalid JSON
    }

    // Record the click
    const recorded = await recordPushClick(pushId, url);

    return NextResponse.json({
      success: true,
      recorded
    });
  } catch (error) {
    console.error("[push/track/click] POST Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
