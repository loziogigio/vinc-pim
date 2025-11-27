import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { PIMProductModel } from "@/lib/db/models/pim-product";

/**
 * POST /api/b2b/pim/products/[entity_code]/publish
 * Publish a product (set status to published)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entity_code: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const resolvedParams = await params;
    const { entity_code } = resolvedParams;

    const product = await PIMProductModel.findOneAndUpdate(
      { entity_code, isCurrent: true },
      {
        $set: {
          status: "published",
          published_at: new Date(),
          isCurrentPublished: true,
          updated_at: new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    console.log(`✅ Published product ${entity_code}`);

    return NextResponse.json({
      success: true,
      product,
      message: "Product published successfully",
    });
  } catch (error) {
    console.error("Error publishing product:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
