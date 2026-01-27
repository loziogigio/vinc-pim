/**
 * Admin Security Config API
 *
 * Get and update tenant security settings.
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { getTenantSecurityConfigModel, DEFAULT_SECURITY_CONFIG } from "@/lib/db/models/sso-tenant-security";

export async function GET() {
  try {
    const session = await getB2BSession();

    if (!session.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const TenantSecurityConfig = await getTenantSecurityConfigModel();
    const config = await TenantSecurityConfig.getOrCreateDefault(session.tenantId);

    return NextResponse.json({
      tenant_id: config.tenant_id,
      // Session limits
      max_sessions_per_user: config.max_sessions_per_user,
      session_timeout_hours: config.session_timeout_hours,
      // Login protection
      max_login_attempts: config.max_login_attempts,
      lockout_minutes: config.lockout_minutes,
      enable_progressive_delay: config.enable_progressive_delay,
      // Password policy
      require_strong_password: config.require_strong_password,
      password_expiry_days: config.password_expiry_days,
      // Notifications
      notify_on_new_device: config.notify_on_new_device,
      notify_on_suspicious_login: config.notify_on_suspicious_login,
      notify_on_password_change: config.notify_on_password_change,
      alert_email: config.alert_email,
      // Timestamps
      created_at: config.created_at,
      updated_at: config.updated_at,
    });
  } catch (error) {
    console.error("Security config GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch security config" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getB2BSession();

    if (!session.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Validate fields
    const allowedFields = [
      "max_sessions_per_user",
      "session_timeout_hours",
      "max_login_attempts",
      "lockout_minutes",
      "enable_progressive_delay",
      "require_strong_password",
      "password_expiry_days",
      "notify_on_new_device",
      "notify_on_suspicious_login",
      "notify_on_password_change",
      "alert_email",
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Validate numeric fields
    if (updateData.max_sessions_per_user !== undefined) {
      const val = Number(updateData.max_sessions_per_user);
      if (isNaN(val) || val < 1 || val > 100) {
        return NextResponse.json(
          { error: "max_sessions_per_user deve essere tra 1 e 100" },
          { status: 400 }
        );
      }
      updateData.max_sessions_per_user = val;
    }

    if (updateData.session_timeout_hours !== undefined) {
      const val = Number(updateData.session_timeout_hours);
      if (isNaN(val) || val < 1 || val > 720) {
        return NextResponse.json(
          { error: "session_timeout_hours deve essere tra 1 e 720 (30 giorni)" },
          { status: 400 }
        );
      }
      updateData.session_timeout_hours = val;
    }

    if (updateData.max_login_attempts !== undefined) {
      const val = Number(updateData.max_login_attempts);
      if (isNaN(val) || val < 1 || val > 20) {
        return NextResponse.json(
          { error: "max_login_attempts deve essere tra 1 e 20" },
          { status: 400 }
        );
      }
      updateData.max_login_attempts = val;
    }

    if (updateData.lockout_minutes !== undefined) {
      const val = Number(updateData.lockout_minutes);
      if (isNaN(val) || val < 1 || val > 1440) {
        return NextResponse.json(
          { error: "lockout_minutes deve essere tra 1 e 1440 (24 ore)" },
          { status: 400 }
        );
      }
      updateData.lockout_minutes = val;
    }

    if (updateData.password_expiry_days !== undefined && updateData.password_expiry_days !== null) {
      const val = Number(updateData.password_expiry_days);
      if (isNaN(val) || val < 0 || val > 365) {
        return NextResponse.json(
          { error: "password_expiry_days deve essere tra 0 e 365" },
          { status: 400 }
        );
      }
      updateData.password_expiry_days = val === 0 ? undefined : val;
    }

    // Validate email format
    if (updateData.alert_email && typeof updateData.alert_email === "string") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updateData.alert_email)) {
        return NextResponse.json(
          { error: "Formato email non valido" },
          { status: 400 }
        );
      }
    }

    const TenantSecurityConfig = await getTenantSecurityConfigModel();

    const config = await TenantSecurityConfig.findOneAndUpdate(
      { tenant_id: session.tenantId },
      { $set: updateData },
      { new: true, upsert: true }
    );

    return NextResponse.json({
      success: true,
      config: {
        tenant_id: config.tenant_id,
        max_sessions_per_user: config.max_sessions_per_user,
        session_timeout_hours: config.session_timeout_hours,
        max_login_attempts: config.max_login_attempts,
        lockout_minutes: config.lockout_minutes,
        enable_progressive_delay: config.enable_progressive_delay,
        require_strong_password: config.require_strong_password,
        password_expiry_days: config.password_expiry_days,
        notify_on_new_device: config.notify_on_new_device,
        notify_on_suspicious_login: config.notify_on_suspicious_login,
        notify_on_password_change: config.notify_on_password_change,
        alert_email: config.alert_email,
        updated_at: config.updated_at,
      },
    });
  } catch (error) {
    console.error("Security config PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update security config" },
      { status: 500 }
    );
  }
}
