/**
 * Reindex the demo tenant's published catalog into Solr (in-process).
 * Assumes the default mongoose connection is already bound to the tenant DB
 * (connectToTenantDb), as in reset/provision.
 */
import { DEMO_TENANT_ID } from "./demo-config.js";

export async function reindexDemoSolr(): Promise<{ ok: number; fail: number }> {
  const { PIMProductModel } = await import("../../src/lib/db/models/pim-product.js");
  const { SolrAdapter, loadAdapterConfigs } = await import("../../src/lib/adapters/index.js");
  const cfg = loadAdapterConfigs(DEMO_TENANT_ID);
  const solr = new SolrAdapter(cfg.solr);
  await solr.initialize();
  const products = await PIMProductModel.find({ isCurrent: true, status: "published" }).lean();
  let ok = 0, fail = 0;
  for (const p of products) {
    try {
      const r = await solr.syncProduct(p as any);
      if (r?.success) { ok++; await PIMProductModel.updateOne({ _id: (p as any)._id }, { $set: { solr_indexed_at: new Date() } }); }
      else { fail++; console.log(`  ✗ ${(p as any).entity_code}: ${r?.message ?? "unknown"}`); }
    } catch (e: any) { fail++; console.log(`  ✗ ${(p as any).entity_code}: ${e?.message ?? e}`); }
  }
  console.log(`\n✅ Solr sync: ${ok} indexed, ${fail} failed.`);
  return { ok, fail };
}
