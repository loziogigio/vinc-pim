/**
 * Thread Message API
 *
 * PATCH /api/b2b/threads/[id]/messages/[msgId] - Edit message
 * DELETE /api/b2b/threads/[id]/messages/[msgId] - Soft delete message
 */

import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  editMessage,
  deleteMessage,
} from "@/lib/services/thread.service";

interface EditMessageBody {
  content: string;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  try {
    const { id: threadId, msgId: messageId } = await params;
    const auth = await requireTenantAuth(req);
    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const body: EditMessageBody = await req.json();

    if (!body.content) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }

    const result = await editMessage(
      connection,
      threadId,
      messageId,
      body.content,
      auth.userId || "anonymous"
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error === "Thread not found" ? 404 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Error editing message:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to edit message" },
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

    const result = await deleteMessage(
      connection,
      threadId,
      messageId,
      auth.userId || "anonymous"
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error === "Thread not found" ? 404 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error deleting message:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete message" },
      { status: 500 }
    );
  }
}
