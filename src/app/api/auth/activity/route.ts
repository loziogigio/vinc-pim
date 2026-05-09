/**
 * POST /api/auth/activity
 *
 * Heartbeat endpoint. Storefronts call this on real user input
 * (mousedown/keydown/touchstart/visibility-visible), throttled client-side.
 * Updates the SSO session's `last_user_activity` so the idle-timeout clock
 * (enforced in refreshTokens) is reset only by genuine user activity, not by
 * silent token refreshes.
 *
 * Auth: Bearer access token in the Authorization header.
 * Throttled server-side: skips the DB write if `last_user_activity` was
 * updated within the last 30 seconds.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateAccessToken } from "@/lib/sso/tokens";
import { getSSOSessionModel } from "@/lib/db/models/sso-session";

const SERVER_THROTTLE_MS = 30_000;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!token) {
      return NextResponse.json(
        { error: "Missing access token" },
        { status: 401 }
      );
    }

    const payload = await validateAccessToken(token);
    if (!payload?.session_id) {
      return NextResponse.json(
        { error: "Invalid access token" },
        { status: 401 }
      );
    }

    const SSOSession = await getSSOSessionModel();
    await SSOSession.updateLastUserActivity(
      payload.session_id,
      SERVER_THROTTLE_MS
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth/activity] Error:", error);
    return NextResponse.json(
      { error: "Failed to record activity" },
      { status: 500 }
    );
  }
}
