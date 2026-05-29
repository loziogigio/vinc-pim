import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { isSolrEnabled } from "@/config/project.config";
import { syncQueue } from "@/lib/queue/queues";

/**
 * POST /api/b2b/pim/synonym-dictionaries/[id]/sync
 * Queue all products using this dictionary for batched Solr re-index
 * (so synonym_terms_text_* are refreshed). Uses the same BullMQ batch path
 * as ERP imports — async, 50 products/batch, one commit per batch.
 */
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
    if (!isSolrEnabled()) {
      return NextResponse.json({ error: "Solr is not enabled" }, { status: 400 });
    }

    // Collect entity_codes of every product using this dictionary
    const products = await PIMProductModel.find(
      { synonym_keys: dictionary.key, isCurrent: true },
      { entity_code: 1 }
    ).lean();
    const entityCodes = (products as any[])
      .map((p) => p.entity_code)
      .filter(Boolean);

    if (entityCodes.length === 0) {
      return NextResponse.json({
        success: true,
        queued: 0,
        batches: 0,
        message: "No products to sync",
      });
    }

    // Queue batched Solr sync jobs (50/batch) — same path the ERP import uses.
    // The sync worker builds a tenant-scoped adapter, so synonym_terms_text_*
    // are re-derived and indexed in bulk (one commit per batch, async).
    const SYNC_BATCH_SIZE = 50;
    const stamp = Date.now();
    let batches = 0;
    for (let i = 0; i < entityCodes.length; i += SYNC_BATCH_SIZE) {
      const batchIds = entityCodes.slice(i, i + SYNC_BATCH_SIZE);
      batches += 1;
      await syncQueue.add(
        "bulk-sync-batch",
        {
          product_id: `synonym-${id}-${stamp}-${batches}`,
          product_ids: batchIds,
          operation: "bulk-sync",
          channels: ["solr"],
          tenant_id: tenantId,
          priority: "high",
        },
        { priority: 1 }
      );
    }

    console.log(
      `Queued ${batches} Solr sync batch(es) for ${entityCodes.length} products (dictionary "${dictionary.key}")`
    );

    return NextResponse.json(
      { success: true, status: "queued", queued: entityCodes.length, batches },
      { status: 202 }
    );
  } catch (error) {
    console.error("Error syncing to Solr:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
