/**
 * Departures API — List & Create
 *
 * GET  /api/b2b/departures — list departures (paginated, filterable)
 * POST /api/b2b/departures — create a departure with resources
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import {
  createDeparture,
  listDepartures,
} from "@/lib/services/booking.service";
import type { CreateDepartureRequest, DepartureListFilters } from "@/lib/types/booking";

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

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticate(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(req.url);
    const filters: DepartureListFilters = {
      product_entity_code: searchParams.get("product_entity_code") || undefined,
      status: (searchParams.get("status") as DepartureListFilters["status"]) || undefined,
      date_from: searchParams.get("date_from") || undefined,
      date_to: searchParams.get("date_to") || undefined,
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "20"),
    };

    const result = await listDepartures(auth.tenantDb, auth.tenantId, filters);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }

    return NextResponse.json({
      success: true,
      departures: result.data!.departures,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: result.data!.total,
        pages: Math.ceil(result.data!.total / (filters.limit || 20)),
      },
    });
  } catch (error) {
    console.error("GET /api/b2b/departures error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticate(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await req.json()) as CreateDepartureRequest;

    if (!body.product_entity_code || !body.label || !body.starts_at || !body.resources?.length) {
      return NextResponse.json(
        { error: "product_entity_code, label, starts_at, and resources are required" },
        { status: 400 }
      );
    }

    const result = await createDeparture(auth.tenantDb, auth.tenantId, body);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }

    return NextResponse.json({ success: true, departure: result.data }, { status: 201 });
  } catch (error) {
    console.error("POST /api/b2b/departures error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
