/**
 * Bookings API — List & Hold
 *
 * GET  /api/b2b/bookings — list bookings (paginated, filterable)
 * POST /api/b2b/bookings — create a held booking (atomic capacity reservation)
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import {
  holdBooking,
  listBookings,
} from "@/lib/services/booking.service";
import type { CreateBookingRequest, BookingListFilters } from "@/lib/types/booking";

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

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticate(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(req.url);
    const filters: BookingListFilters = {
      departure_id: searchParams.get("departure_id") || undefined,
      customer_id: searchParams.get("customer_id") || undefined,
      status: (searchParams.get("status") as BookingListFilters["status"]) || undefined,
      date_from: searchParams.get("date_from") || undefined,
      date_to: searchParams.get("date_to") || undefined,
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "20"),
    };

    const result = await listBookings(auth.tenantDb, auth.tenantId, filters);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }

    return NextResponse.json({
      success: true,
      bookings: result.data!.bookings,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: result.data!.total,
        pages: Math.ceil(result.data!.total / (filters.limit || 20)),
      },
    });
  } catch (error) {
    console.error("GET /api/b2b/bookings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticate(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await req.json()) as CreateBookingRequest;

    if (!body.departure_id || !body.resource_id || !body.customer_id || !body.quantity) {
      return NextResponse.json(
        { error: "departure_id, resource_id, customer_id, and quantity are required" },
        { status: 400 }
      );
    }

    if (body.quantity < 1) {
      return NextResponse.json(
        { error: "quantity must be at least 1" },
        { status: 400 }
      );
    }

    const result = await holdBooking(auth.tenantDb, auth.tenantId, body);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }

    return NextResponse.json({ success: true, booking: result.data }, { status: 201 });
  } catch (error) {
    console.error("POST /api/b2b/bookings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
