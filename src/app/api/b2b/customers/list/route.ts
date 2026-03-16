/**
 * Customer List API
 *
 * GET /api/b2b/customers/list - List portal customers for notification recipients
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

    const tenantDb = `vinc-${session.tenantId}`;
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));
    const skip = (page - 1) * limit;

    const { Customer } = await connectWithModels(tenantDb);

    // Build query
    const query: Record<string, unknown> = { status: "active" };

    if (search) {
      const safeSearch = safeRegexQuery(search);
      query.$or = [
        { email: safeSearch },
        { company_name: safeSearch },
        { first_name: safeSearch },
        { last_name: safeSearch },
      ];
    }

    const [customers, total] = await Promise.all([
      Customer.find(query)
        .select("_id email company_name first_name last_name")
        .skip(skip)
        .limit(limit)
        .sort({ company_name: 1, email: 1 })
        .lean(),
      Customer.countDocuments(query),
    ]);

    // Format for user selector
    const users = customers.map((c: {
      _id: string;
      email: string;
      company_name?: string;
      first_name?: string;
      last_name?: string;
    }) => ({
      id: c._id.toString(),
      email: c.email,
      name: c.company_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.email,
      type: "portal" as const,
    }));

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error listing customers:", error);
    return NextResponse.json(
      { error: "Failed to list customers" },
      { status: 500 }
    );
  }
}
