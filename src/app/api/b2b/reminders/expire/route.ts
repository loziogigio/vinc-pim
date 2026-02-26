/**
 * POST /api/b2b/reminders/expire — Expire old reminders (admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { expireOldReminders } from "@/lib/services/reminder.service";

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId } = auth;

  const expiredCount = await expireOldReminders(tenantDb, tenantId);
  return NextResponse.json({
    success: true,
    data: { expired_count: expiredCount },
  });
}
