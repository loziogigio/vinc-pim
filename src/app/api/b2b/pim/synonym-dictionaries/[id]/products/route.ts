import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { syncQueue } from "@/lib/queue/queues";
import { isSolrEnabled } from "@/config/project.config";
import { safeRegexQuery } from "@/lib/security";

/**
 * Queue batched Solr re-sync for products whose synonym_keys changed.
 * Uses the BullMQ syncQueue (50/batch) — async, one commit per batch, like ERP imports.
 */
async function syncProductsToSolr(
  entityCodes: string[],
  tenantId: string,
  dictionaryKey: string
): Promise<{ queued: number; batches: number }> {
  if (!isSolrEnabled() || entityCodes.length === 0) {
    return { queued: 0, batches: 0 };
  }

  const SYNC_BATCH_SIZE = 50;
  const stamp = Date.now();
  let batches = 0;
  for (let i = 0; i < entityCodes.length; i += SYNC_BATCH_SIZE) {
    const batchIds = entityCodes.slice(i, i + SYNC_BATCH_SIZE);
    batches += 1;
    await syncQueue.add(
      "bulk-sync-batch",
      {
        product_id: `synonym-${dictionaryKey}-${stamp}-${batches}`,
        product_ids: batchIds,
        operation: "bulk-sync",
        channels: ["solr"],
        tenant_id: tenantId,
        priority: "high",
      },
      { priority: 1 }
    );
  }
  return { queued: entityCodes.length, batches };
}

// GET /api/b2b/pim/synonym-dictionaries/[id]/products - List products with this dictionary
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const { tenantDb } = auth;
  try {
    const { SynonymDictionary: SynonymDictionaryModel, PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));

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
      const safeSearch = safeRegexQuery(search);
      query.$or = [
        { entity_code: safeSearch },
        { sku: safeSearch },
        { "name.it": safeSearch },
        { "name.en": safeSearch },
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
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const { tenantDb, tenantId } = auth;
  try {
    const { SynonymDictionary: SynonymDictionaryModel, PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

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

    // Queue affected products for batched Solr re-sync
    let solrSync = { queued: 0, batches: 0 };
    if (result.modifiedCount > 0) {
      solrSync = await syncProductsToSolr(entity_codes, tenantId, dictionary.key);
      console.log(`Queued ${solrSync.queued} products for Solr sync after adding to dictionary "${dictionary.key}"`);
    }

    return NextResponse.json({
      success: true,
      added: result.modifiedCount,
      message: `Added ${result.modifiedCount} product(s) to dictionary`,
      solrSync,
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
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const { tenantDb, tenantId } = auth;
  try {
    const { SynonymDictionary: SynonymDictionaryModel, PIMProduct: PIMProductModel } = await connectWithModels(tenantDb);

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

    // Queue affected products for batched Solr re-sync
    let solrSync = { queued: 0, batches: 0 };
    if (result.modifiedCount > 0) {
      solrSync = await syncProductsToSolr(entity_codes, tenantId, dictionary.key);
      console.log(`Queued ${solrSync.queued} products for Solr sync after removing from dictionary "${dictionary.key}"`);
    }

    return NextResponse.json({
      success: true,
      removed: result.modifiedCount,
      message: `Removed ${result.modifiedCount} product(s) from dictionary`,
      solrSync,
    });
  } catch (error) {
    console.error("Error removing products from dictionary:", error);
    return NextResponse.json(
      { error: "Failed to remove products" },
      { status: 500 }
    );
  }
}
