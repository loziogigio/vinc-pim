/**
 * Stripe Webhook Handler
 *
 * POST /api/public/payments/webhooks/stripe
 *
 * Public endpoint — no auth required.
 * Signature verified via Stripe-Signature header + STRIPE_WEBHOOK_SECRET.
 */

import { NextRequest, NextResponse } from "next/server";
import { processWebhook } from "@/lib/payments/webhook.service";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text();
    const signature = req.headers.get("stripe-signature") || "";
    const secret = process.env.STRIPE_WEBHOOK_SECRET || "";

    if (!signature) {
      return NextResponse.json(
        { error: "Missing Stripe-Signature header" },
        { status: 400 }
      );
    }

    const result = await processWebhook("stripe", payload, signature, secret);

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
    console.error("Stripe webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
