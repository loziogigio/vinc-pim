/**
 * SSO Token API
 *
 * POST /api/auth/token
 *
 * Exchanges an authorization code for access and refresh tokens.
 * This is the OAuth 2.0 token endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { exchangeAuthCode, validateClientCredentials } from "@/lib/sso/oauth";
import { createSession } from "@/lib/sso/session";
import { getClientIP, parseUserAgent } from "@/lib/sso/device";
import type { ClientApp } from "@/lib/db/models/sso-session";

interface TokenRequest {
  grant_type: "authorization_code";
  code: string;
  client_id: string;
  client_secret?: string;
  redirect_uri: string;
  code_verifier?: string; // PKCE
}

export async function POST(req: NextRequest) {
  console.log("[Token] POST /api/auth/token called");

  const ip = getClientIP(req);
  const userAgent = req.headers.get("user-agent") || undefined;
  const acceptLanguage = req.headers.get("accept-language") || undefined;

  // Support both JSON and form-urlencoded
  const contentType = req.headers.get("content-type") || "";
  console.log("[Token] Content-Type:", contentType);
  let body: TokenRequest;

  try {
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      body = {
        grant_type: formData.get("grant_type") as "authorization_code",
        code: formData.get("code") as string,
        client_id: formData.get("client_id") as string,
        client_secret: formData.get("client_secret") as string | undefined,
        redirect_uri: formData.get("redirect_uri") as string,
        code_verifier: formData.get("code_verifier") as string | undefined,
      };
    } else {
      body = await req.json();
    }
  } catch (parseError) {
    console.error("[Token] Parse error:", parseError);
    return NextResponse.json(
      { error: "invalid_request", error_description: "Invalid request body" },
      { status: 400 }
    );
  }

  const {
    grant_type,
    code,
    client_id,
    client_secret,
    redirect_uri,
    code_verifier,
  } = body;

  console.log("[Token] Request:", { grant_type, client_id, redirect_uri, hasCode: !!code });

  // Validate grant type
  if (grant_type !== "authorization_code") {
    return NextResponse.json(
      {
        error: "unsupported_grant_type",
        error_description: "Only authorization_code grant is supported",
      },
      { status: 400 }
    );
  }

  // Validate required fields
  if (!code || !client_id || !redirect_uri) {
    return NextResponse.json(
      {
        error: "invalid_request",
        error_description: "Missing required parameters: code, client_id, redirect_uri",
      },
      { status: 400 }
    );
  }

  try {
    // Validate client credentials if provided (confidential clients)
    if (client_secret) {
      const client = await validateClientCredentials(client_id, client_secret);
      if (!client) {
        return NextResponse.json(
          {
            error: "invalid_client",
            error_description: "Invalid client credentials",
          },
          { status: 401 }
        );
      }
    }

    // Exchange authorization code
    const result = await exchangeAuthCode(code, client_id, redirect_uri, code_verifier);

    if (!result.success || !result.data) {
      return NextResponse.json(
        {
          error: "invalid_grant",
          error_description: result.error || "Invalid authorization code",
        },
        { status: 400 }
      );
    }

    // Create session and get tokens
    const { user_id, user_email, user_role, tenant_id, vinc_profile } = result.data;

    // Get company name from profile if available
    const companyName = vinc_profile?.supplier_name ||
      vinc_profile?.customers?.[0]?.business_name ||
      vinc_profile?.name;

    const { session, tokens } = await createSession({
      tenant_id,
      user_id,
      user_email,
      user_role,
      company_name: companyName,
      // Store full profile in session for validate endpoint
      vinc_profile: vinc_profile ? {
        id: vinc_profile.id,
        email: vinc_profile.email,
        name: vinc_profile.name,
        role: vinc_profile.role,
        supplier_id: vinc_profile.supplier_id,
        supplier_name: vinc_profile.supplier_name,
        customers: vinc_profile.customers.map(c => ({
          id: c.id,
          erp_customer_id: c.erp_customer_id,
          name: c.name,
          business_name: c.business_name,
          addresses: c.addresses.map(a => ({
            id: a.id,
            erp_address_id: a.erp_address_id,
            label: a.label,
            pricelist_code: a.pricelist_code,
          })),
        })),
        has_password: vinc_profile.has_password,
      } : undefined,
      client_app: client_id as ClientApp,
      ip_address: ip,
      user_agent: userAgent,
      accept_language: acceptLanguage,
    });

    // Return OAuth 2.0 token response with full profile
    return NextResponse.json({
      access_token: tokens.access_token,
      token_type: tokens.token_type,
      expires_in: tokens.expires_in,
      refresh_token: tokens.refresh_token,
      scope: "openid profile email",
      // Full user info from VINC API
      user: vinc_profile ? {
        id: vinc_profile.id,
        email: vinc_profile.email,
        name: vinc_profile.name,
        role: vinc_profile.role,
        supplier_id: vinc_profile.supplier_id,
        supplier_name: vinc_profile.supplier_name,
        customers: vinc_profile.customers,
        has_password: vinc_profile.has_password,
      } : {
        id: user_id,
        email: user_email,
        role: user_role,
      },
      tenant_id,
      session_id: session.session_id,
    });
  } catch (error) {
    console.error("Token exchange error:", error);
    return NextResponse.json(
      {
        error: "server_error",
        error_description: "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
