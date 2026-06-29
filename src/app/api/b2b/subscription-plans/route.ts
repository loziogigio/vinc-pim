/**
 * GET  /api/b2b/subscription-plans - List subscription plans (paginated)
 * POST /api/b2b/subscription-plans - Create a subscription plan
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  listSubscriptionPlans,
  createSubscriptionPlan,
} from "@/lib/services/subscription-plan.service";
import type { PlanStatus } from "@/lib/constants/subscription";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));
    const status = (searchParams.get("status") as PlanStatus | null) || undefined;
    const channel = searchParams.get("channel") || undefined;
    const search = searchParams.get("search") || undefined;

    const result = await listSubscriptionPlans(auth.tenantDb, { page, limit, status, channel, search });
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }
    return NextResponse.json({ success: true, ...result.data });
  } catch (error) {
    console.error("Error listing subscription plans:", error);
    return NextResponse.json({ error: "Failed to list subscription plans" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const body = await req.json();
    const result = await createSubscriptionPlan(auth.tenantDb, body);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }
    return NextResponse.json({ success: true, plan: result.data }, { status: 201 });
  } catch (error) {
    console.error("Error creating subscription plan:", error);
    return NextResponse.json({ error: "Failed to create subscription plan" }, { status: 500 });
  }
}
