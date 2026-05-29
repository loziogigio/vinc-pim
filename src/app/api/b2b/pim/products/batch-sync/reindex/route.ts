import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { loadAdapterConfigs, SolrAdapter } from "@/lib/adapters";
import { isSolrEnabled } from "@/config/project.config";
import { createConsolidationLog, runConsolidation } from "@/lib/services/solr-consolidation.service";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    if (!isSolrEnabled()) {
      return NextResponse.json({ success: false, error: "Solr is not enabled" }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    const channel: string | undefined = body.channel || undefined;
    const entityCodes: string[] | undefined =
      Array.isArray(body.entity_codes) && body.entity_codes.length ? body.entity_codes : undefined;

    if (!channel && !entityCodes) {
      return NextResponse.json({ error: "Provide channel or entity_codes" }, { status: 400 });
    }

    const { PIMProduct, BatchSyncLog } = await connectWithModels(auth.tenantDb);
    const configs = loadAdapterConfigs(auth.tenantId);
    const adapter = new SolrAdapter(configs.solr, auth.tenantDb);
    await adapter.initialize();

    const { job_id } = await createConsolidationLog(BatchSyncLog as any, {
      startedBy: auth.userId || auth.authMethod,
      operation: "reindex",
      channel,
      entityCodesCount: entityCodes?.length,
    });

    void runConsolidation(BatchSyncLog as any, job_id, {
      model: PIMProduct as any,
      adapter: adapter as any,
      channel,
      entityCodes,
    }).catch((err) => console.error("[reindex] background job crashed:", err));

    return NextResponse.json({ success: true, job_id, status: "running" }, { status: 202 });
  } catch (error: any) {
    console.error("Error in reindex:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
