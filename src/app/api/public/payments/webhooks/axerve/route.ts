/**
 * Axerve / Fabrick Webhook Handler
 *
 * POST /api/public/payments/webhooks/axerve?tenant={tenantId}
 *
 * Public endpoint — no auth required.
 * Verification: signature checked against tenant's api_key from MongoDB.
 *
 * The ?tenant= parameter is REQUIRED — webhooks without it are rejected.
 */

import { NextRequest, NextResponse } from "next/server";
import { processWebhook } from "@/lib/payments/webhook.service";

export async function POST(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get("tenant");
    if (!tenantId) {
      return NextResponse.json(
        { error: "Missing tenant parameter" },
        { status: 400 }
      );
    }

    const payload = await req.text();
    const signature = req.headers.get("x-axerve-signature") || "";

    const result = await processWebhook("axerve", payload, signature, tenantId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      received: true,
      event_id: result.event_id,
    });
  } catch (error) {
    console.error("Axerve webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
