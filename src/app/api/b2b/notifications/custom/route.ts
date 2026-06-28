import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { enforceCustomSendCap } from "@/lib/notifications/custom-send-cap";
import { validateCustomRequest, sendCustomNotification } from "@/lib/notifications/custom-send.service";

/**
 * POST /api/b2b/notifications/custom
 * Send an ad-hoc, template-less notification with caller-supplied content on any of
 * email / sms / webpush / fcm. Logged like every other notification; per-tenant rate-capped.
 */
export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const body = await req.json().catch(() => ({}));
  const v = validateCustomRequest(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const cap = await enforceCustomSendCap(auth.tenantId);
  if (!cap.allowed) {
    return NextResponse.json({ error: "rate_limited", retry_after: cap.retryAfter }, { status: 429 });
  }

  const result = await sendCustomNotification({ ...v.value, tenantDb: auth.tenantDb });
  return NextResponse.json(result, { status: 200 });
}
