/**
 * Single Notification Endpoint
 *
 * GET    /api/b2b/notifications/[id] - Get notification
 * PATCH  /api/b2b/notifications/[id] - Mark as read
 * DELETE /api/b2b/notifications/[id] - Delete notification
 *
 * Supports Bearer token, API key, and B2B session authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  getNotificationById,
  markAsRead,
  deleteNotification,
} from "@/lib/notifications/in-app.service";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET - Get a single notification by ID
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireTenantAuth(req, { requireUserId: true });
    if (!auth.success) return auth.response;

    const { tenantDb, userId } = auth;
    const { id } = await context.params;

    const notification = await getNotificationById(tenantDb, id);

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    // Ensure user owns this notification
    if (notification.user_id !== userId) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error("[notifications/[id]] GET Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Mark notification as read
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireTenantAuth(req, { requireUserId: true });
    if (!auth.success) return auth.response;

    const { tenantDb, userId } = auth;
    const { id } = await context.params;

    // First check if notification exists and belongs to user
    const existing = await getNotificationById(tenantDb, id);

    if (!existing) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    if (existing.user_id !== userId) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    // Mark as read
    const notification = await markAsRead(tenantDb, id);

    return NextResponse.json({
      success: true,
      notification: notification || existing, // Return existing if already read
    });
  } catch (error) {
    console.error("[notifications/[id]] PATCH Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete a notification
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireTenantAuth(req, { requireUserId: true });
    if (!auth.success) return auth.response;

    const { tenantDb, userId } = auth;
    const { id } = await context.params;

    // First check if notification exists and belongs to user
    const existing = await getNotificationById(tenantDb, id);

    if (!existing) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    if (existing.user_id !== userId) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    // Delete notification
    await deleteNotification(tenantDb, id);

    return NextResponse.json({
      success: true,
      deleted: true,
    });
  } catch (error) {
    console.error("[notifications/[id]] DELETE Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
