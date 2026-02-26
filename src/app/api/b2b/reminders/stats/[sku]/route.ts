/**
 * GET /api/b2b/reminders/stats/[sku] — Get reminder stats for a product
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getReminderStats } from "@/lib/services/reminder.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sku: string }> }
) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { sku } = await params;
  const { tenantDb, tenantId } = auth;

  const result = await getReminderStats(tenantDb, tenantId, sku);
  return NextResponse.json({ success: true, data: result });
}
