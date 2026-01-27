/**
 * Admin Sessions API
 *
 * List and manage active sessions for the tenant.
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { getSSOSessionModel } from "@/lib/db/models/sso-session";

export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();

    if (!session.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const skip = (page - 1) * limit;

    const SSOSession = await getSSOSessionModel();

    const now = new Date();
    const query: Record<string, unknown> = {
      tenant_id: session.tenantId,
      is_active: true,
      expires_at: { $gt: now },
    };

    // Search by email
    if (search) {
      query.user_email = { $regex: search, $options: "i" };
    }

    const [sessions, total] = await Promise.all([
      SSOSession.find(query)
        .sort({ last_activity: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SSOSession.countDocuments(query),
    ]);

    // Map sessions to safe response format
    const items = sessions.map((s) => ({
      session_id: s.session_id,
      user_email: s.user_email,
      user_role: s.user_role,
      company_name: s.company_name,
      client_app: s.client_app,
      device_type: s.device_type,
      browser: s.browser,
      os: s.os,
      ip_address: s.ip_address,
      country: s.country,
      city: s.city,
      last_activity: s.last_activity,
      created_at: s.created_at,
      expires_at: s.expires_at,
    }));

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Sessions list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}
