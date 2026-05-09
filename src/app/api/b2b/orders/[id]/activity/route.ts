/**
 * GET /api/b2b/orders/[id]/activity
 *
 * Returns a chronological activity feed for an order — lifecycle
 * transitions, Windmill jobs (with live args/result/logs),
 * ERP calls, payments, quotations, discounts, items, documents,
 * bookings, form submissions, and processing errors.
 *
 * Query params:
 *   section  — load a single section (with cursor pagination)
 *   cursor   — ISO timestamp; returns events whose `at` is strictly older
 *   limit    — page size (default 50 single-section, 20 per section for all)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  assembleOrderActivity,
  loadSection,
} from "@/lib/services/order-activity.service";
import {
  ACTIVITY_SECTION_NAMES,
  type ActivitySectionName,
} from "@/lib/types/order-activity";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orderId } = await params;

  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const url = new URL(req.url);
  const sectionParam = url.searchParams.get("section");
  const cursor = url.searchParams.get("cursor");
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.max(1, Math.min(200, Number(limitParam))) : undefined;

  if (sectionParam) {
    if (!ACTIVITY_SECTION_NAMES.includes(sectionParam as ActivitySectionName)) {
      return NextResponse.json(
        { error: `Unknown section: ${sectionParam}` },
        { status: 400 },
      );
    }
    const result = await loadSection(
      auth.tenantDb,
      orderId,
      sectionParam as ActivitySectionName,
      cursor,
      limit,
    );
    if (!result) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      data: { section: sectionParam, page: result.page },
    });
  }

  const result = await assembleOrderActivity(auth.tenantDb, orderId, {
    perSectionLimit: limit,
  });
  if (!result) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  return NextResponse.json({
    success: true,
    data: { sections: result.sections },
  });
}
