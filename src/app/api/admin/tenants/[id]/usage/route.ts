/**
 * GET /api/admin/tenants/[id]/usage
 * Returns API usage statistics for a tenant
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/auth/admin-auth";
import { getUsageStats } from "@/lib/services/api-usage.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify super admin authentication
    const auth = await verifyAdminAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const stats = await getUsageStats(id);

    return NextResponse.json({
      success: true,
      usage: stats,
    });
  } catch (error: unknown) {
    console.error("[Admin] Error fetching usage stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage stats" },
      { status: 500 }
    );
  }
}
