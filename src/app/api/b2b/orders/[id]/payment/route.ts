/**
 * Order Payment API
 *
 * GET /api/b2b/orders/[id]/payment - Get payment status
 * POST /api/b2b/orders/[id]/payment - Record a payment
 * PATCH /api/b2b/orders/[id]/payment - Update payment status or edit a payment record
 * DELETE /api/b2b/orders/[id]/payment?payment_id=xxx - Delete a payment record
 */

import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  getOrder,
  recordPayment,
  updatePaymentStatus,
  deletePayment,
  editPayment,
} from "@/lib/services/order-lifecycle.service";
import type { PaymentStatus } from "@/lib/constants/order";

interface RecordPaymentBody {
  amount: number;
  method: string;
  reference?: string;
  notes?: string;
  confirmed?: boolean;
  recorded_at?: string; // ISO date string
}

interface UpdateStatusBody {
  status: PaymentStatus;
}

interface EditPaymentBody {
  payment_id: string;
  amount?: number;
  method?: string;
  reference?: string;
  notes?: string;
  recorded_at?: string; // ISO date string
  confirmed?: boolean;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const auth = await requireTenantAuth(req);
    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const order = await getOrder(connection, orderId);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      order_id: orderId,
      order_total: order.order_total,
      payment: order.payment || {
        payment_status: "not_required",
        amount_due: order.order_total,
        amount_paid: 0,
        amount_remaining: order.order_total,
        payments: [],
      },
    });
  } catch (error) {
    console.error("Error getting payment status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get payment status" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const auth = await requireTenantAuth(req);
    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const body: RecordPaymentBody = await req.json();

    if (!body.amount || !body.method) {
      return NextResponse.json(
        { error: "amount and method are required" },
        { status: 400 }
      );
    }

    const result = await recordPayment(
      connection,
      orderId,
      auth.userId || "system",
      {
        amount: body.amount,
        method: body.method,
        reference: body.reference,
        notes: body.notes,
        confirmed: body.confirmed,
        recorded_at: body.recorded_at ? new Date(body.recorded_at) : undefined,
      }
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      order: result.order,
      payment: result.order?.payment,
    });
  } catch (error) {
    console.error("Error recording payment:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to record payment" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const auth = await requireTenantAuth(req);
    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const body = await req.json();

    // If payment_id is provided, edit that specific payment record
    if (body.payment_id) {
      const editBody = body as EditPaymentBody;
      const result = await editPayment(connection, orderId, editBody.payment_id, {
        amount: editBody.amount,
        method: editBody.method,
        reference: editBody.reference,
        notes: editBody.notes,
        recorded_at: editBody.recorded_at ? new Date(editBody.recorded_at) : undefined,
        confirmed: editBody.confirmed,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        order: result.order,
        payment: result.order?.payment,
      });
    }

    // Otherwise, update the overall payment status
    const statusBody = body as UpdateStatusBody;
    if (!statusBody.status) {
      return NextResponse.json(
        { error: "status or payment_id is required" },
        { status: 400 }
      );
    }

    const result = await updatePaymentStatus(connection, orderId, statusBody.status);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      order: result.order,
      payment: result.order?.payment,
    });
  } catch (error) {
    console.error("Error updating payment:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update payment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get("payment_id");

    if (!paymentId) {
      return NextResponse.json(
        { error: "payment_id query parameter is required" },
        { status: 400 }
      );
    }

    const auth = await requireTenantAuth(req);
    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const result = await deletePayment(connection, orderId, paymentId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Payment deleted",
      order: result.order,
      payment: result.order?.payment,
    });
  } catch (error) {
    console.error("Error deleting payment:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete payment" },
      { status: 500 }
    );
  }
}
