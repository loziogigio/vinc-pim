import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { PIMProductModel } from "@/lib/db/models/pim-product";
import { SolrAdapter, loadAdapterConfigs } from "@/lib/adapters";

/**
 * POST /api/b2b/pim/products/[entity_code]/unpublish
 * Unpublish a product (set status to draft) and remove from Solr
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

    // Remove from Solr first (if enabled)
    let solrDeleted = false;
    const adapterConfigs = loadAdapterConfigs();
    if (adapterConfigs.solr?.enabled) {
      try {
        const solrAdapter = new SolrAdapter(adapterConfigs.solr);
        const result = await solrAdapter.deleteProduct(entity_code);
        solrDeleted = result.success;
        console.log(`🔍 Solr delete result for ${entity_code}:`, result);
      } catch (solrError: any) {
        console.error(`⚠️ Failed to delete from Solr: ${solrError.message}`);
        // Continue with unpublish even if Solr delete fails
      }
    }

    const product = await PIMProductModel.findOneAndUpdate(
      { entity_code, isCurrent: true },
      {
        $set: {
          status: "draft",
          isCurrentPublished: false,
          updated_at: new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    console.log(`📝 Unpublished product ${entity_code}${solrDeleted ? " (removed from Solr)" : ""}`);

    return NextResponse.json({
      success: true,
      product,
      solr_deleted: solrDeleted,
      message: "Product unpublished successfully",
    });
  } catch (error) {
    console.error("Error unpublishing product:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
