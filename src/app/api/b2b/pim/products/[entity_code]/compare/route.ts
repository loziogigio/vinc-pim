import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { PIMProductModel } from "@/lib/db/models/pim-product";
import { compareVersions } from "@/lib/pim/version-comparison";

/**
 * GET /api/b2b/pim/products/[entity_code]/compare?v1=1&v2=2
 * Compare two versions of a product
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entity_code: string }> }
) {
  try {
    // Auth check
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { entity_code } = await params;
    const searchParams = req.nextUrl.searchParams;
    const v1 = parseInt(searchParams.get("v1") || "0");
    const v2 = parseInt(searchParams.get("v2") || "0");

    if (!v1 || !v2) {
      return NextResponse.json(
        { error: "Both v1 and v2 query parameters are required" },
        { status: 400 }
      );
    }

    if (v1 === v2) {
      return NextResponse.json(
        { error: "Cannot compare a version with itself" },
        { status: 400 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Fetch both versions
    const [version1, version2] = await Promise.all([
      PIMProductModel.findOne({
        entity_code,
        wholesaler_id: session.userId,
        version: v1,
      }).lean(),
      PIMProductModel.findOne({
        entity_code,
        wholesaler_id: session.userId,
        version: v2,
      }).lean(),
    ]);

    if (!version1 || !version2) {
      return NextResponse.json(
        { error: "One or both versions not found" },
        { status: 404 }
      );
    }

    // Compare versions
    const comparison = compareVersions(version1 as any, version2 as any);

    // Type cast to fix lean() return type
    const ver1 = version1 as any;
    const ver2 = version2 as any;

    return NextResponse.json({
      comparison,
      version1: {
        version: ver1.version,
        created_at: ver1.created_at,
        manually_edited: ver1.manually_edited,
        edited_by: ver1.edited_by,
        source: ver1.source,
      },
      version2: {
        version: ver2.version,
        created_at: ver2.created_at,
        manually_edited: ver2.manually_edited,
        edited_by: ver2.edited_by,
        source: ver2.source,
      },
    });
  } catch (error) {
    console.error("Error comparing versions:", error);
    return NextResponse.json(
      {
        error: "Failed to compare versions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
