/**
 * Mark Thread as Read API
 *
 * POST /api/b2b/threads/[id]/read - Mark all messages as read
 */

import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { markAsRead } from "@/lib/services/thread.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: threadId } = await params;
    const auth = await requireTenantAuth(req);
    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const result = await markAsRead(
      connection,
      threadId,
      auth.userId || "anonymous"
    );

    if (!result) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      thread_id: threadId,
      marked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error marking thread as read:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to mark as read" },
      { status: 500 }
    );
  }
}
