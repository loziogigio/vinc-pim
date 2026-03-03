/**
 * PayPal Webhook Handler
 *
 * POST /api/public/payments/webhooks/paypal?tenant={tenantId}
 *
 * Public endpoint — no auth required.
 * Verification: calls PayPal's verify-webhook-signature API with
 * the tenant's webhook_id and OAuth credentials from MongoDB config.
 *
 * The ?tenant= parameter is REQUIRED — webhooks without it are rejected.
 */

import { NextRequest, NextResponse } from "next/server";
import { processWebhook } from "@/lib/payments/webhook.service";
import { getPooledConnection } from "@/lib/db/connection";
import { getProviderConfig } from "@/lib/payments/payment.service";

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

    // Load tenant's PayPal config to include credentials in the verification call
    const connection = await getPooledConnection(`vinc-${tenantId}`);
    const tenantConfig = await getProviderConfig(connection, tenantId, "paypal");

    // Bundle all PayPal transmission headers + tenant credentials as JSON.
    // The PayPal provider's verifyWebhookSignature uses these to call
    // POST /v1/notifications/verify-webhook-signature.
    const signature = JSON.stringify({
      auth_algo: req.headers.get("paypal-auth-algo") || "",
      cert_url: req.headers.get("paypal-cert-url") || "",
      transmission_id: req.headers.get("paypal-transmission-id") || "",
      transmission_sig: req.headers.get("paypal-transmission-sig") || "",
      transmission_time: req.headers.get("paypal-transmission-time") || "",
      // Tenant credentials needed for OAuth token in verification call
      client_id: (tenantConfig?.client_id as string) || "",
      client_secret: (tenantConfig?.client_secret as string) || "",
      environment: (tenantConfig?.environment as string) || "sandbox",
    });

    const result = await processWebhook("paypal", payload, signature, tenantId);

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
