/**
 * Portal User Login API
 *
 * POST /api/b2b/auth/portal-login
 *
 * Authenticates a portal user with username/password.
 * Requires valid API key authentication (app-level auth).
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import { generatePortalUserToken } from "@/lib/auth/portal-user-token";
import { connectWithModels } from "@/lib/db/connection";
import {
  checkRateLimit,
  checkGlobalIPRateLimit,
  logLoginAttempt,
  applyProgressiveDelay,
} from "@/lib/sso/rate-limit";
import { getClientIP } from "@/lib/sso/device";
import type { PortalUserSafe } from "@/lib/types/portal-user";

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);

  try {
    // 1. Verify API key (app-level authentication)
    const apiKeyResult = await verifyAPIKeyFromRequest(req);
    if (!apiKeyResult.authenticated) {
      return NextResponse.json(
        { error: apiKeyResult.error || "API key authentication required" },
        { status: apiKeyResult.statusCode || 401 }
      );
    }

    const tenantId = apiKeyResult.tenantId!;
    const tenantDb = apiKeyResult.tenantDb!;

    // 2. Parse request body
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const identifier = username.toLowerCase().trim();

    // 3. Rate limiting: global IP check
    const globalCheck = await checkGlobalIPRateLimit(ip);
    if (!globalCheck.allowed) {
      return NextResponse.json(
        { error: globalCheck.reason },
        { status: 429 }
      );
    }

    // 4. Rate limiting: per-user/IP check
    const rateCheck = await checkRateLimit(identifier, ip, tenantId);
    if (!rateCheck.allowed) {
      await logLoginAttempt(identifier, ip, tenantId, false, "rate_limited");
      return NextResponse.json(
        { error: rateCheck.reason, lockout_until: rateCheck.lockout_until },
        { status: 429 }
      );
    }

    // 5. Apply progressive delay if needed
    if (rateCheck.delay_ms) {
      await applyProgressiveDelay(rateCheck.delay_ms);
    }

    // 6. Connect to tenant database and get models
    const { PortalUser: PortalUserModel, Customer: CustomerModel } = await connectWithModels(tenantDb);

    // 7. Find portal user by username
    const user = await PortalUserModel.findOne({
      tenant_id: tenantId,
      username: identifier,
      is_active: true,
    });

    if (!user) {
      await logLoginAttempt(identifier, ip, tenantId, false, "invalid_credentials");
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // 8. Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      await logLoginAttempt(identifier, ip, tenantId, false, "invalid_credentials");
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // 9. Log successful attempt
    await logLoginAttempt(identifier, ip, tenantId, true);

    // 10. Update last login timestamp (non-blocking)
    PortalUserModel.updateOne(
      { _id: user._id },
      { $set: { last_login_at: new Date() } }
    ).catch(console.error);

    // 11. Fetch customer data for JWT tags + enriched response
    const customerIds = (user.customer_access || []).map((ca: any) => ca.customer_id);
    let customerTags: string[] = [];
    const enrichedCustomerAccess: Array<{
      customer_id: string;
      customer_code: string | undefined;
      address_access: "all" | string[];
      default_address_code: string | undefined;
      delivery_addresses: Array<{
        address_id: string;
        external_code: string | undefined;
        label: string | undefined;
        address_type: string;
        is_default: boolean;
      }>;
    }> = [];

    if (customerIds.length) {
      const customers = await CustomerModel.find(
        { customer_id: { $in: customerIds } },
        { customer_id: 1, external_code: 1, tags: 1, addresses: 1 }
      ).lean();

      // Build customer lookup by customer_id
      const customerMap = new Map(
        customers.map((c: any) => [c.customer_id, c])
      );

      // Extract tags for JWT
      customerTags = [...new Set(
        customers.flatMap((c: any) => (c.tags || []).map((t: any) => t.full_tag)).filter(Boolean)
      )];

      // Build enriched customer_access with delivery addresses
      for (const ca of user.customer_access || []) {
        const customer = customerMap.get(ca.customer_id);
        if (!customer) continue;

        const allAddresses: any[] = (customer as any).addresses || [];
        // Filter to delivery-capable addresses only
        const deliveryAddresses = allAddresses.filter(
          (a: any) => a.address_type === "delivery" || a.address_type === "both"
        );

        // Apply address_access restriction
        const accessibleAddresses = ca.address_access === "all"
          ? deliveryAddresses
          : deliveryAddresses.filter((a: any) =>
              (ca.address_access as string[]).includes(a.address_id)
            );

        const defaultAddr = accessibleAddresses.find((a: any) => a.is_default);

        enrichedCustomerAccess.push({
          customer_id: ca.customer_id,
          customer_code: (customer as any).external_code,
          address_access: ca.address_access,
          default_address_code: defaultAddr?.external_code,
          delivery_addresses: accessibleAddresses.map((a: any) => ({
            address_id: a.address_id,
            external_code: a.external_code,
            label: a.label,
            address_type: a.address_type,
            is_default: a.is_default,
          })),
        });
      }
    }

    // 12. Generate JWT token (with customer tags)
    const token = await generatePortalUserToken(user.portal_user_id, tenantId, customerTags);

    // 13. Return token and user info (without password_hash)
    const portalUser: PortalUserSafe = {
      portal_user_id: user.portal_user_id,
      tenant_id: user.tenant_id,
      username: user.username,
      email: user.email,
      customer_access: user.customer_access,
      is_active: user.is_active,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };

    return NextResponse.json({
      token,
      portal_user: portalUser,
      customer_access: enrichedCustomerAccess,
      customer_tags: customerTags,
    });
  } catch (error) {
    console.error("Portal login error:", error);
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}
