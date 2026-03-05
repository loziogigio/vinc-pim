/**
 * GET /api/b2b/pim/products/batch-sync/check?q=ENTITY_CODE_OR_SKU
 * Fast check: product sync status (MongoDB + Solr)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { loadAdapterConfigs, SolrAdapter } from "@/lib/adapters";
import { isSolrEnabled } from "@/config/project.config";
import {
  calculateCompletenessScore,
  findCriticalIssues,
} from "@/lib/pim/scorer";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const q = req.nextUrl.searchParams.get("q")?.trim();
    if (!q) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required (entity_code or SKU)" },
        { status: 400 }
      );
    }

    const { PIMProduct } = await connectWithModels(auth.tenantDb);

    // Find product by entity_code or SKU
    const product = await PIMProduct.findOne({
      isCurrent: true,
      $or: [{ entity_code: q }, { sku: q }],
    }).lean() as any;

    if (!product) {
      return NextResponse.json(
        { error: `Product not found for: ${q}` },
        { status: 404 }
      );
    }

    // Calculate current score
    const currentScore = calculateCompletenessScore(product);
    const currentIssues = findCriticalIssues(product);

    // Check Solr presence
    let inSolr = false;
    let solrScore: number | null = null;

    if (isSolrEnabled()) {
      try {
        const configs = loadAdapterConfigs(auth.tenantId);
        const adapter = new SolrAdapter(configs.solr);
        await adapter.initialize();

        const count = await adapter.countByQuery(
          `entity_code:"${product.entity_code}"`
        );
        inSolr = count > 0;

        // If in Solr, get the stored score
        if (inSolr) {
          const solrUrl = (configs.solr.custom_config as any)?.solr_url;
          const solrCore = (configs.solr.custom_config as any)?.solr_core;
          const selectUrl = `${solrUrl}/${solrCore}/select?q=entity_code:"${encodeURIComponent(product.entity_code)}"&fl=completeness_score&rows=1&wt=json`;
          const res = await fetch(selectUrl);
          if (res.ok) {
            const data = await res.json();
            const doc = data.response?.docs?.[0];
            solrScore = doc?.completeness_score ?? null;
          }
        }
      } catch (solrError: any) {
        console.error("Solr check failed:", solrError.message);
      }
    }

    const name = product.name;
    const displayName =
      typeof name === "string"
        ? name
        : name?.it || name?.en || Object.values(name || {})[0] || "";

    return NextResponse.json({
      success: true,
      product: {
        entity_code: product.entity_code,
        sku: product.sku,
        name: displayName,
        status: product.status,
        completeness_score: currentScore,
        stored_score: product.completeness_score ?? null,
        critical_issues: currentIssues,
        in_solr: inSolr,
        solr_score: solrScore,
        last_synced_at: product.analytics?.last_synced_at ?? null,
        score_drift: solrScore !== null ? currentScore - solrScore : null,
      },
    });
  } catch (error: any) {
    console.error("Error in batch-sync check:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
