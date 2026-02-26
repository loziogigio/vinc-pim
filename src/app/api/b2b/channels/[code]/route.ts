/**
 * Single Sales Channel API
 *
 * GET    /api/b2b/channels/[code] - Get a single channel
 * PATCH  /api/b2b/channels/[code] - Update a channel
 * DELETE /api/b2b/channels/[code] - Soft-delete (set is_active: false)
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";

// ============================================
// GET - Get single channel
// ============================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await params;
    const tenantDb = `vinc-${session.tenantId}`;
    const { SalesChannel } = await connectWithModels(tenantDb);

    const channel = await SalesChannel.findOne({ code }).lean();
    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, channel });
  } catch (error) {
    console.error("Error fetching channel:", error);
    return NextResponse.json({ error: "Failed to fetch channel" }, { status: 500 });
  }
}

// ============================================
// PATCH - Update channel (code is immutable)
// ============================================

interface UpdateChannelPayload {
  name?: string;
  description?: string;
  color?: string;
  is_default?: boolean;
  is_active?: boolean;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await params;
    const tenantDb = `vinc-${session.tenantId}`;
    const body: UpdateChannelPayload = await req.json();
    const { SalesChannel } = await connectWithModels(tenantDb);

    const channel = await SalesChannel.findOne({ code });
    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    if (body.name !== undefined) {
      const trimmed = body.name.trim();
      if (!trimmed) {
        return NextResponse.json({ error: "Channel name cannot be empty" }, { status: 400 });
      }
      channel.name = trimmed;
    }

    if (body.description !== undefined) {
      channel.description = body.description?.trim() || undefined;
    }

    if (body.color !== undefined) {
      channel.color = body.color?.trim() || undefined;
    }

    if (body.is_active !== undefined) {
      channel.is_active = body.is_active;
    }

    // Setting as default: unset previous default first
    if (body.is_default === true) {
      await SalesChannel.updateMany(
        { code: { $ne: code }, is_default: true },
        { $set: { is_default: false } }
      );
      channel.is_default = true;
    } else if (body.is_default === false) {
      channel.is_default = false;
    }

    await channel.save();

    return NextResponse.json({ success: true, channel, message: "Channel updated" });
  } catch (error) {
    console.error("Error updating channel:", error);
    return NextResponse.json({ error: "Failed to update channel" }, { status: 500 });
  }
}

// ============================================
// DELETE - Soft-delete (deactivate) channel
// ============================================

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await params;
    const tenantDb = `vinc-${session.tenantId}`;
    const { SalesChannel } = await connectWithModels(tenantDb);

    const channel = await SalesChannel.findOne({ code });
    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    if (channel.is_default) {
      return NextResponse.json(
        { error: "Cannot delete the default channel" },
        { status: 400 }
      );
    }

    // Soft-delete: set is_active to false
    channel.is_active = false;
    await channel.save();

    return NextResponse.json({ success: true, message: "Channel deactivated" });
  } catch (error) {
    console.error("Error deleting channel:", error);
    return NextResponse.json({ error: "Failed to delete channel" }, { status: 500 });
  }
}
