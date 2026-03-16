/**
 * B2B Users List API
 *
 * GET /api/b2b/users/list - List B2B users for notification recipients
 *
 * Fetches portal users from MongoDB (portalusers collection).
 * Returns user list with pagination and optional search filtering.
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { safeRegexQuery } from "@/lib/security";

export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));
    const skip = (page - 1) * limit;

    const tenantDb = `vinc-${session.tenantId}`;
    const { PortalUser: PortalUserModel } = await connectWithModels(tenantDb);

    // Build query
    const query: Record<string, unknown> = {
      tenant_id: session.tenantId,
      is_active: true,
    };

    if (search) {
      const safeSearch = safeRegexQuery(search);
      query.$or = [
        { email: safeSearch },
        { username: safeSearch },
      ];
    }

    // Fetch users with pagination
    const [users, total] = await Promise.all([
      PortalUserModel.find(query)
        .select("portal_user_id email username role")
        .sort({ email: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PortalUserModel.countDocuments(query),
    ]);

    // Format for UserSelector component
    const formattedUsers = users.map((u: any) => ({
      id: u.portal_user_id,
      email: u.email,
      name: u.username || u.email,
      role: u.role || "reseller",
      type: "b2b" as const,
    }));

    return NextResponse.json({
      users: formattedUsers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[b2b/users/list] Error:", error);

    return NextResponse.json(
      { error: "Failed to list B2B users" },
      { status: 500 }
    );
  }
}
