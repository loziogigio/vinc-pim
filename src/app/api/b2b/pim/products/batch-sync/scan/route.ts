import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { loadAdapterConfigs, SolrAdapter } from "@/lib/adapters";
import { isSolrEnabled } from "@/config/project.config";
import { computeSyncScan, getScanChannels } from "@/lib/services/solr-consolidation.service";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { PIMProduct } = await connectWithModels(auth.tenantDb);

    if (!isSolrEnabled()) {
      return NextResponse.json({ success: false, error: "Solr is not enabled", solr_available: false }, { status: 503 });
    }

    const configs = loadAdapterConfigs(auth.tenantId);
    const adapter = new SolrAdapter(configs.solr, auth.tenantDb);
    await adapter.initialize();

    const channels = await getScanChannels(PIMProduct as any);
    const scan = await computeSyncScan({ model: PIMProduct as any, adapter: adapter as any, channels });

    return NextResponse.json({ success: true, solr_available: true, scanned_at: new Date().toISOString(), ...scan });
  } catch (error: any) {
    console.error("Error in sync scan:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
