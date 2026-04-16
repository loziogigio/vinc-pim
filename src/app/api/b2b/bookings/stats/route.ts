/**
 * GET /api/b2b/bookings/stats — Aggregated booking & departure stats
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getBookingStats } from "@/lib/services/booking.service";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb, tenantId } = auth;
    const result = await getBookingStats(tenantDb, tenantId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }

    return NextResponse.json({ success: true, stats: result.data });
  } catch (error: unknown) {
    console.error("[bookings/stats] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats", details: (error as Error).message },
      { status: 500 }
    );
  }
}
