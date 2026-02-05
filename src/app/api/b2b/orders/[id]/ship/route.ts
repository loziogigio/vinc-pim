/**
 * POST /api/b2b/orders/[id]/ship
 *
 * Mark an order as shipped.
 * Transitions: confirmed → shipped
 */

import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { shipOrder } from "@/lib/services/order-lifecycle.service";
import type { UserRole } from "@/lib/constants/order";

interface RequestBody {
  carrier?: string;
  tracking_number?: string;
  tracking_url?: string;
  estimated_delivery?: string; // ISO date
  delivery_notes?: string;
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

    const body: RequestBody = await req.json().catch(() => ({}));

    // Warehouse or admin role
    const userRole: UserRole = auth.isAdmin ? "admin" : "warehouse";

    const result = await shipOrder(
      connection,
      orderId,
      auth.userId || "system",
      userRole,
      {
        carrier: body.carrier,
        trackingNumber: body.tracking_number,
        trackingUrl: body.tracking_url,
        estimatedDelivery: body.estimated_delivery
          ? new Date(body.estimated_delivery)
          : undefined,
        deliveryNotes: body.delivery_notes,
      }
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      order: result.order,
    });
  } catch (error) {
    console.error("Error shipping order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to ship order" },
      { status: 500 }
    );
  }
}
