/**
 * Order Delivery Tracking API
 *
 * GET /api/b2b/orders/[id]/delivery - Get delivery status
 * PATCH /api/b2b/orders/[id]/delivery - Update delivery info
 */

import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getModelRegistry } from "@/lib/db/model-registry";

interface UpdateDeliveryBody {
  carrier?: string;
  tracking_number?: string;
  tracking_url?: string;
  estimated_delivery?: string; // ISO date
  delivery_notes?: string;
  delivery_proof?: string; // URL to proof document
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

    const registry = getModelRegistry(connection);
    const Order = registry.Order;

    const order = await Order.findOne({ order_id: orderId }).select(
      "order_id status delivery shipped_at delivered_at"
    );

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      order_id: orderId,
      status: order.status,
      shipped_at: order.shipped_at,
      delivered_at: order.delivered_at,
      delivery: order.delivery || null,
    });
  } catch (error) {
    console.error("Error getting delivery status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get delivery status" },
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

    const body: UpdateDeliveryBody = await req.json();

    const registry = getModelRegistry(connection);
    const Order = registry.Order;

    const order = await Order.findOne({ order_id: orderId });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Only allow updating delivery for shipped or delivered orders
    if (!["shipped", "delivered"].includes(order.status)) {
      return NextResponse.json(
        { error: "Can only update delivery info for shipped or delivered orders" },
        { status: 400 }
      );
    }

    // Initialize delivery if not present
    if (!order.delivery) {
      order.delivery = {};
    }

    // Update fields
    if (body.carrier !== undefined) order.delivery.carrier = body.carrier;
    if (body.tracking_number !== undefined)
      order.delivery.tracking_number = body.tracking_number;
    if (body.tracking_url !== undefined)
      order.delivery.tracking_url = body.tracking_url;
    if (body.estimated_delivery !== undefined)
      order.delivery.estimated_delivery = new Date(body.estimated_delivery);
    if (body.delivery_notes !== undefined)
      order.delivery.delivery_notes = body.delivery_notes;
    if (body.delivery_proof !== undefined)
      order.delivery.delivery_proof = body.delivery_proof;

    await order.save();

    return NextResponse.json({
      success: true,
      order_id: orderId,
      delivery: order.delivery,
    });
  } catch (error) {
    console.error("Error updating delivery info:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update delivery info" },
      { status: 500 }
    );
  }
}
