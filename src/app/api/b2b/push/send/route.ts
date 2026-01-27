/**
 * Push Notification Send Endpoint
 *
 * POST /api/b2b/push/send - Send a push notification
 *
 * Requires admin API key authentication.
 * Can send to specific users or broadcast to all subscribers.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { sendPush } from "@/lib/push";
import type { PushPreferences } from "@/lib/push/types";

interface SendPushRequestBody {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  action_url?: string;
  data?: Record<string, unknown>;
  user_ids?: string[];
  preference_type?: keyof PushPreferences;
  queue?: boolean;
}

/**
 * POST - Send push notification
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate using API key (admin only)
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb } = auth;

    // Parse request body
    const body: SendPushRequestBody = await req.json();

    if (!body.title || !body.body) {
      return NextResponse.json(
        { error: "title and body are required" },
        { status: 400 }
      );
    }

    // Send push notification
    const result = await sendPush({
      tenantDb,
      title: body.title,
      body: body.body,
      icon: body.icon,
      badge: body.badge,
      action_url: body.action_url,
      data: body.data,
      userIds: body.user_ids,
      preferenceType: body.preference_type,
      queue: body.queue ?? false,
      trigger: "api"
    });

    return NextResponse.json({
      success: result.success,
      sent: result.sent,
      failed: result.failed,
      queued: result.queued,
      errors: result.errors
    });
  } catch (error) {
    console.error("[push/send] POST Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
