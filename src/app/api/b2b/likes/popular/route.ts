/**
 * GET /api/b2b/likes/popular — Get popular products by likes
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getPopularProducts } from "@/lib/services/like.service";

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId } = auth;
  const { searchParams } = new URL(req.url);

  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") || "30")));

  const result = await getPopularProducts(tenantDb, tenantId, limit, days);
  return NextResponse.json({ success: true, data: result });
}
