/**
 * GET /api/b2b/reminders/dashboard — Tenant-wide reminder stats for admin dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getDashboardStats } from "@/lib/services/reminder.service";

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId } = auth;
  const data = await getDashboardStats(tenantDb, tenantId);

  return NextResponse.json({ success: true, data });
}
