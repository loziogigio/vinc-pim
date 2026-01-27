/**
 * Admin Login Attempts API
 *
 * List login attempt history for the tenant.
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { getLoginAttemptModel } from "@/lib/db/models/sso-login-attempt";

export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();

    if (!session.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status"); // "success" | "failed" | null (all)
    const skip = (page - 1) * limit;

    const LoginAttempt = await getLoginAttemptModel();

    const query: Record<string, unknown> = {
      tenant_id: session.tenantId,
    };

    // Filter by status
    if (status === "success") {
      query.success = true;
    } else if (status === "failed") {
      query.success = false;
    }

    // Search by email or IP
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: "i" } },
        { ip_address: { $regex: search, $options: "i" } },
      ];
    }

    const [attempts, total] = await Promise.all([
      LoginAttempt.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LoginAttempt.countDocuments(query),
    ]);

    // Map attempts to response format
    const items = attempts.map((a) => ({
      _id: a._id.toString(),
      email: a.email,
      ip_address: a.ip_address,
      success: a.success,
      failure_reason: a.failure_reason,
      device_type: a.device_type,
      browser: a.browser,
      os: a.os,
      country: a.country,
      city: a.city,
      client_id: a.client_id,
      timestamp: a.timestamp,
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
    console.error("Login attempts list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch login attempts" },
      { status: 500 }
    );
  }
}
