/**
 * GET    /api/b2b/coupons/:coupon_id - Get single coupon
 * PATCH  /api/b2b/coupons/:coupon_id - Update coupon
 * DELETE /api/b2b/coupons/:coupon_id - Delete coupon
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  getCoupon,
  updateCoupon,
  deleteCoupon,
} from "@/lib/services/coupon.service";

type RouteContext = { params: Promise<{ coupon_id: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { coupon_id } = await params;
    const result = await getCoupon(auth.tenantDb, coupon_id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status || 500 }
      );
    }

    return NextResponse.json({ success: true, coupon: result.data });
  } catch (error) {
    console.error("Error getting coupon:", error);
    return NextResponse.json(
      { error: "Failed to get coupon" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { coupon_id } = await params;
    const body = await req.json();

    const result = await updateCoupon(auth.tenantDb, coupon_id, body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status || 500 }
      );
    }

    return NextResponse.json({ success: true, coupon: result.data });
  } catch (error) {
    console.error("Error updating coupon:", error);
    return NextResponse.json(
      { error: "Failed to update coupon" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { coupon_id } = await params;
    const result = await deleteCoupon(auth.tenantDb, coupon_id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status || 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    return NextResponse.json(
      { error: "Failed to delete coupon" },
      { status: 500 }
    );
  }
}
