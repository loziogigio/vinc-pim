/**
 * Departure Detail API — Get, Update, Delete
 *
 * GET    /api/b2b/departures/[id] — get single departure
 * PATCH  /api/b2b/departures/[id] — update departure
 * DELETE /api/b2b/departures/[id] — delete draft departure
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import {
  getDeparture,
  updateDeparture,
  deleteDeparture,
} from "@/lib/services/booking.service";
import type { UpdateDepartureRequest } from "@/lib/types/booking";

async function authenticate(req: NextRequest) {
  const authMethod = req.headers.get("x-auth-method");

  if (authMethod === "api-key") {
    const result = await verifyAPIKeyFromRequest(req, "departures");
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
    const result = await getDeparture(auth.tenantDb, auth.tenantId, id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }

    return NextResponse.json({ success: true, departure: result.data });
  } catch (error) {
    console.error("GET /api/b2b/departures/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticate(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const body = (await req.json()) as UpdateDepartureRequest;

    const result = await updateDeparture(auth.tenantDb, auth.tenantId, id, body);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }

    return NextResponse.json({ success: true, departure: result.data });
  } catch (error) {
    console.error("PATCH /api/b2b/departures/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticate(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const result = await deleteDeparture(auth.tenantDb, auth.tenantId, id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }

    return NextResponse.json({ success: true, message: "Departure deleted" });
  } catch (error) {
    console.error("DELETE /api/b2b/departures/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
