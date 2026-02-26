/**
 * Mangopay Webhook Handler
 *
 * POST /api/public/payments/webhooks/mangopay
 *
 * Public endpoint — no auth required.
 * Mangopay sends event notifications; verification via API callback.
 */

import { NextRequest, NextResponse } from "next/server";
import { processWebhook } from "@/lib/payments/webhook.service";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text();
    const signature = req.headers.get("x-mangopay-signature") || "mangopay-event";
    const secret = process.env.MANGOPAY_WEBHOOK_KEY || "";

    const result = await processWebhook("mangopay", payload, signature, secret);

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
    console.error("Mangopay webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
