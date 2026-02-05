/**
 * Thread Messages API
 *
 * GET /api/b2b/threads/[id]/messages - List messages (with pagination)
 * POST /api/b2b/threads/[id]/messages - Add a message
 */

import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  getThread,
  addMessage,
} from "@/lib/services/thread.service";
import type { ContentType, ParticipantType } from "@/lib/types/thread";

interface AddMessageBody {
  content: string;
  content_type?: ContentType;
  parent_id?: string;
  is_internal?: boolean;
  attachments?: Array<{
    filename: string;
    url: string;
    mime_type: string;
    size_bytes: number;
  }>;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: threadId } = await params;
    const auth = await requireTenantAuth(req);
    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const thread = await getThread(connection, threadId);

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // Filter out internal messages for non-admin/sales users
    let messages = thread.messages;
    if (!auth.isAdmin) {
      messages = messages.filter((m) => !m.is_internal);
    }

    // Sort: pinned first, then by date
    messages = messages.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    return NextResponse.json({
      success: true,
      thread_id: threadId,
      message_count: messages.length,
      messages,
    });
  } catch (error) {
    console.error("Error getting messages:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get messages" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: threadId } = await params;
    const auth = await requireTenantAuth(req);
    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const body: AddMessageBody = await req.json();

    if (!body.content) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }

    // Determine author type
    const authorType: ParticipantType = auth.isAdmin ? "admin" : "customer";

    const message = await addMessage(
      connection,
      threadId,
      auth.userId || "anonymous",
      body.content,
      {
        authorName: auth.userName || "User",
        authorType,
        contentType: body.content_type,
        parentId: body.parent_id,
        isInternal: body.is_internal,
        attachments: body.attachments,
      }
    );

    if (!message) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error("Error adding message:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add message" },
      { status: 500 }
    );
  }
}
