/**
 * Nexi XPay Webhook Handler
 *
 * POST /api/public/payments/webhooks/nexi
 *
 * Public endpoint — no auth required.
 * Nexi sends server-to-server notifications with MAC verification.
 */

import { NextRequest, NextResponse } from "next/server";
import { processWebhook } from "@/lib/payments/webhook.service";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text();
    const signature = req.headers.get("x-nexi-mac") || "";
    const secret = process.env.NEXI_WEBHOOK_SECRET || "";

    const result = await processWebhook("nexi", payload, signature, secret);

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
    console.error("Nexi webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
