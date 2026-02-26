/**
 * POST /api/b2b/reminders — Create a reminder
 * DELETE /api/b2b/reminders — Cancel a reminder
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { createReminder, cancelReminder } from "@/lib/services/reminder.service";

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth(req, { requireUserId: true });
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId, userId } = auth;
  const body = await req.json();

  if (!body.sku) {
    return NextResponse.json({ error: "sku is required" }, { status: 400 });
  }

  const result = await createReminder(tenantDb, tenantId, userId!, {
    sku: body.sku,
    email: body.email,
    push_token: body.push_token,
    expires_in_days: body.expires_in_days,
  });

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

  const cancelled = await cancelReminder(tenantDb, tenantId, userId!, body.sku);
  if (!cancelled) {
    return NextResponse.json({ error: "No active reminder found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: "Reminder cancelled" });
}
