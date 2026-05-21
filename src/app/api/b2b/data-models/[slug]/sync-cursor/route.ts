/**
 * GET /api/b2b/data-models/[slug]/sync-cursor?relation_id=…&channel=…
 *
 * Returns the most recent record's import timestamp + external_ref for the
 * given (relation_id, channel) pair. Lets pusher scripts resume incrementally:
 *
 *   { most_recent_imported_at, most_recent_external_ref, count }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { loadDefinition } from "@/lib/data-models/load-definition";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug } = await params;
    const loaded = await loadDefinition(auth.tenantDb, slug, { requireEnabled: false });
    if (!loaded.ok) return loaded.response;
    const { definition, RecordModel } = loaded.loaded;

    const url = new URL(req.url);
    const relationId = url.searchParams.get("relation_id");
    if (!relationId) {
      return NextResponse.json({ error: "relation_id is required" }, { status: 400 });
    }
    const channel = url.searchParams.get("channel") || definition.channel;

    const filter: Record<string, unknown> = { relation_id: relationId };
    if (channel && channel !== "*") {
      filter.channel = channel;
    }

    const [latest, count] = await Promise.all([
      RecordModel.findOne(filter)
        .sort({ imported_at: -1, _id: -1 })
        .select({ imported_at: 1, external_ref: 1, _id: 0 })
        .lean(),
      RecordModel.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        most_recent_imported_at: latest?.imported_at ?? null,
        most_recent_external_ref: latest?.external_ref ?? null,
        count,
      },
    });
  } catch (error) {
    console.error("[GET .../sync-cursor]", error);
    const message = error instanceof Error ? error.message : "Failed to read sync cursor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
