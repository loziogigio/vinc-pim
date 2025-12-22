import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { SynonymDictionaryModel } from "@/lib/db/models/synonym-dictionary";
import { PIMProductModel } from "@/lib/db/models/pim-product";
import { SolrAdapter, loadAdapterConfigs } from "@/lib/adapters";

/**
 * Sync products to Solr after synonym_keys change
 */
async function syncProductsToSolr(entityCodes: string[]): Promise<{ synced: number; errors: string[] }> {
  const adapterConfigs = loadAdapterConfigs();
  if (!adapterConfigs.solr?.enabled) {
    return { synced: 0, errors: ["Solr is not enabled"] };
  }

  const products = await PIMProductModel.find({
    entity_code: { $in: entityCodes },
    isCurrent: true,
  }).lean();

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

  return { synced: syncedCount, errors };
}

// GET /api/b2b/pim/synonym-dictionaries/[id]/products - List products with this dictionary
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session?.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    // Get the dictionary to find its key
    const dictionary = await SynonymDictionaryModel.findOne({
      dictionary_id: id,
    }).lean();

    if (!dictionary) {
      return NextResponse.json({ error: "Dictionary not found" }, { status: 404 });
    }

    // Build query for products
    const query: Record<string, unknown> = {
      isCurrent: true,
      synonym_keys: dictionary.key,
    };

    if (search) {
      query.$or = [
        { entity_code: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
        { "name.it": { $regex: search, $options: "i" } },
        { "name.en": { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const [products, total] = await Promise.all([
      PIMProductModel.find(query)
        .select("entity_code sku name images status")
        .sort({ entity_code: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PIMProductModel.countDocuments(query),
    ]);

    return NextResponse.json({
      products,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching dictionary products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

// POST /api/b2b/pim/synonym-dictionaries/[id]/products - Add products to dictionary
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session?.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { id } = await params;
    const body = await req.json();
    const { entity_codes } = body;

    if (!entity_codes || !Array.isArray(entity_codes) || entity_codes.length === 0) {
      return NextResponse.json(
        { error: "entity_codes array is required" },
        { status: 400 }
      );
    }

    // Get the dictionary
    const dictionary = await SynonymDictionaryModel.findOne({
      dictionary_id: id,
    });

    if (!dictionary) {
      return NextResponse.json({ error: "Dictionary not found" }, { status: 404 });
    }

    // Add the dictionary key to products (only if not already present)
    const result = await PIMProductModel.updateMany(
      {
        entity_code: { $in: entity_codes },
        isCurrent: true,
        synonym_keys: { $ne: dictionary.key },
      },
      { $addToSet: { synonym_keys: dictionary.key } }
    );

    // Update product count
    const newCount = await PIMProductModel.countDocuments({
      isCurrent: true,
      synonym_keys: dictionary.key,
    });
    dictionary.product_count = newCount;
    await dictionary.save();

    // Sync affected products to Solr
    let solrSync = { synced: 0, errors: [] as string[] };
    if (result.modifiedCount > 0) {
      solrSync = await syncProductsToSolr(entity_codes);
      console.log(`🔄 Synced ${solrSync.synced} products to Solr after adding to dictionary "${dictionary.key}"`);
    }

    return NextResponse.json({
      success: true,
      added: result.modifiedCount,
      message: `Added ${result.modifiedCount} product(s) to dictionary`,
      solrSync: {
        synced: solrSync.synced,
        errors: solrSync.errors.length > 0 ? solrSync.errors.slice(0, 5) : undefined,
      },
    });
  } catch (error) {
    console.error("Error adding products to dictionary:", error);
    return NextResponse.json(
      { error: "Failed to add products" },
      { status: 500 }
    );
  }
}

// DELETE /api/b2b/pim/synonym-dictionaries/[id]/products - Remove products from dictionary
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session?.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { id } = await params;
    const body = await req.json();
    const { entity_codes } = body;

    if (!entity_codes || !Array.isArray(entity_codes) || entity_codes.length === 0) {
      return NextResponse.json(
        { error: "entity_codes array is required" },
        { status: 400 }
      );
    }

    // Get the dictionary
    const dictionary = await SynonymDictionaryModel.findOne({
      dictionary_id: id,
    });

    if (!dictionary) {
      return NextResponse.json({ error: "Dictionary not found" }, { status: 404 });
    }

    // Remove the dictionary key from products
    const result = await PIMProductModel.updateMany(
      {
        entity_code: { $in: entity_codes },
        isCurrent: true,
      },
      { $pull: { synonym_keys: dictionary.key } }
    );

    // Update product count
    const newCount = await PIMProductModel.countDocuments({
      isCurrent: true,
      synonym_keys: dictionary.key,
    });
    dictionary.product_count = newCount;
    await dictionary.save();

    // Sync affected products to Solr
    let solrSync = { synced: 0, errors: [] as string[] };
    if (result.modifiedCount > 0) {
      solrSync = await syncProductsToSolr(entity_codes);
      console.log(`🔄 Synced ${solrSync.synced} products to Solr after removing from dictionary "${dictionary.key}"`);
    }

    return NextResponse.json({
      success: true,
      removed: result.modifiedCount,
      message: `Removed ${result.modifiedCount} product(s) from dictionary`,
      solrSync: {
        synced: solrSync.synced,
        errors: solrSync.errors.length > 0 ? solrSync.errors.slice(0, 5) : undefined,
      },
    });
  } catch (error) {
    console.error("Error removing products from dictionary:", error);
    return NextResponse.json(
      { error: "Failed to remove products" },
      { status: 500 }
    );
  }
}
