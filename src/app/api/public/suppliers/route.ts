/**
 * /api/public/suppliers
 *
 * Public endpoint listing vetrina-listed tenants with enriched branding and company info.
 * No authentication required.
 */

import { NextResponse } from "next/server";
import { listVetrinaTenants } from "@/lib/services/vetrina.service";

/**
 * GET /api/public/suppliers
 * List all publicly listed suppliers with branding and company info
 */
export async function GET() {
  try {
    const tenants = await listVetrinaTenants();

    return NextResponse.json({
      success: true,
      suppliers: tenants,
      total: tenants.length,
    });
  } catch (error) {
    console.error("List public suppliers error:", error);
    return NextResponse.json(
      { error: "Failed to list suppliers" },
      { status: 500 }
    );
  }
}
