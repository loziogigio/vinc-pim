import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { getB2BSession } from "@/lib/auth/b2b-session";

/**
 * GET /api/b2b/pim/products/[entity_code]/history
 * Get all versions of a product
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entity_code: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { entity_code } = await params;
    const tenantDb = `vinc-${session.tenantId}`;
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
