/**
 * PayPal Webhook Handler
 *
 * POST /api/public/payments/webhooks/paypal
 *
 * Public endpoint — no auth required.
 * PayPal sends webhook notifications; verification via PayPal API.
 */

import { NextRequest, NextResponse } from "next/server";
import { processWebhook } from "@/lib/payments/webhook.service";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text();
    // PayPal sends various headers for verification
    const signature = req.headers.get("paypal-transmission-sig") || "";
    const secret = process.env.PAYPAL_WEBHOOK_ID || "";

    const result = await processWebhook("paypal", payload, signature, secret);

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
    console.error("PayPal webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
