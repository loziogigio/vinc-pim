/**
 * /api/public/tenants
 *
 * Public endpoint to list active tenants for login dropdown
 * Returns only tenant_id and name (no sensitive data)
 */

import { NextResponse } from "next/server";
import { listTenants } from "@/lib/services/admin-tenant.service";

/**
 * GET /api/public/tenants
 * List all active tenants (public, minimal data)
 */
export async function GET() {
  try {
    const tenants = await listTenants();

    // Filter to only active tenants and return minimal data
    const publicTenants = tenants
      .filter(t => t.status === "active")
      .map(t => ({
        tenant_id: t.tenant_id,
        name: t.name,
      }));

    return NextResponse.json({
      success: true,
      tenants: publicTenants,
    });
  } catch (error) {
    console.error("List public tenants error:", error);
    return NextResponse.json(
      { error: "Failed to list tenants" },
      { status: 500 }
    );
  }
}
