/**
 * GET /api/b2b/likes/status/[sku] — Get like status for current user
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getLikeStatus } from "@/lib/services/like.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sku: string }> }
) {
  const auth = await requireTenantAuth(req, { requireUserId: true });
  if (!auth.success) return auth.response;

  const { sku } = await params;
  const { tenantDb, tenantId, userId } = auth;

  const result = await getLikeStatus(tenantDb, tenantId, userId!, sku);
  return NextResponse.json({ success: true, data: result });
}
