/**
 * B2B Users List API
 *
 * GET /api/b2b/users/list - List B2B users for notification recipients
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";

export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const { B2BUser } = await connectWithModels(tenantDb);

    // Build query
    const query: Record<string, unknown> = { isActive: true };

    if (search) {
      query.$or = [
        { email: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
        { companyName: { $regex: search, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      B2BUser.find(query)
        .select("_id email username companyName role")
        .skip(skip)
        .limit(limit)
        .sort({ companyName: 1, email: 1 })
        .lean(),
      B2BUser.countDocuments(query),
    ]);

    // Format for user selector
    const formattedUsers = users.map((u: {
      _id: string;
      email: string;
      username?: string;
      companyName?: string;
      role?: string;
    }) => ({
      id: u._id.toString(),
      email: u.email,
      name: u.companyName || u.username || u.email,
      role: u.role,
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
    console.error("Error listing B2B users:", error);
    return NextResponse.json(
      { error: "Failed to list B2B users" },
      { status: 500 }
    );
  }
}
