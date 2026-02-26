/**
 * GET /api/b2b/reminders/user — Get current user's reminders
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getUserReminders } from "@/lib/services/reminder.service";
import { REMINDER_PAGINATION, REMINDER_STATUSES } from "@/lib/constants/reminder";
import type { ReminderStatus } from "@/lib/constants/reminder";

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth(req, { requireUserId: true });
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId, userId } = auth;
  const { searchParams } = new URL(req.url);

  const page = Math.max(1, parseInt(searchParams.get("page") || String(REMINDER_PAGINATION.DEFAULT_PAGE)));
  const limit = Math.min(
    REMINDER_PAGINATION.MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get("limit") || String(REMINDER_PAGINATION.DEFAULT_LIMIT)))
  );

  const statusParam = searchParams.get("status");
  const statusFilter: ReminderStatus | undefined =
    statusParam && REMINDER_STATUSES.includes(statusParam as ReminderStatus)
      ? (statusParam as ReminderStatus)
      : undefined;

  const { reminders, total_count } = await getUserReminders(
    tenantDb, tenantId, userId!, page, limit, statusFilter
  );

  return NextResponse.json({
    success: true,
    data: {
      reminders,
      total_count,
      page,
      page_size: limit,
      has_next: page * limit < total_count,
    },
  });
}
