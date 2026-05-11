import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { publishB2BPageTemplate } from "@/lib/db/b2b-page-templates";
import { getRedis } from "@/lib/cache/redis-client";
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

    // Invalidate B2B cache
    try {
      await getRedis().publish(
        `vinc-b2b:cache-invalidate:${slug}`,
        `page-${pageSlug},site-config`
      );
    } catch (e) {
      console.warn("[publish] Failed to send cache invalidation:", (e as Error).message);
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("[POST /api/b2b/b2b/portals/[slug]/pages/[pageSlug]/template/publish]", error);
    const message = error instanceof Error ? error.message : "Failed to publish";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
