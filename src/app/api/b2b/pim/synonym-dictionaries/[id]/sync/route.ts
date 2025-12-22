import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { SynonymDictionaryModel } from "@/lib/db/models/synonym-dictionary";
import { PIMProductModel } from "@/lib/db/models/pim-product";
import { SolrAdapter, loadAdapterConfigs } from "@/lib/adapters";

/**
 * POST /api/b2b/pim/synonym-dictionaries/[id]/sync
 * Sync all products associated with this dictionary to Solr
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { id } = await params;

    // Get the dictionary
    const dictionary = await SynonymDictionaryModel.findOne({
      dictionary_id: id,
    }).lean();

    if (!dictionary) {
      return NextResponse.json(
        { error: "Dictionary not found" },
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

    // Get all products associated with this dictionary
    const products = await PIMProductModel.find({
      synonym_keys: dictionary.key,
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
      `🔄 Synced ${syncedCount}/${products.length} products to Solr for dictionary "${dictionary.key}"`
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
