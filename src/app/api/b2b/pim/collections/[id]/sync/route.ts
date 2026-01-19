import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { SolrAdapter, loadAdapterConfigs } from "@/lib/adapters";

/**
 * POST /api/b2b/pim/collections/[id]/sync
 * Sync all products associated with this collection to Solr
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { Collection: CollectionModel, PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

    const { id } = await params;

    // Get the collection
    const collection = await CollectionModel.findOne({
      collection_id: id,
    }).lean();

    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    // Check if Solr is enabled
    const adapterConfigs = loadAdapterConfigs();
    if (!adapterConfigs.solr?.enabled) {
      return NextResponse.json(
        { error: "Solr is not enabled" },
        { status: 400 }
      );
    }

    // First, refresh the collection data on all products
    // This ensures slug and other fields are up to date
    // Store as multilingual objects using collection's locale
    const locale = (collection as any).locale || "it";
    await PIMProductModel.updateMany(
      {
        "collections.collection_id": id,
        isCurrent: true,
      },
      {
        $set: {
          "collections.$.name": { [locale]: collection.name },
          "collections.$.slug": { [locale]: collection.slug },
        },
      }
    );

    // Get all products associated with this collection (with refreshed data)
    const products = await PIMProductModel.find({
      "collections.collection_id": id,
      isCurrent: true,
    }).lean();

    if (products.length === 0) {
      return NextResponse.json({
        success: true,
        synced: 0,
        message: "No products to sync",
      });
    }

    // Sync to Solr
    const solrAdapter = new SolrAdapter(adapterConfigs.solr);
    let syncedCount = 0;
    const errors: string[] = [];

    for (const product of products) {
      try {
        const result = await solrAdapter.syncProduct(product as any);
        if (result.success) {
          syncedCount++;
        } else {
          errors.push(`${product.entity_code}: ${result.error}`);
        }
      } catch (error: any) {
        errors.push(`${product.entity_code}: ${error.message}`);
      }
    }

    console.log(
      `🔄 Synced ${syncedCount}/${products.length} products to Solr for collection "${collection.name}"`
    );

    if (errors.length > 0) {
      console.warn(`⚠️ Sync errors:`, errors.slice(0, 10));
    }

    return NextResponse.json({
      success: true,
      synced: syncedCount,
      total: products.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (error) {
    console.error("Error syncing to Solr:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
