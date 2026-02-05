/**
 * Message Reaction API
 *
 * POST /api/b2b/threads/[id]/messages/[msgId]/react - Add reaction
 * DELETE /api/b2b/threads/[id]/messages/[msgId]/react - Remove reaction
 */

import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  addReaction,
  removeReaction,
} from "@/lib/services/thread.service";
import type { ReactionType } from "@/lib/types/thread";

interface AddReactionBody {
  reaction_type: ReactionType;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  try {
    const { id: threadId, msgId: messageId } = await params;
    const auth = await requireTenantAuth(req);
    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const body: AddReactionBody = await req.json();

    if (!body.reaction_type) {
      return NextResponse.json(
        { error: "reaction_type is required" },
        { status: 400 }
      );
    }

    const result = await addReaction(
      connection,
      threadId,
      messageId,
      auth.userId || "anonymous",
      auth.userName || "User",
      body.reaction_type
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
    console.error("Error adding reaction:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add reaction" },
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

    const result = await removeReaction(
      connection,
      threadId,
      messageId,
      auth.userId || "anonymous"
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
    console.error("Error removing reaction:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove reaction" },
      { status: 500 }
    );
  }
}
