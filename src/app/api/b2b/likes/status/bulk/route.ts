/**
 * POST /api/b2b/likes/status/bulk — Bulk like status check
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getBulkLikeStatus } from "@/lib/services/like.service";

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth(req, { requireUserId: true });
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId, userId } = auth;
  const body = await req.json();

  if (!Array.isArray(body.skus) || body.skus.length === 0) {
    return NextResponse.json({ error: "skus array is required" }, { status: 400 });
  }

  if (body.skus.length > 100) {
    return NextResponse.json({ error: "Maximum 100 SKUs per request" }, { status: 400 });
  }

  const result = await getBulkLikeStatus(tenantDb, tenantId, userId!, body.skus);
  return NextResponse.json({ success: true, data: result });
}
