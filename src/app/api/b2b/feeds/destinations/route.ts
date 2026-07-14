/**
 * GET  /api/b2b/feeds/destinations — list feed destinations (secrets masked)
 * POST /api/b2b/feeds/destinations — create a destination
 */
import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  listDestinations,
  createDestination,
  validateDeltaIntervalMinutes,
} from "@/lib/services/feed-destination.service";
import { FEED_DESTINATION_TYPES } from "@/lib/db/models/feed-destination";

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const data = await listDestinations(auth.tenantDb);
  return NextResponse.json({ success: true, data });
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const body = await req.json();

  if (!body.type || !(FEED_DESTINATION_TYPES as readonly string[]).includes(body.type)) {
    return NextResponse.json({ error: "type must be one of google_merchant, meta_catalog, trovaprezzi" }, { status: 400 });
  }
  for (const field of ["name", "channel", "lang", "currency", "product_url_template"]) {
    if (!body[field]) {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 });
    }
  }
  try {
    validateDeltaIntervalMinutes(body.delta_interval_minutes);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const data = await createDestination(auth.tenantDb, auth.tenantId, body);
  return NextResponse.json({ success: true, data }, { status: 201 });
}
