/**
 * Booking Detail API — Get
 *
 * GET /api/b2b/bookings/[id] — get single booking
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import { getBooking } from "@/lib/services/booking.service";

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticate(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const result = await getBooking(auth.tenantDb, auth.tenantId, id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }

    return NextResponse.json({ success: true, booking: result.data });
  } catch (error) {
    console.error("GET /api/b2b/bookings/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
