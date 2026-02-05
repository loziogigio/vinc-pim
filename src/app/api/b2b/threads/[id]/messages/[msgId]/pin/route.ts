/**
 * Message Pin API
 *
 * POST /api/b2b/threads/[id]/messages/[msgId]/pin - Pin message
 * DELETE /api/b2b/threads/[id]/messages/[msgId]/pin - Unpin message
 */

import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { togglePinMessage } from "@/lib/services/thread.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  try {
    const { id: threadId, msgId: messageId } = await params;
    const auth = await requireTenantAuth(req);
    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const result = await togglePinMessage(
      connection,
      threadId,
      messageId,
      true // pin
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Error pinning message:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to pin message" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  try {
    const { id: threadId, msgId: messageId } = await params;
    const auth = await requireTenantAuth(req);
    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const result = await togglePinMessage(
      connection,
      threadId,
      messageId,
      false // unpin
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Error unpinning message:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to unpin message" },
      { status: 500 }
    );
  }
}
