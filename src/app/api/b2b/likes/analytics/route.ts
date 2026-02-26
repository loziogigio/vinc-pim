/**
 * GET /api/b2b/likes/analytics — Get likes analytics summary
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getAnalytics } from "@/lib/services/like.service";
import { LIKE_TIME_PERIODS } from "@/lib/constants/like";
import type { LikeTimePeriod } from "@/lib/constants/like";

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId } = auth;
  const { searchParams } = new URL(req.url);

  const periodParam = searchParams.get("period") || "30d";
  const period: LikeTimePeriod = LIKE_TIME_PERIODS.includes(periodParam as LikeTimePeriod)
    ? (periodParam as LikeTimePeriod)
    : "30d";

  const result = await getAnalytics(tenantDb, tenantId, period);
  return NextResponse.json({ success: true, data: result });
}
