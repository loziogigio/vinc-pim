import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { headers } from "next/headers";

/**
 * GET /api/admin/pim/products/[entity_code]/history
 * Get all versions of a product
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entity_code: string }> }
) {
  try {
    const { entity_code } = await params;

    // Determine tenant database from headers or session
    let tenantDb: string | null = null;

    // Try headers first (middleware-provided)
    const headersList = await headers();
    const tenantDbHeader = headersList.get("x-resolved-tenant-db");
    const tenantIdHeader = headersList.get("x-resolved-tenant-id");

    if (tenantDbHeader) {
      tenantDb = tenantDbHeader;
    } else if (tenantIdHeader) {
      tenantDb = `vinc-${tenantIdHeader}`;
    } else {
      // Fall back to session
      const session = await getB2BSession();
      if (session.isLoggedIn && session.tenantId) {
        tenantDb = `vinc-${session.tenantId}`;
      }
    }

    if (!tenantDb) {
      return NextResponse.json(
        { error: "No tenant context available" },
        { status: 401 }
      );
    }

    // Get tenant-specific models from connection pool
    const { PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

    // No wholesaler_id - database provides isolation

    // Get all versions of this product, sorted by version descending
    const versions = await PIMProductModel.find({
      entity_code,
    })
      .sort({ version: -1 })
      .lean();

    if (versions.length === 0) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      versions,
      total: versions.length,
    });
  } catch (error: any) {
    console.error("Error fetching product history:", error);
    return NextResponse.json(
      { error: "Failed to fetch product history", details: error.message },
      { status: 500 }
    );
  }
}
