import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { saveB2CHomeTemplateDraft } from "@/lib/db/b2c-home-templates";
import { getRedis } from "@/lib/cache/redis-client";

type RouteParams = { params: Promise<{ slug: string }> };

/**
 * POST /api/b2b/b2c/storefronts/[slug]/home-template/save-draft
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug } = await params;
    const { blocks, seo } = await req.json();

    if (!Array.isArray(blocks)) {
      return NextResponse.json({ error: "blocks must be an array" }, { status: 400 });
    }

    const config = await saveB2CHomeTemplateDraft(slug, { blocks, seo }, auth.tenantDb);

    // If saving to the published version (hotfix), invalidate B2C cache
    if (config.currentPublishedVersion && config.currentVersion === config.currentPublishedVersion) {
      try {
        await getRedis().publish(`vinc-b2c:cache-invalidate:${slug}`, 'home-config,site-config');
      } catch (e) {
        console.warn('[save-draft] Failed to send cache invalidation:', (e as Error).message);
      }
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("[POST .../save-draft]", error);
    const message = error instanceof Error ? error.message : "Failed to save draft";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
