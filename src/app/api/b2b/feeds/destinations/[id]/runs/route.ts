/**
 * GET /api/b2b/feeds/destinations/[id]/runs — run history for a destination
 */
import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { listRuns } from "@/lib/services/feed-destination.service";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const data = await listRuns(auth.tenantDb, id, page, limit);
  return NextResponse.json({ success: true, data });
}
