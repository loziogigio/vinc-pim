import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { loadAdapterConfigs, SolrAdapter } from "@/lib/adapters";
import { isSolrEnabled } from "@/config/project.config";
import { listGapDetail } from "@/lib/services/solr-consolidation.service";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const sp = req.nextUrl.searchParams;
    const channel = sp.get("channel") || undefined;
    const type = sp.get("type") === "stale" ? "stale" : "missing";
    const page = Math.max(1, parseInt(sp.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "20")));
    const q = sp.get("q")?.trim() || undefined;

    const { PIMProduct } = await connectWithModels(auth.tenantDb);

    // Stale needs Solr; missing does not.
    let adapter: any = { fetchAllEntityCodes: async () => [] };
    if (type === "stale") {
      if (!isSolrEnabled()) {
        return NextResponse.json({ success: false, error: "Solr is not enabled" }, { status: 503 });
      }
      const configs = loadAdapterConfigs(auth.tenantId);
      adapter = new SolrAdapter(configs.solr, auth.tenantDb);
      await adapter.initialize();
    }

    const result = await listGapDetail({ model: PIMProduct as any, adapter, channel, type, page, limit, q });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Error in sync scan detail:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
