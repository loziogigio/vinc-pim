/**
 * Unread Notification Count Endpoint
 *
 * GET /api/b2b/notifications/unread-count - Get unread count
 *
 * Supports Bearer token, API key, and B2B session authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getUnreadCount } from "@/lib/notifications/in-app.service";

/**
 * GET - Get unread notification count for authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req, { requireUserId: true });
    if (!auth.success) return auth.response;

    const { tenantDb, userId } = auth;

    const count = await getUnreadCount(tenantDb, userId!);

    return NextResponse.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error("[notifications/unread-count] GET Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
