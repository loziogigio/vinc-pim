/**
 * SSO Token Refresh API
 *
 * POST /api/auth/refresh
 *
 * Refreshes an access token using a refresh token.
 * Implements token rotation for security.
 */

import { NextRequest, NextResponse } from "next/server";
import { refreshTokens } from "@/lib/sso/tokens";

interface RefreshRequest {
  refresh_token: string;
  client_id: string;
}

export async function POST(req: NextRequest) {
  // Support both JSON and form-urlencoded
  const contentType = req.headers.get("content-type") || "";
  let body: RefreshRequest;

  try {
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      body = {
        refresh_token: formData.get("refresh_token") as string,
        client_id: formData.get("client_id") as string,
      };
    } else {
      body = await req.json();
    }
  } catch {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Invalid request body" },
      { status: 400 }
    );
  }

  const { refresh_token, client_id } = body;

  // Validate required fields
  if (!refresh_token) {
    return NextResponse.json(
      {
        error: "invalid_request",
        error_description: "refresh_token is required",
      },
      { status: 400 }
    );
  }

  if (!client_id) {
    return NextResponse.json(
      {
        error: "invalid_request",
        error_description: "client_id is required",
      },
      { status: 400 }
    );
  }

  try {
    // Attempt to refresh tokens
    const result = await refreshTokens(refresh_token, client_id);

    if (!result.success || !result.tokens) {
      return NextResponse.json(
        {
          error: "invalid_grant",
          error_description: result.error || "Invalid refresh token",
        },
        { status: 401 }
      );
    }

    // Return new tokens
    return NextResponse.json({
      access_token: result.tokens.access_token,
      token_type: result.tokens.token_type,
      expires_in: result.tokens.expires_in,
      refresh_token: result.tokens.refresh_token,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      {
        error: "server_error",
        error_description: "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
