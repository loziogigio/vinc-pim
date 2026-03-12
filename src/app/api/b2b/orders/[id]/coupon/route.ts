/**
 * POST   /api/b2b/orders/:id/coupon - Apply a coupon to an order
 * DELETE /api/b2b/orders/:id/coupon - Remove coupon from an order
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { applyCoupon, removeCoupon } from "@/lib/services/coupon.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { id: orderId } = await params;
    const body = await req.json();
    const { code, customer_id } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "code is required" },
        { status: 400 }
      );
    }

    const result = await applyCoupon(
      auth.tenantDb,
      code,
      orderId,
      customer_id,
      auth.userId
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      order: result.order,
      discount_applied: result.discount_applied,
    });
  } catch (error) {
    console.error("Error applying coupon:", error);
    return NextResponse.json(
      { error: "Failed to apply coupon" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { id: orderId } = await params;
    const result = await removeCoupon(auth.tenantDb, orderId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status || 400 }
      );
    }

    return NextResponse.json({
      success: true,
      order: result.data,
    });
  } catch (error) {
    console.error("Error removing coupon:", error);
    return NextResponse.json(
      { error: "Failed to remove coupon" },
      { status: 500 }
    );
  }
}
