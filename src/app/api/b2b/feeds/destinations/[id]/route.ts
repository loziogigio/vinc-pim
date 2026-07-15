/**
 * GET    /api/b2b/feeds/destinations/[id] — get a destination (secrets masked)
 * PUT    /api/b2b/feeds/destinations/[id] — update a destination
 * DELETE /api/b2b/feeds/destinations/[id] — delete a destination + its runs/item states
 */
import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  getDestination,
  updateDestination,
  deleteDestination,
  validateDeltaIntervalMinutes,
} from "@/lib/services/feed-destination.service";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const { id } = await params;
  const data = await getDestination(auth.tenantDb, id);
  if (!data) return NextResponse.json({ error: "Destination not found" }, { status: 404 });
  // tenant_id rides at the top level (NOT inside the masked destination) so
  // the edit page can build the public feed URL server-authoritatively —
  // in-app navigation uses un-prefixed paths, so deriving it client-side
  // from the pathname is unreliable.
  return NextResponse.json({ success: true, data, tenant_id: auth.tenantId });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const { id } = await params;
  const body = await req.json();

  try {
    validateDeltaIntervalMinutes(body.delta_interval_minutes);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const data = await updateDestination(auth.tenantDb, auth.tenantId, id, body);
  if (!data) return NextResponse.json({ error: "Destination not found" }, { status: 404 });
  return NextResponse.json({ success: true, data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const { id } = await params;
  const ok = await deleteDestination(auth.tenantDb, id);
  if (!ok) return NextResponse.json({ error: "Destination not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: { deleted: true } });
}
