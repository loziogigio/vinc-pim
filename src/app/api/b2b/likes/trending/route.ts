/**
 * GET /api/b2b/likes/trending — Get trending products by velocity
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getTrendingProducts } from "@/lib/services/like.service";
import { LIKE_TIME_PERIODS, LIKE_PAGINATION } from "@/lib/constants/like";
import type { LikeTimePeriod } from "@/lib/constants/like";

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId } = auth;
  const { searchParams } = new URL(req.url);

  const periodParam = searchParams.get("period") || "7d";
  const period: LikeTimePeriod = LIKE_TIME_PERIODS.includes(periodParam as LikeTimePeriod)
    ? (periodParam as LikeTimePeriod)
    : "7d";

  const page = Math.max(1, parseInt(searchParams.get("page") || String(LIKE_PAGINATION.DEFAULT_PAGE)));
  const limit = Math.min(
    LIKE_PAGINATION.MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get("limit") || String(LIKE_PAGINATION.DEFAULT_LIMIT)))
  );

  const result = await getTrendingProducts(tenantDb, tenantId, period, page, limit);
  return NextResponse.json({ success: true, data: result });
}
