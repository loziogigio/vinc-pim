/**
 * Cancel Booking API
 *
 * POST /api/b2b/bookings/[id]/cancel — cancel booking and return capacity
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import { cancelBooking } from "@/lib/services/booking.service";
import type { CancelBookingRequest } from "@/lib/types/booking";

async function authenticate(req: NextRequest) {
  const authMethod = req.headers.get("x-auth-method");

  if (authMethod === "api-key") {
    const result = await verifyAPIKeyFromRequest(req, "bookings");
    if (!result.authenticated) {
      return { error: result.error || "Unauthorized", status: result.statusCode || 401 };
    }
    return { tenantId: result.tenantId!, tenantDb: result.tenantDb! };
  }

  const session = await getB2BSession();
  if (!session?.isLoggedIn || !session.tenantId) {
    return { error: "Unauthorized", status: 401 };
  }
  return { tenantId: session.tenantId, tenantDb: `vinc-${session.tenantId}` };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticate(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as CancelBookingRequest;

    // Use session user or "api" as the canceller
    const cancelledBy = auth.tenantId; // Could be refined with user ID

    const result = await cancelBooking(
      auth.tenantDb,
      auth.tenantId,
      id,
      cancelledBy,
      body.reason
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }

    return NextResponse.json({ success: true, booking: result.data });
  } catch (error) {
    console.error("POST /api/b2b/bookings/[id]/cancel error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
