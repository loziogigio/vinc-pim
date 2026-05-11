import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { publishB2BPageTemplate } from "@/lib/db/b2b-page-templates";
import { invalidateB2BCache } from "@/lib/cache/redis-client";
import {
  isTenantMigrated,
  NOT_MIGRATED_RESPONSE_BODY,
} from "@/lib/services/b2b-portal-migration-flag.service";

type RouteParams = { params: Promise<{ slug: string; pageSlug: string }> };

/**
 * POST /api/b2b/b2b/portals/[slug]/pages/[pageSlug]/template/publish
 * Publish a B2B portal page
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    if (!(await isTenantMigrated(auth.tenantId))) {
      return NextResponse.json(NOT_MIGRATED_RESPONSE_BODY, { status: 409 });
    }

    const { slug, pageSlug } = await params;
    const config = await publishB2BPageTemplate(slug, pageSlug, auth.tenantDb);

    void invalidateB2BCache(auth.tenantId, [`page:${pageSlug}`, "sitemap"]);

    return NextResponse.json(config);
  } catch (error) {
    console.error("[POST /api/b2b/b2b/portals/[slug]/pages/[pageSlug]/template/publish]", error);
    const message = error instanceof Error ? error.message : "Failed to publish";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
