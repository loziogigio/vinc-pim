/**
 * Bulk Notification Actions Endpoint
 *
 * POST /api/b2b/notifications/bulk - Bulk mark as read or delete
 *
 * Supports Bearer token, API key, and B2B session authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  markManyAsRead,
  markAllAsRead,
  deleteManyNotifications,
} from "@/lib/notifications/in-app.service";

type BulkAction = "mark_read" | "mark_all_read" | "delete";

interface BulkRequestBody {
  action: BulkAction;
  notification_ids?: string[];
}

/**
 * POST - Bulk actions on notifications
 *
 * Body:
 * - action: "mark_read" | "mark_all_read" | "delete"
 * - notification_ids: string[] (required for mark_read and delete)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req, { requireUserId: true });
    if (!auth.success) return auth.response;

    const { tenantDb, userId } = auth;

    const body: BulkRequestBody = await req.json();

    // Validate action
    const validActions: BulkAction[] = ["mark_read", "mark_all_read", "delete"];
    if (!body.action || !validActions.includes(body.action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(", ")}` },
        { status: 400 }
      );
    }

    // mark_all_read doesn't require notification_ids
    if (body.action === "mark_all_read") {
      const updated = await markAllAsRead(tenantDb, userId!);
      return NextResponse.json({
        success: true,
        updated,
      });
    }

    // Other actions require notification_ids
    if (!body.notification_ids || !Array.isArray(body.notification_ids) || body.notification_ids.length === 0) {
      return NextResponse.json(
        { error: "notification_ids array is required for this action" },
        { status: 400 }
      );
    }

    // Limit bulk operations
    const MAX_BULK_IDS = 100;
    if (body.notification_ids.length > MAX_BULK_IDS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_BULK_IDS} notifications per bulk operation` },
        { status: 400 }
      );
    }

    let updated = 0;

    switch (body.action) {
      case "mark_read":
        updated = await markManyAsRead(tenantDb, body.notification_ids);
        break;
      case "delete":
        updated = await deleteManyNotifications(tenantDb, body.notification_ids);
        break;
    }

    return NextResponse.json({
      success: true,
      updated,
    });
  } catch (error) {
    console.error("[notifications/bulk] POST Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
