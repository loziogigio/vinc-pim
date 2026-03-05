import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { publishB2CPageTemplate } from "@/lib/db/b2c-page-templates";
import { getRedis } from "@/lib/cache/redis-client";

type RouteParams = { params: Promise<{ slug: string; pageSlug: string }> };

/**
 * POST /api/b2b/b2c/storefronts/[slug]/pages/[pageSlug]/template/publish
 * Publish the page
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug, pageSlug } = await params;
    const config = await publishB2CPageTemplate(slug, pageSlug, auth.tenantDb);

    // Invalidate B2C cache
    try {
      await getRedis().publish(
        `vinc-b2c:cache-invalidate:${slug}`,
        `page-${pageSlug},site-config`
      );
    } catch (e) {
      console.warn("[publish] Failed to send cache invalidation:", (e as Error).message);
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("[POST .../publish]", error);
    const message = error instanceof Error ? error.message : "Failed to publish";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
