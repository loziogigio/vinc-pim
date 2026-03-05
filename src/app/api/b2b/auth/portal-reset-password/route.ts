/**
 * Portal User Forgot-Password API
 *
 * POST /api/b2b/auth/portal-reset-password
 *
 * Generates a temporary password for a portal user and returns it.
 * The caller is responsible for sending the notification email.
 *
 * Auth: API key only (no portal user token — user is locked out).
 * Channel-aware: portal users are unique per (tenant_id, email, channel).
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import { connectWithModels } from "@/lib/db/connection";
import { DEFAULT_CHANNEL } from "@/lib/constants/channel";
import { generateSecurePassword } from "@/lib/utils/password";
import {
  checkRateLimit,
  checkGlobalIPRateLimit,
  logLoginAttempt,
  applyProgressiveDelay,
} from "@/lib/sso/rate-limit";
import { getClientIP } from "@/lib/sso/device";

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
    let body: { email?: string; channel?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { email, channel } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase().trim();
    const resolvedChannel = channel || DEFAULT_CHANNEL;

    // 3. Rate limiting: global IP check
    const globalCheck = await checkGlobalIPRateLimit(ip);
    if (!globalCheck.allowed) {
      return NextResponse.json(
        { error: globalCheck.reason },
        { status: 429 }
      );
    }

    // 4. Rate limiting: per-user/IP check
    const rateCheck = await checkRateLimit(emailLower, ip, tenantId);
    if (!rateCheck.allowed) {
      await logLoginAttempt(emailLower, ip, tenantId, false, "rate_limited");
      return NextResponse.json(
        { error: rateCheck.reason, lockout_until: rateCheck.lockout_until },
        { status: 429 }
      );
    }

    // 5. Apply progressive delay if needed
    if (rateCheck.delay_ms) {
      await applyProgressiveDelay(rateCheck.delay_ms);
    }

    // 6. Connect to tenant database
    const { PortalUser: PortalUserModel } = await connectWithModels(tenantDb);

    // 7. Find portal user by email — prefer channel-specific match, fallback any
    const baseQuery = { tenant_id: tenantId, email: emailLower };
    let user = channel
      ? await PortalUserModel.findOne({ ...baseQuery, channel: resolvedChannel })
      : null;
    if (!user) {
      user = await PortalUserModel.findOne(baseQuery);
    }

    // 8. User not found or inactive — generic response (prevent enumeration)
    if (!user || !user.is_active) {
      await logLoginAttempt(emailLower, ip, tenantId, false, "user_not_found");
      return NextResponse.json({
        success: true,
        message: "If the email exists, a password reset has been processed",
      });
    }

    // 9. Generate temp password, hash, and update
    const tempPassword = generateSecurePassword(12);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await PortalUserModel.updateOne(
      { _id: user._id },
      { $set: { password_hash: passwordHash } }
    );

    // 10. Log successful reset
    await logLoginAttempt(emailLower, ip, tenantId, true);

    // 11. Return temp password to caller (caller sends the email)
    return NextResponse.json({
      success: true,
      temporary_password: tempPassword,
      portal_user_id: user.portal_user_id,
      email: user.email,
      channel: user.channel,
    });
  } catch (error) {
    console.error("[portal-reset-password] Error:", error);
    return NextResponse.json(
      { error: "Password reset failed" },
      { status: 500 }
    );
  }
}
