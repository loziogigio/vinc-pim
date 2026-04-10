/**
 * POST /api/auth/authorize
 *
 * Generates an OAuth authorization code using an existing SSO session.
 * Called by the login page when it detects the user is already authenticated
 * (silent cross-app login).
 *
 * Body:
 * - client_id: string (required)
 * - redirect_uri: string (required)
 * - tenant_id: string (required)
 * - state?: string
 * - code_challenge?: string
 * - code_challenge_method?: "plain" | "S256"
 */

import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/sso/session";
import { createAuthCode, validateClientForTenant } from "@/lib/sso/oauth";

export async function POST(req: NextRequest) {
  try {
    const sessionId = req.cookies.get("sso_sid")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { error: "No active session" },
        { status: 401 }
      );
    }

    const session = await validateSession(sessionId);

    if (!session || !session.is_active) {
      return NextResponse.json(
        { error: "Session expired" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { client_id, redirect_uri, tenant_id, state, code_challenge, code_challenge_method } = body;

    if (!client_id || !redirect_uri || !tenant_id) {
      return NextResponse.json(
        { error: "Missing required parameters: client_id, redirect_uri, tenant_id" },
        { status: 400 }
      );
    }

    // Validate client and redirect_uri
    const client = await validateClientForTenant(client_id, redirect_uri, tenant_id);
    if (!client) {
      return NextResponse.json(
        { error: "Invalid client_id or redirect_uri" },
        { status: 400 }
      );
    }

    // Generate auth code from existing session
    const code = await createAuthCode({
      client_id,
      tenant_id,
      user_id: session.user_id,
      user_email: session.user_email,
      user_role: session.user_role,
      redirect_uri,
      state,
      code_challenge,
      code_challenge_method,
      vinc_profile: session.vinc_profile || undefined,
    });

    return NextResponse.json({
      redirect_uri,
      code,
      state,
    });
  } catch (error) {
    console.error("[auth/authorize] Error:", error);
    return NextResponse.json(
      { error: "Authorization failed" },
      { status: 500 }
    );
  }
}
