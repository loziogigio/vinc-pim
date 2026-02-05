/**
 * Order Cart Discounts API
 *
 * POST /api/b2b/orders/[id]/discounts - Add cart-level discount
 * DELETE /api/b2b/orders/[id]/discounts?discount_id=xxx - Remove cart discount
 */

import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  addCartDiscount,
  removeCartDiscount,
} from "@/lib/services/order-lifecycle.service";
import type { AdjustmentReason } from "@/lib/constants/order";

interface AddDiscountBody {
  type: "percentage" | "fixed";
  value: number;
  reason: AdjustmentReason;
  description?: string;
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

    const body: AddDiscountBody = await req.json();

    if (!body.type || body.value === undefined || !body.reason) {
      return NextResponse.json(
        { error: "type, value, and reason are required" },
        { status: 400 }
      );
    }

    const result = await addCartDiscount(
      connection,
      orderId,
      auth.userId || "system",
      {
        type: body.type,
        value: body.value,
        reason: body.reason,
        description: body.description,
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
    console.error("Error adding cart discount:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add discount" },
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
    const discountId = searchParams.get("discount_id");

    if (!discountId) {
      return NextResponse.json(
        { error: "discount_id query parameter required" },
        { status: 400 }
      );
    }

    const auth = await requireTenantAuth(req);
    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const result = await removeCartDiscount(connection, orderId, discountId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      order: result.order,
    });
  } catch (error) {
    console.error("Error removing cart discount:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove discount" },
      { status: 500 }
    );
  }
}
