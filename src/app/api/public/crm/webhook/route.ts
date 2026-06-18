// vinc-commerce-suite/src/app/api/public/crm/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { verifyWebhook, handleOpportunityEvent } from "@/lib/leads/crm-webhook";

/**
 * POST /api/public/crm/webhook
 *
 * Receives Twenty CRM webhook events (opportunity stage changes).
 * Public endpoint — no tenant auth; signature-verified via HMAC-SHA256.
 * Uses raw body (req.text()) so HMAC is computed over the exact wire bytes.
 *
 * Signature header: x-twenty-signature (fallback: ?s= query param for
 * Twenty versions that don't support signing headers yet).
 *
 * Always returns 200 on business-logic errors to avoid Twenty retry storms;
 * errors are logged server-side. Returns 401 on bad signature, 400 on bad JSON.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = process.env.VINC_TWENTY_WEBHOOK_SECRET ?? "";
  const sig =
    req.headers.get("x-twenty-signature") ??
    new URL(req.url).searchParams.get("s");

  if (!verifyWebhook(raw, sig, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const tenantDb = `vinc-${process.env.VINC_PIPELINE_TENANT_ID ?? "vendereincloud-it"}`;
  try {
    const { Deal } = await connectWithModels(tenantDb);
    const res = await handleOpportunityEvent({ Deal }, payload);
    return NextResponse.json({ ok: true, ...res });
  } catch (err) {
    console.error("[crm-webhook]", err);
    // Return 200 to acknowledge receipt and avoid Twenty retry storms; error is logged
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
