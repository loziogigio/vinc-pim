/**
 * POST /api/b2b/orders/[id]/submit
 *
 * Submit a draft order (cart) for processing.
 * Transitions: draft → pending
 */

import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { submitOrder } from "@/lib/services/order-lifecycle.service";
import { dispatchTrigger } from "@/lib/notifications/trigger-dispatch";
import { isDeferredPaymentMethod } from "@/lib/constants/payment";
import { createOrderNoteSubmission } from "@/lib/services/order-note.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const result = await submitOrder(
      connection,
      orderId,
      auth.userId || "anonymous"
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Only send order_confirmation at submit time for deferred payment methods
    // (bank_transfer, cash_on_delivery). For online payments (PayPal, credit card, etc.),
    // order_confirmation is sent after payment capture in recordGatewayPayment.
    const paymentMethod = result.order?.payment?.payment_method;
    if (isDeferredPaymentMethod(paymentMethod)) {
      void dispatchTrigger(dbName, "order_confirmation", {
        type: "order",
        order: result.order!,
        portalUserId: auth.userId || undefined,
      });

      // Order note for deferred payments — only when customer left a note
      if (result.order?.buyer && result.order.notes) {
        void createOrderNoteSubmission(dbName, result.order);
      }
    }

    return NextResponse.json({
      success: true,
      order: result.order,
    });
  } catch (error) {
    console.error("Error submitting order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit order" },
      { status: 500 }
    );
  }
}
