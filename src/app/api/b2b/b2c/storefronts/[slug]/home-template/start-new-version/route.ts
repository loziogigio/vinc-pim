import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { startNewB2CHomeTemplateVersion } from "@/lib/db/b2c-home-templates";

type RouteParams = { params: Promise<{ slug: string }> };

/**
 * POST /api/b2b/b2c/storefronts/[slug]/home-template/start-new-version
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug } = await params;
    const config = await startNewB2CHomeTemplateVersion(slug, auth.tenantDb);
    return NextResponse.json(config);
  } catch (error) {
    console.error("[POST .../start-new-version]", error);
    const message = error instanceof Error ? error.message : "Failed to start new version";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
