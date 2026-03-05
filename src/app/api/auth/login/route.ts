/**
 * SSO Login API
 *
 * POST /api/auth/login
 *
 * Authenticates a portal user with email/password (bcrypt) and either:
 * 1. Returns tokens directly (for simple login)
 * 2. Returns an authorization code (for OAuth flow)
 *
 * Credentials are verified against the portal-user collection (MongoDB).
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  checkRateLimit,
  checkGlobalIPRateLimit,
  logLoginAttempt,
  applyProgressiveDelay,
} from "@/lib/sso/rate-limit";
import { getClientIP, parseUserAgent } from "@/lib/sso/device";
import { createSession } from "@/lib/sso/session";
import { createAuthCode, validateClientForTenant } from "@/lib/sso/oauth";
import { connectWithModels } from "@/lib/db/connection";
import type { ClientApp } from "@/lib/db/models/sso-session";

interface LoginRequest {
  // Credentials
  email?: string;
  username?: string;
  password: string;

  // Tenant identification
  tenant_id: string;

  // Portal user channel (optional)
  channel?: string;

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
    channel,
    client_id,
    redirect_uri,
    state,
    response_type = "token",
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

    // 5. Authenticate against portal-user collection (bcrypt)
    const tenantDb = `vinc-${tenant_id}`;
    const { PortalUser: PortalUserModel, Customer: CustomerModel } =
      await connectWithModels(tenantDb);

    // Find portal user by email/username — prefer channel-specific match
    const baseQuery: Record<string, unknown> = {
      tenant_id,
      username: identifier,
      is_active: true,
    };
    let user = channel
      ? await PortalUserModel.findOne({ ...baseQuery, channel })
      : null;
    if (!user) {
      user = await PortalUserModel.findOne(baseQuery);
    }

    if (!user) {
      await logLoginAttempt(
        identifier, ip, tenant_id, false, "invalid_credentials",
        deviceInfo, client_id
      );
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

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      await logLoginAttempt(
        identifier, ip, tenant_id, false, "invalid_credentials",
        deviceInfo, client_id
      );
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

    // Update last login (non-blocking)
    PortalUserModel.updateOne(
      { _id: user._id },
      { $set: { last_login_at: new Date() } }
    ).catch(console.error);

    // 6. Build profile from portal user + Customer data
    const customerIds = (user.customer_access || []).map(
      (ca: any) => ca.customer_id
    );
    const customers = customerIds.length
      ? await CustomerModel.find(
          { customer_id: { $in: customerIds } },
          {
            customer_id: 1,
            external_code: 1,
            company_name: 1,
            first_name: 1,
            last_name: 1,
            addresses: 1,
          }
        ).lean()
      : [];

    const customerMap = new Map(
      customers.map((c: any) => [c.customer_id, c])
    );

    // Build backward-compatible profile
    const profileCustomers = (user.customer_access || [])
      .map((ca: any) => {
        const cust = customerMap.get(ca.customer_id);
        if (!cust) return null;
        return {
          id: ca.customer_id,
          erp_customer_id: (cust as any).external_code || ca.customer_id,
          name: (cust as any).company_name || `${(cust as any).first_name || ""} ${(cust as any).last_name || ""}`.trim() || undefined,
          business_name: (cust as any).company_name || undefined,
          addresses: ((cust as any).addresses || []).map((a: any) => ({
            id: a.address_id,
            erp_address_id: a.external_code || a.address_id,
            label: a.label || `${a.city || ""} (${a.province || ""})`.trim(),
            pricelist_code: undefined,
          })),
        };
      })
      .filter(Boolean);

    const firstCustomer = customers[0] as any;
    const companyName =
      firstCustomer?.company_name ||
      `${firstCustomer?.first_name || ""} ${firstCustomer?.last_name || ""}`.trim() ||
      user.email;

    const profile = {
      id: user.portal_user_id,
      email: user.email,
      name: companyName !== user.email ? companyName : null,
      role: "reseller" as const,
      status: "active" as const,
      supplier_id: null as string | null,
      supplier_name: null as string | null,
      customers: profileCustomers,
      has_password: true,
    };

    // 7. Log successful attempt
    await logLoginAttempt(
      identifier, ip, tenant_id, true, undefined, deviceInfo, client_id
    );

    // 8. Handle OAuth flow vs direct token
    if (response_type === "code" && client_id && redirect_uri) {
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
        vinc_profile: {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: profile.role,
          status: profile.status,
          supplier_id: profile.supplier_id,
          supplier_name: profile.supplier_name,
          customers: profile.customers,
          has_password: profile.has_password,
        },
      });

      return NextResponse.json({
        redirect_uri,
        code,
        state,
      });
    } else {
      // Direct: Create session and return tokens
      const clientApp: ClientApp =
        (client_id as ClientApp) || "vinc-commerce-suite";

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
