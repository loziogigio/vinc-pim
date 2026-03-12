/**
 * POST /api/b2b/coupons/validate - Validate a coupon code against an order
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { validateCoupon } from "@/lib/services/coupon.service";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const body = await req.json();
    const { code, order_id, customer_id } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "code is required" },
        { status: 400 }
      );
    }
    if (!order_id || typeof order_id !== "string") {
      return NextResponse.json(
        { error: "order_id is required" },
        { status: 400 }
      );
    }

    const result = await validateCoupon(
      auth.tenantDb,
      code,
      order_id,
      customer_id
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Error validating coupon:", error);
    return NextResponse.json(
      { error: "Failed to validate coupon" },
      { status: 500 }
    );
  }
}
