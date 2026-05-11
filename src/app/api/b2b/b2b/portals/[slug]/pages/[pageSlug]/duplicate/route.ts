import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { duplicatePage } from "@/lib/services/b2b-page.service";
import {
  isTenantMigrated,
  NOT_MIGRATED_RESPONSE_BODY,
} from "@/lib/services/b2b-portal-migration-flag.service";

type RouteParams = { params: Promise<{ slug: string; pageSlug: string }> };

/**
 * POST /api/b2b/b2b/portals/[slug]/pages/[pageSlug]/duplicate
 * Duplicate a page with all its template content
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    if (!(await isTenantMigrated(auth.tenantId))) {
      return NextResponse.json(NOT_MIGRATED_RESPONSE_BODY, { status: 409 });
    }

    const { slug, pageSlug } = await params;
    const newPage = await duplicatePage(auth.tenantDb, slug, pageSlug);

    return NextResponse.json({ success: true, data: newPage }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/b2b/b2b/portals/[slug]/pages/[pageSlug]/duplicate]", error);
    const message = error instanceof Error ? error.message : "Failed to duplicate page";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
