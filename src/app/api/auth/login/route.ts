/**
 * SSO Login API
 *
 * POST /api/auth/login
 *
 * Validates user credentials via VINC API and either:
 * 1. Returns tokens directly (for simple login)
 * 2. Returns an authorization code (for OAuth flow)
 *
 * Authentication is delegated to the VINC API service.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  checkGlobalIPRateLimit,
  logLoginAttempt,
  applyProgressiveDelay,
} from "@/lib/sso/rate-limit";
import { getClientIP, parseUserAgent } from "@/lib/sso/device";
import { createSession } from "@/lib/sso/session";
import { createAuthCode, validateClientForTenant } from "@/lib/sso/oauth";
import { getVincApiForTenant, VincApiError } from "@/lib/vinc-api";
import type { ClientApp } from "@/lib/db/models/sso-session";

interface LoginRequest {
  // Credentials
  email?: string;
  username?: string;
  password: string;

  // Tenant identification
  tenant_id: string;

  // OAuth parameters (optional)
  client_id?: string;
  redirect_uri?: string;
  state?: string;
  response_type?: "code" | "token"; // code = OAuth, token = direct

  // PKCE (optional)
  code_challenge?: string;
  code_challenge_method?: "plain" | "S256";
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  const userAgent = req.headers.get("user-agent") || undefined;
  const acceptLanguage = req.headers.get("accept-language") || undefined;
  const deviceInfo = parseUserAgent(userAgent || null);

  let body: LoginRequest;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const {
    email,
    username,
    password,
    tenant_id,
    client_id,
    redirect_uri,
    state,
    response_type = "token", // Default to direct token response
    code_challenge,
    code_challenge_method,
  } = body;

  // Validate required fields
  if (!password) {
    return NextResponse.json(
      { error: "Password is required" },
      { status: 400 }
    );
  }

  if (!email && !username) {
    return NextResponse.json(
      { error: "Email or username is required" },
      { status: 400 }
    );
  }

  if (!tenant_id) {
    return NextResponse.json(
      { error: "Tenant ID is required" },
      { status: 400 }
    );
  }

  // OAuth flow validation
  if (response_type === "code") {
    if (!client_id || !redirect_uri) {
      return NextResponse.json(
        { error: "client_id and redirect_uri are required for OAuth flow" },
        { status: 400 }
      );
    }
  }

  const identifier = (email || username)!.toLowerCase().trim();

  try {
    // 1. Check global IP rate limit (DDoS protection)
    const globalCheck = await checkGlobalIPRateLimit(ip);
    if (!globalCheck.allowed) {
      return NextResponse.json(
        { error: globalCheck.reason },
        { status: 429 }
      );
    }

    // 2. Check rate limits (IP/email based)
    const rateCheck = await checkRateLimit(identifier, ip, tenant_id);

    if (!rateCheck.allowed) {
      await logLoginAttempt(
        identifier,
        ip,
        tenant_id,
        false,
        "rate_limited",
        deviceInfo,
        client_id
      );

      return NextResponse.json(
        {
          error: rateCheck.reason,
          lockout_until: rateCheck.lockout_until,
        },
        { status: 429 }
      );
    }

    // 3. Apply progressive delay if needed
    if (rateCheck.delay_ms) {
      await applyProgressiveDelay(rateCheck.delay_ms);
    }

    // 4. Validate OAuth client if using OAuth flow
    if (response_type === "code" && client_id && redirect_uri) {
      const client = await validateClientForTenant(client_id, redirect_uri, tenant_id);
      if (!client) {
        return NextResponse.json(
          { error: "Invalid client_id or redirect_uri" },
          { status: 400 }
        );
      }
    }

    // 5. Authenticate via VINC API
    const vincApi = getVincApiForTenant(tenant_id);

    let vincTokens;
    let profile;

    try {
      // Login to get tokens
      vincTokens = await vincApi.auth.login({
        email: identifier,
        password,
      });

      // Get user profile
      profile = await vincApi.auth.getProfile(vincTokens.access_token);
    } catch (error) {
      // Handle VINC API errors
      if (error instanceof VincApiError) {
        await logLoginAttempt(
          identifier,
          ip,
          tenant_id,
          false,
          error.status === 401 ? "invalid_credentials" : "vinc_api_error",
          deviceInfo,
          client_id
        );

        if (error.status === 401) {
          return NextResponse.json(
            {
              error: "Invalid credentials",
              attempts_remaining: rateCheck.attempts_remaining
                ? rateCheck.attempts_remaining - 1
                : undefined,
            },
            { status: 401 }
          );
        }

        console.error("VINC API error:", error.detail);
        return NextResponse.json(
          { error: "Authentication service error" },
          { status: 503 }
        );
      }

      throw error;
    }

    // 6. Log successful attempt
    await logLoginAttempt(
      identifier,
      ip,
      tenant_id,
      true,
      undefined,
      deviceInfo,
      client_id
    );

    // 7. Handle OAuth flow vs direct token
    if (response_type === "code" && client_id && redirect_uri) {
      // OAuth: Generate authorization code with full profile
      const code = await createAuthCode({
        client_id,
        tenant_id,
        user_id: profile.id,
        user_email: profile.email,
        user_role: profile.role,
        redirect_uri,
        state,
        code_challenge,
        code_challenge_method,
        // Include full VINC profile for token exchange
        vinc_profile: {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: profile.role,
          status: profile.status,
          supplier_id: profile.supplier_id,
          supplier_name: profile.supplier_name,
          customers: profile.customers || [],
          has_password: profile.has_password,
        },
      });

      // Return redirect info (client will redirect)
      return NextResponse.json({
        redirect_uri,
        code,
        state,
      });
    } else {
      // Direct: Create session and return tokens
      const clientApp: ClientApp =
        (client_id as ClientApp) || "vinc-commerce-suite";

      // Determine company name from profile
      const companyName =
        profile.supplier_name ||
        profile.customers?.[0]?.business_name ||
        profile.name;

      const { session, tokens } = await createSession({
        tenant_id,
        user_id: profile.id,
        user_email: profile.email,
        user_role: profile.role,
        company_name: companyName,
        client_app: clientApp,
        ip_address: ip,
        user_agent: userAgent,
        accept_language: acceptLanguage,
      });

      return NextResponse.json({
        ...tokens,
        user: {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: profile.role,
          supplier_id: profile.supplier_id,
          supplier_name: profile.supplier_name,
          customers: profile.customers,
          has_password: profile.has_password,
        },
        tenant_id,
        session_id: session.session_id,
        // Also return VINC API tokens for direct API calls if needed
        vinc_tokens: {
          access_token: vincTokens.access_token,
          refresh_token: vincTokens.refresh_token,
          expires_in: vincTokens.expires_in,
        },
      });
    }
  } catch (error) {
    console.error("Login error:", error);

    await logLoginAttempt(
      identifier,
      ip,
      tenant_id,
      false,
      "server_error",
      deviceInfo,
      client_id
    );

    return NextResponse.json(
      { error: "Login failed. Please try again." },
      { status: 500 }
    );
  }
}
