import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getB2CPageTemplateConfig } from "@/lib/db/b2c-page-templates";

type RouteParams = { params: Promise<{ slug: string; pageSlug: string }> };

/**
 * GET /api/b2b/b2c/storefronts/[slug]/pages/[pageSlug]/template
 * Get page template config for the builder
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug, pageSlug } = await params;
    const config = await getB2CPageTemplateConfig(slug, pageSlug, auth.tenantDb);

    return NextResponse.json(config);
  } catch (error) {
    console.error("[GET .../template]", error);
    const message = error instanceof Error ? error.message : "Failed to get template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
