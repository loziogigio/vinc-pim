/**
 * POST /api/b2b/likes — Add a like
 * DELETE /api/b2b/likes — Remove a like
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { addLike, removeLike } from "@/lib/services/like.service";

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth(req, { requireUserId: true });
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId, userId } = auth;
  const body = await req.json();

  if (!body.sku) {
    return NextResponse.json({ error: "sku is required" }, { status: 400 });
  }

  const result = await addLike(tenantDb, tenantId, userId!, body.sku);
  return NextResponse.json({ success: true, data: result }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireTenantAuth(req, { requireUserId: true });
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId, userId } = auth;
  const body = await req.json();

  if (!body.sku) {
    return NextResponse.json({ error: "sku is required" }, { status: 400 });
  }

  const result = await removeLike(tenantDb, tenantId, userId!, body.sku);
  if (!result.removed) {
    return NextResponse.json({ error: "No active like found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: result });
}
