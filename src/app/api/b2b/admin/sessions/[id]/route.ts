/**
 * Admin Session Management API
 *
 * Revoke individual sessions.
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { getSSOSessionModel } from "@/lib/db/models/sso-session";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();

    if (!session.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: sessionId } = await params;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    const SSOSession = await getSSOSessionModel();

    // Verify session belongs to this tenant before revoking
    const targetSession = await SSOSession.findOne({
      session_id: sessionId,
      tenant_id: session.tenantId,
      is_active: true,
    });

    if (!targetSession) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Revoke the session
    await SSOSession.revokeSession(sessionId, "admin_revocation");

    return NextResponse.json({
      success: true,
      message: "Session revoked successfully",
    });
  } catch (error) {
    console.error("Session revoke error:", error);
    return NextResponse.json(
      { error: "Failed to revoke session" },
      { status: 500 }
    );
  }
}
