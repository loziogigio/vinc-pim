/**
 * Thread API
 *
 * GET /api/b2b/threads/[id] - Get thread by ID
 * PATCH /api/b2b/threads/[id] - Update thread status
 */

import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  getThread,
  closeThread,
} from "@/lib/services/thread.service";
import type { ThreadStatus } from "@/lib/types/thread";

interface UpdateThreadBody {
  status?: ThreadStatus;
  subject?: string;
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

    return NextResponse.json({
      success: true,
      thread,
    });
  } catch (error) {
    console.error("Error getting thread:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get thread" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: threadId } = await params;
    const auth = await requireTenantAuth(req);
    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const body: UpdateThreadBody = await req.json();

    // Handle status change
    if (body.status === "closed") {
      const thread = await closeThread(connection, threadId);
      if (!thread) {
        return NextResponse.json({ error: "Thread not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, thread });
    }

    // Handle other updates
    const thread = await getThread(connection, threadId);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    if (body.status) {
      thread.status = body.status;
    }
    if (body.subject !== undefined) {
      thread.subject = body.subject;
    }

    await thread.save();

    return NextResponse.json({
      success: true,
      thread,
    });
  } catch (error) {
    console.error("Error updating thread:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update thread" },
      { status: 500 }
    );
  }
}
