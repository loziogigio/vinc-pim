/**
 * POST /api/b2b/likes/toggle — Toggle like on/off
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { toggleLike } from "@/lib/services/like.service";

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth(req, { requireUserId: true });
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId, userId } = auth;
  const body = await req.json();

  if (!body.sku) {
    return NextResponse.json({ error: "sku is required" }, { status: 400 });
  }

  const result = await toggleLike(tenantDb, tenantId, userId!, body.sku);
  return NextResponse.json({ success: true, data: result });
}
