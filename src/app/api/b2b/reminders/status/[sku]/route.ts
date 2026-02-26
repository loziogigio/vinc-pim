/**
 * GET /api/b2b/reminders/status/[sku] — Get reminder status for current user
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getReminderStatus } from "@/lib/services/reminder.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sku: string }> }
) {
  const auth = await requireTenantAuth(req, { requireUserId: true });
  if (!auth.success) return auth.response;

  const { sku } = await params;
  const { tenantDb, tenantId, userId } = auth;

  const result = await getReminderStatus(tenantDb, tenantId, userId!, sku);
  return NextResponse.json({ success: true, data: result });
}
