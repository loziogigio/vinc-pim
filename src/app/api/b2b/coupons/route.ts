/**
 * GET  /api/b2b/coupons - List coupons with pagination
 * POST /api/b2b/coupons - Create a new coupon
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { listCoupons, createCoupon } from "@/lib/services/coupon.service";
import type { CouponStatus } from "@/lib/constants/coupon";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));
    const status = searchParams.get("status") as CouponStatus | null;
    const search = searchParams.get("search") || undefined;

    const result = await listCoupons(auth.tenantDb, {
      page,
      limit,
      status: status || undefined,
      search,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      ...result.data,
    });
  } catch (error) {
    console.error("Error listing coupons:", error);
    return NextResponse.json(
      { error: "Failed to list coupons" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const body = await req.json();

    if (!body.code || typeof body.code !== "string" || !body.code.trim()) {
      return NextResponse.json(
        { error: "Code is required" },
        { status: 400 }
      );
    }
    if (!body.discount_type || !["percentage", "fixed"].includes(body.discount_type)) {
      return NextResponse.json(
        { error: "discount_type must be 'percentage' or 'fixed'" },
        { status: 400 }
      );
    }
    if (typeof body.discount_value !== "number" || body.discount_value <= 0) {
      return NextResponse.json(
        { error: "discount_value must be a positive number" },
        { status: 400 }
      );
    }

    const result = await createCoupon(auth.tenantDb, body, auth.userId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status || 500 }
      );
    }

    return NextResponse.json(
      { success: true, coupon: result.data },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating coupon:", error);
    return NextResponse.json(
      { error: "Failed to create coupon" },
      { status: 500 }
    );
  }
}
