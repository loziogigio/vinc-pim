import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connection";
import { PIMProductModel } from "@/lib/db/models/pim-product";

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
    await connectToDatabase();

    // Get wholesaler_id from session/auth (for now using query param)
    const wholesaler_id = req.nextUrl.searchParams.get("wholesaler_id") || "6900ac2364787f6f09231006";

    // Get all versions of this product, sorted by version descending
    const versions = await PIMProductModel.find({
      wholesaler_id,
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
