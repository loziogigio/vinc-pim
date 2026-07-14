/**
 * POST /api/b2b/feeds/destinations/[id]/sync — enqueue a manual feed sync
 */
import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getDestination } from "@/lib/services/feed-destination.service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const { id } = await params;
  const dest = await getDestination(auth.tenantDb, id);
  if (!dest) return NextResponse.json({ error: "Destination not found" }, { status: 404 });

  const { feedSyncQueue } = await import("@/lib/queue/queues");
  await feedSyncQueue.add("feed-sync", {
    tenantDb: auth.tenantDb,
    tenantId: auth.tenantId,
    destinationId: id,
    mode: "manual",
  });
  return NextResponse.json({ success: true, data: { queued: true } }, { status: 202 });
}
