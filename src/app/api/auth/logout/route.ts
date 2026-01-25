/**
 * SSO Logout API
 *
 * POST /api/auth/logout
 *
 * Ends a user session and revokes associated tokens.
 * Can end a single session or all user sessions.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateAccessToken, revokeAllUserTokens } from "@/lib/sso/tokens";
import { endSession, endAllUserSessions } from "@/lib/sso/session";

interface LogoutRequest {
  // Option 1: Access token (recommended)
  access_token?: string;

  // Option 2: Session ID (for specific session)
  session_id?: string;

  // Option 3: End all sessions for user
  all_sessions?: boolean;

  // Optional: Redirect after logout
  redirect_uri?: string;
}

export async function POST(req: NextRequest) {
  // Support Authorization header for access token
  const authHeader = req.headers.get("authorization");
  let accessToken: string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    accessToken = authHeader.slice(7);
  }

  let body: LogoutRequest;

  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const {
    access_token: bodyToken,
    session_id,
    all_sessions = false,
    redirect_uri,
  } = body;

  // Use token from header or body
  const token = accessToken || bodyToken;

  // Need either a token or session_id
  if (!token && !session_id) {
    return NextResponse.json(
      { error: "Access token or session_id is required" },
      { status: 400 }
    );
  }

  try {
    let sessionEnded = false;
    let sessionsEndedCount = 0;
    let tenantId: string | undefined;
    let userId: string | undefined;

    // If we have a token, validate it and extract session info
    if (token) {
      const payload = await validateAccessToken(token);

      if (!payload) {
        return NextResponse.json(
          { error: "Invalid or expired access token" },
          { status: 401 }
        );
      }

      tenantId = payload.tenant_id;
      userId = payload.sub;

      if (all_sessions && tenantId && userId) {
        // End all sessions for this user
        sessionsEndedCount = await endAllUserSessions(tenantId, userId, "user_logout_all");
        await revokeAllUserTokens(tenantId, userId);
        sessionEnded = true;
      } else {
        // End just this session
        sessionEnded = await endSession(payload.session_id, "user_logout");
      }
    } else if (session_id) {
      // End specific session by ID
      sessionEnded = await endSession(session_id, "user_logout");
    }

    // Build response
    const response: Record<string, unknown> = {
      success: sessionEnded || sessionsEndedCount > 0,
    };

    if (sessionsEndedCount > 0) {
      response.sessions_ended = sessionsEndedCount;
    }

    if (redirect_uri) {
      response.redirect_uri = redirect_uri;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Logout failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/logout
 *
 * Support GET for browser-based logout with redirect.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const sessionId = searchParams.get("session_id");
  const redirectUri = searchParams.get("redirect_uri") || searchParams.get("post_logout_redirect_uri");

  if (sessionId) {
    try {
      await endSession(sessionId, "user_logout");
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  // Redirect to the specified URI or return success
  if (redirectUri) {
    return NextResponse.redirect(redirectUri);
  }

  return NextResponse.json({ success: true });
}
