/**
 * In-App Notifications List & Create Endpoint
 *
 * GET  /api/b2b/notifications - List user notifications (paginated)
 * POST /api/b2b/notifications - Create notification (system/admin)
 *
 * Supports Bearer token, API key, and B2B session authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getNotifications, createInAppNotification } from "@/lib/notifications/in-app.service";
import type { NotificationTrigger } from "@/lib/constants/notification";
import { NOTIFICATION_TRIGGERS } from "@/lib/constants/notification";

/**
 * GET - List notifications for the authenticated user
 *
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - unread_only: boolean (default: false)
 * - trigger: NotificationTrigger (optional)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req, { requireUserId: true });
    if (!auth.success) return auth.response;

    const { tenantDb, userId } = auth;

    // Parse query params
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const unreadOnly = searchParams.get("unread_only") === "true";
    const trigger = searchParams.get("trigger") as NotificationTrigger | null;

    // Validate trigger if provided
    if (trigger && !NOTIFICATION_TRIGGERS.includes(trigger)) {
      return NextResponse.json(
        { error: `Invalid trigger. Must be one of: ${NOTIFICATION_TRIGGERS.join(", ")}` },
        { status: 400 }
      );
    }

    const result = await getNotifications(tenantDb, userId!, {
      page,
      limit,
      unreadOnly,
      trigger: trigger || undefined,
    });

    return NextResponse.json({
      success: true,
      notifications: result.notifications,
      pagination: result.pagination,
      unread_count: result.unread_count,
    });
  } catch (error) {
    console.error("[notifications] GET Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new notification
 *
 * Body:
 * - user_id: string (required)
 * - trigger: NotificationTrigger (required)
 * - title: string (required)
 * - body: string (required)
 * - icon: string (optional)
 * - action_url: string (optional)
 * - payload: NotificationPayload (optional) - typed payload (generic, product, order, price)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb } = auth;

    const body = await req.json();

    // Validate required fields
    if (!body.user_id || !body.trigger || !body.title || !body.body) {
      return NextResponse.json(
        { error: "user_id, trigger, title, and body are required" },
        { status: 400 }
      );
    }

    // Validate trigger
    if (!NOTIFICATION_TRIGGERS.includes(body.trigger)) {
      return NextResponse.json(
        { error: `Invalid trigger. Must be one of: ${NOTIFICATION_TRIGGERS.join(", ")}` },
        { status: 400 }
      );
    }

    const notification = await createInAppNotification({
      tenantDb,
      user_id: body.user_id,
      user_type: body.user_type,
      trigger: body.trigger,
      title: body.title,
      body: body.body,
      icon: body.icon,
      action_url: body.action_url,
      payload: body.payload,
    });

    return NextResponse.json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error("[notifications] POST Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
