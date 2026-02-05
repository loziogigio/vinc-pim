/**
 * Threads API
 *
 * GET /api/b2b/threads - List threads (with filters)
 * POST /api/b2b/threads - Create a new thread
 */

import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  listThreads,
  createThread,
} from "@/lib/services/thread.service";
import type { ThreadRefType, ParticipantType } from "@/lib/types/thread";

interface CreateThreadBody {
  ref_type: ThreadRefType;
  ref_id: string;
  subject?: string;
  initial_message?: string;
  participants?: Array<{
    user_id: string;
    user_type: ParticipantType;
    name: string;
    email?: string;
  }>;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const { searchParams } = new URL(req.url);
    const refType = searchParams.get("ref_type") || undefined;
    const refId = searchParams.get("ref_id") || undefined;
    const status = searchParams.get("status") as "open" | "closed" | "archived" | undefined;
    const participantId = searchParams.get("participant_id") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const result = await listThreads(connection, {
      refType,
      refId,
      status,
      participantId,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error listing threads:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list threads" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const body: CreateThreadBody = await req.json();

    if (!body.ref_type || !body.ref_id) {
      return NextResponse.json(
        { error: "ref_type and ref_id are required" },
        { status: 400 }
      );
    }

    const thread = await createThread(
      connection,
      body.ref_type,
      body.ref_id,
      auth.userId || "system",
      auth.userName || "System",
      {
        subject: body.subject,
        initialMessage: body.initial_message,
        participants: body.participants,
        authorType: (auth.isAdmin ? "admin" : "customer") as ParticipantType,
      }
    );

    return NextResponse.json({
      success: true,
      thread,
    });
  } catch (error) {
    console.error("Error creating thread:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create thread" },
      { status: 500 }
    );
  }
}
