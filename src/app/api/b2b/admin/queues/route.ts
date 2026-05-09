import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  TENANT_VISIBLE_QUEUES,
  countTenantJobsByState,
} from "@/lib/services/queue-monitor.service";

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const { tenantId } = auth;

  const queues = await Promise.all(
    TENANT_VISIBLE_QUEUES.map(async ({ id, label, queue }) => {
      const counts = await countTenantJobsByState(queue, tenantId);
      return { id, label, counts };
    })
  );

  return NextResponse.json({ queues });
}
