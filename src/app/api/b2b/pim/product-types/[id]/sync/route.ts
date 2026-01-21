import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { SolrAdapter, loadAdapterConfigs } from "@/lib/adapters";

/**
 * POST /api/b2b/pim/product-types/[id]/sync
 * Sync ProductType data (including code) to all associated products
 * Also re-indexes products in Solr if enabled
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session?.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { ProductType: ProductTypeModel, PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);
    const { id: productTypeId } = await params;

    // Get the ProductType
    const productType = await ProductTypeModel.findOne({
      product_type_id: productTypeId,
    }).lean() as any;

    if (!productType) {
      return NextResponse.json({ error: "Product type not found" }, { status: 404 });
    }

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

    // Re-index in Solr if enabled
    let solrSynced = 0;
    let solrErrors: string[] = [];
    const adapterConfigs = loadAdapterConfigs();

    if (adapterConfigs.solr?.enabled && result.matchedCount > 0) {
      // Fetch updated products for Solr indexing
      const products = await PIMProductModel.find(query).lean();

      const solrAdapter = new SolrAdapter(adapterConfigs.solr);

      for (const product of products) {
        try {
          const syncResult = await solrAdapter.syncProduct(product as any);
          if (syncResult.success) {
            solrSynced++;
          } else {
            solrErrors.push(`${product.entity_code}: ${syncResult.message}`);
          }
        } catch (error: any) {
          solrErrors.push(`${product.entity_code}: ${error.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${result.modifiedCount} product(s)${solrSynced > 0 ? `, ${solrSynced} indexed in Solr` : ""}`,
      modified: result.modifiedCount,
      matched: result.matchedCount,
      solr: adapterConfigs.solr?.enabled ? { synced: solrSynced, errors: solrErrors.length > 0 ? solrErrors.slice(0, 5) : undefined } : undefined,
    });
  } catch (error: any) {
    console.error("Error syncing product type:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync product type" },
      { status: 500 }
    );
  }
}
