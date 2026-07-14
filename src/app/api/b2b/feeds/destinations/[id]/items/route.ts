/**
 * GET /api/b2b/feeds/destinations/[id]/items — per-product push state (?status=error to filter)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { listItemStates } from "@/lib/services/feed-destination.service";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50")));
  const data = await listItemStates(auth.tenantDb, id, status, page, limit);
  return NextResponse.json({ success: true, data });
}
