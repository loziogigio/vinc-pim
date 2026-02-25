/**
 * /api/b2b/vetrina/tenants
 *
 * List tenants that have opted-in to the vetrina listing.
 * Returns profile card data (branding + company_info) for each listed tenant.
 *
 * Supports: API Key, Bearer Token, B2B Session
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { listVetrinaTenants } from "@/lib/services/vetrina.service";

/**
 * GET /api/b2b/vetrina/tenants
 * List all publicly listed tenants with their profile data
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const tenants = await listVetrinaTenants();

    return NextResponse.json({
      success: true,
      tenants,
      total: tenants.length,
    });
  } catch (error) {
    console.error("List vetrina tenants error:", error);
    return NextResponse.json(
      { error: "Failed to list vetrina tenants" },
      { status: 500 }
    );
  }
}
