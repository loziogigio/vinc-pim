/**
 * SSO Token Validation API
 *
 * POST /api/auth/validate
 *
 * Validates an access token and returns user/session information.
 * Used by client applications to verify tokens.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateAccessToken, type TokenPayload } from "@/lib/sso/tokens";
import { validateSession, getSession } from "@/lib/sso/session";

interface ValidateRequest {
  access_token?: string;
}

interface TokenInfo {
  active: boolean;
  token_type?: string;
  client_id?: string;
  username?: string;
  sub?: string;
  tenant_id?: string;
  session_id?: string;
  email?: string;
  role?: string;
  exp?: number;
  iat?: number;
  jti?: string;
  // Session info
  device_type?: string;
  browser?: string;
  os?: string;
  ip_address?: string;
}

export async function POST(req: NextRequest) {
  // Support Authorization header
  const authHeader = req.headers.get("authorization");
  let accessToken: string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    accessToken = authHeader.slice(7);
  }

  let body: ValidateRequest = {};

  try {
    body = await req.json();
  } catch {
    // Body is optional
  }

  // Use token from header or body
  const token = accessToken || body.access_token;

  if (!token) {
    return NextResponse.json(
      { active: false },
      { status: 200 }
    );
  }

  try {
    // Validate the JWT
    const payload = await validateAccessToken(token);

    if (!payload) {
      return NextResponse.json(
        { active: false },
        { status: 200 }
      );
    }

    // Validate session is still active
    const session = await validateSession(payload.session_id);

    if (!session) {
      return NextResponse.json(
        { active: false, reason: "Session expired or revoked" },
        { status: 200 }
      );
    }

    // Build token info response (RFC 7662 compliant)
    const tokenInfo: TokenInfo = {
      active: true,
      token_type: "Bearer",
      client_id: payload.client_id,
      username: payload.email,
      sub: payload.sub,
      tenant_id: payload.tenant_id,
      session_id: payload.session_id,
      email: payload.email,
      role: payload.role,
      exp: payload.exp,
      iat: payload.iat,
      jti: payload.jti,
      // Session device info
      device_type: session.device_type,
      browser: session.browser,
      os: session.os,
      ip_address: session.ip_address,
    };

    return NextResponse.json(tokenInfo);
  } catch (error) {
    console.error("Token validation error:", error);
    return NextResponse.json(
      { active: false },
      { status: 200 }
    );
  }
}

/**
 * GET /api/auth/validate
 *
 * Validates token and returns full user profile from session.
 * Used by client apps to get authenticated user info.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { authenticated: false },
      { status: 200 }
    );
  }

  const token = authHeader.slice(7);

  try {
    const payload = await validateAccessToken(token);

    if (!payload) {
      return NextResponse.json(
        { authenticated: false },
        { status: 200 }
      );
    }

    // Validate session and get full session data
    const session = await validateSession(payload.session_id);

    if (!session) {
      return NextResponse.json(
        { authenticated: false },
        { status: 200 }
      );
    }

    // Return full user profile from session if available
    const user = session.vinc_profile ? {
      id: session.vinc_profile.id,
      email: session.vinc_profile.email,
      name: session.vinc_profile.name,
      role: session.vinc_profile.role,
      supplier_id: session.vinc_profile.supplier_id,
      supplier_name: session.vinc_profile.supplier_name,
      customers: session.vinc_profile.customers,
      has_password: session.vinc_profile.has_password,
    } : {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    return NextResponse.json({
      authenticated: true,
      user,
      tenant_id: payload.tenant_id,
      session_id: payload.session_id,
      expires_at: new Date(payload.exp * 1000).toISOString(),
    });
  } catch {
    return NextResponse.json(
      { authenticated: false },
      { status: 200 }
    );
  }
}
