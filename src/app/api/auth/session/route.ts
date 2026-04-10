/**
 * GET /api/auth/session
 *
 * Checks if the user has an active SSO session (via sso_sid cookie).
 * Used by the SSO login page to enable silent cross-app login.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/sso/session";

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.cookies.get("sso_sid")?.value;

    if (!sessionId) {
      return NextResponse.json({ authenticated: false });
    }

    const session = await validateSession(sessionId);

    if (!session || !session.is_active) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
      user_id: session.user_id,
      user_email: session.user_email,
      user_role: session.user_role,
      tenant_id: session.tenant_id,
      session_id: session.session_id,
    });
  } catch (error) {
    console.error("[auth/session] Error:", error);
    return NextResponse.json({ authenticated: false });
  }
}
