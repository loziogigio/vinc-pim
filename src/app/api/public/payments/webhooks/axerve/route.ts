/**
 * Axerve / Fabrick Webhook Handler
 *
 * POST /api/public/payments/webhooks/axerve
 *
 * Public endpoint — no auth required.
 * Axerve sends encrypted callback data that must be decrypted with shop credentials.
 */

import { NextRequest, NextResponse } from "next/server";
import { processWebhook } from "@/lib/payments/webhook.service";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text();
    // Axerve uses encrypted string in query params or body
    const signature = req.headers.get("x-axerve-signature") || "axerve-callback";
    const secret = process.env.AXERVE_WEBHOOK_SECRET || "";

    const result = await processWebhook("axerve", payload, signature, secret);

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
