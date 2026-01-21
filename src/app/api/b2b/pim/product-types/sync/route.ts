import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { SolrAdapter, loadAdapterConfigs } from "@/lib/adapters";

/**
 * POST /api/b2b/pim/product-types/sync
 * Bulk sync all ProductType data (including code) to all associated products
 * Also re-indexes products in Solr if enabled
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session?.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { ProductType: ProductTypeModel, PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

    // Check if Solr is enabled
    const adapterConfigs = loadAdapterConfigs();
    const solrEnabled = adapterConfigs.solr?.enabled;
    let solrAdapter: SolrAdapter | null = null;
    if (solrEnabled) {
      solrAdapter = new SolrAdapter(adapterConfigs.solr);
    }

    // Get all ProductTypes
    const productTypes = await ProductTypeModel.find({}).lean() as any[];

    let totalModified = 0;
    let totalMatched = 0;
    let totalSolrSynced = 0;
    const results: { productTypeId: string; name: string; modified: number; solrSynced?: number }[] = [];

    for (const productType of productTypes) {
      const productTypeId = productType.product_type_id;

      // Build the update data
      const updateData: Record<string, unknown> = {
        "product_type.product_type_id": productTypeId,
        "product_type.name": productType.name,
        "product_type.slug": productType.slug,
      };

      // Include code if present
      if (productType.code) {
        updateData["product_type.code"] = productType.code;
      }

      // Find and update all products with this product type
      const query = {
        isCurrent: true,
        $or: [
          { "product_type.product_type_id": productTypeId },
          { "product_type.id": productTypeId },
        ],
      };

      const result = await PIMProductModel.updateMany(query, { $set: updateData });

      // Re-index in Solr if enabled and products were matched
      let solrSynced = 0;
      if (solrAdapter && result.matchedCount > 0) {
        const products = await PIMProductModel.find(query).lean();
        for (const product of products) {
          try {
            const syncResult = await solrAdapter.syncProduct(product as any);
            if (syncResult.success) {
              solrSynced++;
              totalSolrSynced++;
            }
          } catch (error) {
            // Log but don't fail the overall sync
            console.error(`Failed to sync product ${product.entity_code} to Solr:`, error);
          }
        }
      }

      if (result.modifiedCount > 0 || solrSynced > 0) {
        const name = typeof productType.name === "string"
          ? productType.name
          : productType.name?.it || productType.name?.en || "Unknown";

        results.push({
          productTypeId,
          name,
          modified: result.modifiedCount,
          solrSynced: solrEnabled ? solrSynced : undefined,
        });
      }

      totalModified += result.modifiedCount;
      totalMatched += result.matchedCount;
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${totalMatched} product(s) across ${productTypes.length} product type(s)${totalSolrSynced > 0 ? `, ${totalSolrSynced} indexed in Solr` : ""}`,
      totalModified,
      totalMatched,
      productTypesUpdated: results.length,
      solr: solrEnabled ? { synced: totalSolrSynced } : undefined,
      details: results,
    });
  } catch (error: any) {
    console.error("Error bulk syncing product types:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync product types" },
      { status: 500 }
    );
  }
}
