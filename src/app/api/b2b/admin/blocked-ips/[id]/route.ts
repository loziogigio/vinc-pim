/**
 * Admin Blocked IP Management API
 *
 * Unblock individual IPs.
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { getBlockedIPModel } from "@/lib/db/models/sso-blocked-ip";
import mongoose from "mongoose";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();

    if (!session.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid blocked IP ID" },
        { status: 400 }
      );
    }

    const BlockedIP = await getBlockedIPModel();

    // Find the blocked IP and verify it belongs to this tenant (or is accessible)
    const blockedIP = await BlockedIP.findOne({
      _id: new mongoose.Types.ObjectId(id),
      is_active: true,
      $or: [{ tenant_id: session.tenantId }, { is_global: true }],
    });

    if (!blockedIP) {
      return NextResponse.json(
        { error: "Blocked IP not found" },
        { status: 404 }
      );
    }

    // Cannot unblock global IPs unless you're a super admin
    if (blockedIP.is_global) {
      return NextResponse.json(
        { error: "Cannot unblock global IPs. Contact system administrator." },
        { status: 403 }
      );
    }

    // Unblock the IP
    await BlockedIP.findByIdAndUpdate(id, {
      $set: {
        is_active: false,
        unblocked_at: new Date(),
        unblocked_by: session.email,
      },
    });

    return NextResponse.json({
      success: true,
      message: "IP unblocked successfully",
    });
  } catch (error) {
    console.error("Unblock IP error:", error);
    return NextResponse.json(
      { error: "Failed to unblock IP" },
      { status: 500 }
    );
  }
}
