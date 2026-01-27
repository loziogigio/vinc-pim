/**
 * Admin Stats API
 *
 * Returns security statistics for the admin dashboard.
 */

import { NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { getSSOSessionModel } from "@/lib/db/models/sso-session";
import { getLoginAttemptModel } from "@/lib/db/models/sso-login-attempt";
import { getBlockedIPModel } from "@/lib/db/models/sso-blocked-ip";

export async function GET() {
  try {
    const session = await getB2BSession();

    if (!session.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.tenantId;

    // Get models (they all use vinc-admin database)
    const [SSOSession, LoginAttempt, BlockedIP] = await Promise.all([
      getSSOSessionModel(),
      getLoginAttemptModel(),
      getBlockedIPModel(),
    ]);

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Run all queries in parallel
    const [activeSessions, failedLogins24h, blockedIPs] = await Promise.all([
      // Active sessions for this tenant
      SSOSession.find({
        tenant_id: tenantId,
        is_active: true,
        expires_at: { $gt: now },
      }).lean(),

      // Failed login attempts in last 24 hours
      LoginAttempt.countDocuments({
        tenant_id: tenantId,
        success: false,
        timestamp: { $gte: yesterday },
      }),

      // Blocked IPs (global + tenant-specific)
      BlockedIP.countDocuments({
        is_active: true,
        $or: [{ tenant_id: tenantId }, { is_global: true }],
        $and: [
          {
            $or: [
              { expires_at: { $exists: false } },
              { expires_at: null },
              { expires_at: { $gt: now } },
            ],
          },
        ],
      }),
    ]);

    // Calculate unique users from active sessions
    const uniqueUsers = new Set(activeSessions.map((s) => s.user_id)).size;

    return NextResponse.json({
      active_sessions: activeSessions.length,
      unique_users: uniqueUsers,
      failed_logins_24h: failedLogins24h,
      blocked_ips: blockedIPs,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin stats" },
      { status: 500 }
    );
  }
}
