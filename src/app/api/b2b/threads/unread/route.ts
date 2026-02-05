/**
 * Unread Count API
 *
 * GET /api/b2b/threads/unread - Get unread count for user
 */

import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getUnreadCount } from "@/lib/services/thread.service";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const result = await getUnreadCount(
      connection,
      auth.userId || "anonymous"
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error getting unread count:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get unread count" },
      { status: 500 }
    );
  }
}
