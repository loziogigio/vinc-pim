/**
 * GET    /api/b2b/subscription-plans/[plan_id] - Get one plan
 * PATCH  /api/b2b/subscription-plans/[plan_id] - Update a plan
 * DELETE /api/b2b/subscription-plans/[plan_id] - Delete a plan
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  getSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
} from "@/lib/services/subscription-plan.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ plan_id: string }> }
) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;
    const { plan_id } = await params;

    const result = await getSubscriptionPlan(auth.tenantDb, plan_id);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }
    return NextResponse.json({ success: true, plan: result.data });
  } catch (error) {
    console.error("Error getting subscription plan:", error);
    return NextResponse.json({ error: "Failed to get subscription plan" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ plan_id: string }> }
) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;
    const { plan_id } = await params;
    const body = await req.json();

    const result = await updateSubscriptionPlan(auth.tenantDb, plan_id, body);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }
    return NextResponse.json({ success: true, plan: result.data });
  } catch (error) {
    console.error("Error updating subscription plan:", error);
    return NextResponse.json({ error: "Failed to update subscription plan" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ plan_id: string }> }
) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;
    const { plan_id } = await params;

    const result = await deleteSubscriptionPlan(auth.tenantDb, plan_id);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting subscription plan:", error);
    return NextResponse.json({ error: "Failed to delete subscription plan" }, { status: 500 });
  }
}
