/**
 * POST /api/b2b/reminders/toggle — Toggle reminder on/off
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { toggleReminder } from "@/lib/services/reminder.service";

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth(req, { requireUserId: true });
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId, userId } = auth;
  const body = await req.json();

  if (!body.sku) {
    return NextResponse.json({ error: "sku is required" }, { status: 400 });
  }

  const result = await toggleReminder(tenantDb, tenantId, userId!, {
    sku: body.sku,
    email: body.email,
    push_token: body.push_token,
    expires_in_days: body.expires_in_days,
  });

  return NextResponse.json({ success: true, data: result });
}
