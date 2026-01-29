/**
 * FCM Send Notification Endpoint
 *
 * POST /api/b2b/fcm/send - Send FCM notification (admin/test)
 *
 * Admin endpoint for sending FCM push notifications.
 * Supports targeting by user IDs, token IDs, or preference type.
 * Supports both B2B Session and API Key authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { sendFCM, isFCMEnabled, getTokenStats } from "@/lib/fcm";
import type { FCMPreferences } from "@/lib/fcm/types";

interface SendRequestBody {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  action_url?: string;
  data?: Record<string, string>;
  user_ids?: string[];
  token_ids?: string[];
  preference_type?: keyof FCMPreferences;
  queue?: boolean;
  priority?: "normal" | "high";
  badge?: number;
  channel_id?: string;
  ttl?: number;
}

/**
 * POST - Send FCM notification
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate using session or API key
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb } = auth;

    // Check if FCM is enabled
    const enabled = await isFCMEnabled(tenantDb);
    if (!enabled) {
      return NextResponse.json(
        { error: "FCM push notifications not enabled" },
        { status: 400 }
      );
    }

    // Parse request body
    const body: SendRequestBody = await req.json();

    if (!body.title || !body.body) {
      return NextResponse.json(
        { error: "Title and body are required" },
        { status: 400 }
      );
    }

    // Send notification
    const result = await sendFCM({
      tenantDb,
      title: body.title,
      body: body.body,
      icon: body.icon,
      image: body.image,
      action_url: body.action_url,
      data: body.data,
      userIds: body.user_ids,
      tokenIds: body.token_ids,
      preferenceType: body.preference_type,
      queue: body.queue ?? true, // Default to queued
      priority: body.priority,
      badge: body.badge,
      channelId: body.channel_id,
      ttl: body.ttl
    });

    return NextResponse.json({
      success: result.success,
      queued: result.queued,
      sent: result.sent,
      failed: result.failed,
      errors: result.errors
    });
  } catch (error) {
    console.error("[fcm/send] POST Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET - Get FCM status and stats
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate using session or API key
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb } = auth;

    // Check if FCM is enabled
    const enabled = await isFCMEnabled(tenantDb);

    // Get token stats
    const stats = await getTokenStats(tenantDb);

    return NextResponse.json({
      success: true,
      enabled,
      stats: {
        total_tokens: stats.total,
        active_tokens: stats.active,
        by_platform: stats.byPlatform,
        by_user_type: stats.byUserType
      }
    });
  } catch (error) {
    console.error("[fcm/send] GET Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
