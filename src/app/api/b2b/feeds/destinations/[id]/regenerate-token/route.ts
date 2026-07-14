/**
 * POST /api/b2b/feeds/destinations/[id]/regenerate-token — rotate the TrovaPrezzi feed_token
 */
import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { regenerateFeedToken } from "@/lib/services/feed-destination.service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const { id } = await params;
  const token = await regenerateFeedToken(auth.tenantDb, id);
  if (!token) return NextResponse.json({ error: "Destination not found or not trovaprezzi" }, { status: 404 });
  return NextResponse.json({ success: true, data: { feed_token: token } });
}
