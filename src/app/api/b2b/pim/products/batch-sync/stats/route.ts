/**
 * GET /api/b2b/pim/products/batch-sync/stats
 * Returns Solr vs MongoDB sync status overview
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { loadAdapterConfigs, SolrAdapter } from "@/lib/adapters";
import { isSolrEnabled } from "@/config/project.config";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { PIMProduct } = await connectWithModels(auth.tenantDb);

    // MongoDB counts
    const [publishedCount, totalCurrentCount] = await Promise.all([
      PIMProduct.countDocuments({ isCurrent: true, status: "published" }),
      PIMProduct.countDocuments({ isCurrent: true }),
    ]);

    // Solr count
    let solrCount = 0;
    let solrAvailable = false;

    if (isSolrEnabled()) {
      try {
        const configs = loadAdapterConfigs(auth.tenantId);
        const adapter = new SolrAdapter(configs.solr);
        await adapter.initialize();
        solrCount = await adapter.countByQuery("*:*");
        solrAvailable = true;
      } catch (err: any) {
        console.error("Solr stats check failed:", err.message);
      }
    }

    // Stale = Solr has more than published (orphaned docs)
    const staleCount = Math.max(0, solrCount - publishedCount);
    // Missing = published products not yet in Solr
    const missingFromSolr = Math.max(0, publishedCount - solrCount);
    const inSync = solrAvailable && solrCount === publishedCount;

    return NextResponse.json({
      success: true,
      stats: {
        mongo_published: publishedCount,
        mongo_total: totalCurrentCount,
        solr_indexed: solrCount,
        solr_available: solrAvailable,
        stale_estimate: staleCount,
        missing_from_solr: missingFromSolr,
        in_sync: inSync,
      },
    });
  } catch (error: any) {
    console.error("Error in batch-sync stats:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
