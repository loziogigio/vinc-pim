/**
 * POST /api/b2b/bookings/[id]/no-show — Transition confirmed → no_show
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { noShowBooking } from "@/lib/services/booking.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { id } = await params;
    const { tenantDb, tenantId } = auth;
    const result = await noShowBooking(tenantDb, tenantId, id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status || 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error: unknown) {
    console.error("[bookings/no-show] Error:", error);
    return NextResponse.json(
      { error: "No-show failed", details: (error as Error).message },
      { status: 500 }
    );
  }
}
