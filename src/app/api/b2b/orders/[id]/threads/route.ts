/**
 * Order Threads API
 *
 * GET /api/b2b/orders/[id]/threads - Get threads for an order
 * POST /api/b2b/orders/[id]/threads - Create thread for order
 */

import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  getThreadsForRef,
  getOrCreateThread,
} from "@/lib/services/thread.service";
import type { ParticipantType } from "@/lib/types/thread";

interface CreateThreadBody {
  subject?: string;
  initial_message?: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const auth = await requireTenantAuth(req);
    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const threads = await getThreadsForRef(connection, "order", orderId);

    return NextResponse.json({
      success: true,
      order_id: orderId,
      threads,
    });
  } catch (error) {
    console.error("Error getting order threads:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get threads" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const auth = await requireTenantAuth(req);
    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const body: CreateThreadBody = await req.json().catch(() => ({}));

    // Get or create thread for this order
    const thread = await getOrCreateThread(
      connection,
      "order",
      orderId,
      auth.userId || "system",
      auth.userName || "System",
      {
        subject: body.subject,
        initialMessage: body.initial_message,
        authorType: (auth.isAdmin ? "admin" : "customer") as ParticipantType,
      }
    );

    return NextResponse.json({
      success: true,
      thread,
      created: !body.initial_message, // If no message, it was just fetched/created
    });
  } catch (error) {
    console.error("Error creating order thread:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create thread" },
      { status: 500 }
    );
  }
}
