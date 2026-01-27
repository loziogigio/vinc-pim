/**
 * Push Notifications History Endpoint
 *
 * GET /api/b2b/push/notifications - Get user's notification history
 * PATCH /api/b2b/push/notifications - Mark notifications as read
 *
 * Returns push notification history for the authenticated user.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectToAdminDatabase } from "@/lib/db/admin-connection";
import { getPushLogModel } from "@/lib/db/models/push-log";
import { getSubscriptionsByUser } from "@/lib/push";

/**
 * GET - Get notification history for the current user
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate (requires userId)
    const auth = await requireTenantAuth(req, { requireUserId: true });
    if (!auth.success) return auth.response;

    const { tenantDb, userId } = auth;

    // Get query params
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const skip = parseInt(searchParams.get("skip") || "0", 10);
    const unreadOnly = searchParams.get("unread") === "true";

    // Get user's subscriptions to find their notifications
    const subscriptions = await getSubscriptionsByUser(tenantDb, userId);
    const subscriptionIds = subscriptions.map((s) => s.subscription_id);

    if (subscriptionIds.length === 0) {
      return NextResponse.json({
        success: true,
        notifications: [],
        unread_count: 0,
        total: 0
      });
    }

    // Get notifications from push logs
    const adminConn = await connectToAdminDatabase();
    const PushLog = getPushLogModel(adminConn);

    const query: Record<string, unknown> = {
      subscription_id: { $in: subscriptionIds },
      tenant_db: tenantDb,
      status: { $in: ["sent", "clicked", "dismissed"] }
    };

    if (unreadOnly) {
      query.clicked_at = { $exists: false };
      query.dismissed_at = { $exists: false };
    }

    const [notifications, total, unreadCount] = await Promise.all([
      PushLog.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PushLog.countDocuments(query),
      PushLog.countDocuments({
        ...query,
        clicked_at: { $exists: false },
        dismissed_at: { $exists: false }
      })
    ]);

    // Transform to client format
    const formattedNotifications = notifications.map((n: Record<string, unknown>) => ({
      id: n.push_id,
      title: n.title,
      body: n.body,
      icon: n.icon,
      action_url: n.action_url,
      timestamp: n.created_at,
      read: !!(n.clicked_at || n.dismissed_at),
      data: n.data
    }));

    return NextResponse.json({
      success: true,
      notifications: formattedNotifications,
      unread_count: unreadCount,
      total
    });
  } catch (error) {
    console.error("[push/notifications] GET Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Mark notifications as read
 */
export async function PATCH(req: NextRequest) {
  try {
    // Authenticate (requires userId)
    const auth = await requireTenantAuth(req, { requireUserId: true });
    if (!auth.success) return auth.response;

    const { tenantDb, userId } = auth;

    // Parse request body
    const body = await req.json();
    const { notification_ids, mark_all } = body as {
      notification_ids?: string[];
      mark_all?: boolean;
    };

    // Get user's subscriptions
    const subscriptions = await getSubscriptionsByUser(tenantDb, userId);
    const subscriptionIds = subscriptions.map((s) => s.subscription_id);

    if (subscriptionIds.length === 0) {
      return NextResponse.json({
        success: true,
        updated: 0
      });
    }

    const adminConn = await connectToAdminDatabase();
    const PushLog = getPushLogModel(adminConn);

    let query: Record<string, unknown> = {
      subscription_id: { $in: subscriptionIds },
      tenant_db: tenantDb,
      clicked_at: { $exists: false },
      dismissed_at: { $exists: false }
    };

    if (!mark_all && notification_ids && notification_ids.length > 0) {
      query.push_id = { $in: notification_ids };
    }

    const result = await PushLog.updateMany(query, {
      $set: { clicked_at: new Date() }
    });

    return NextResponse.json({
      success: true,
      updated: result.modifiedCount
    });
  } catch (error) {
    console.error("[push/notifications] PATCH Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
