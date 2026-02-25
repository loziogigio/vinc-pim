/**
 * /api/b2b/vetrina/status
 *
 * GET  - Read tenant's vetrina opt-in status
 * PATCH - Update tenant's vetrina opt-in status
 *
 * Supports: API Key, Bearer Token, B2B Session
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getTenant, updateTenant } from "@/lib/services/admin-tenant.service";

/**
 * GET /api/b2b/vetrina/status
 * Read the current tenant's vetrina listing status
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const tenant = await getTenant(auth.tenantId);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      is_listed: tenant.vetrina?.is_listed ?? false,
    });
  } catch (error) {
    console.error("Get vetrina status error:", error);
    return NextResponse.json(
      { error: "Failed to get vetrina status" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/b2b/vetrina/status
 * Update the current tenant's vetrina listing status
 *
 * Body: { is_listed: boolean }
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const body = await req.json();
    const { is_listed } = body;

    if (typeof is_listed !== "boolean") {
      return NextResponse.json(
        { error: "is_listed must be a boolean" },
        { status: 400 }
      );
    }

    await updateTenant(auth.tenantId, {
      vetrina: { is_listed },
    });

    return NextResponse.json({
      success: true,
      is_listed,
    });
  } catch (error) {
    console.error("Update vetrina status error:", error);
    return NextResponse.json(
      { error: "Failed to update vetrina status" },
      { status: 500 }
    );
  }
}
