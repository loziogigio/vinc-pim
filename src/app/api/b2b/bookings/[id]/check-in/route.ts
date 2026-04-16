/**
 * POST /api/b2b/bookings/[id]/check-in — Transition confirmed → checked_in
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { checkInBooking } from "@/lib/services/booking.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { id } = await params;
    const { tenantDb, tenantId } = auth;
    const result = await checkInBooking(tenantDb, tenantId, id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status || 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error: unknown) {
    console.error("[bookings/check-in] Error:", error);
    return NextResponse.json(
      { error: "Check-in failed", details: (error as Error).message },
      { status: 500 }
    );
  }
}
