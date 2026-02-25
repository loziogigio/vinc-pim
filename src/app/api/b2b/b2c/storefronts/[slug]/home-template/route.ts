import { NextRequest, NextResponse } from "next/server";
import { initializeB2BRoute } from "@/lib/auth/b2b-helpers";
import {
  getB2CHomeTemplateConfig,
  loadB2CHomeTemplateVersion,
} from "@/lib/db/b2c-home-templates";

type RouteParams = { params: Promise<{ slug: string }> };

/**
 * GET /api/b2b/b2c/storefronts/[slug]/home-template
 * Load home template config for the builder.
 * Supports ?v=X to load a specific version.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await initializeB2BRoute(req);
    if ("error" in auth && auth.error) return auth.error;

    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const versionParam = searchParams.get("v");

    if (versionParam) {
      const version = parseInt(versionParam, 10);
      if (!isNaN(version) && version > 0) {
        const config = await loadB2CHomeTemplateVersion(slug, version, auth.tenantDb!);
        return NextResponse.json(config);
      }
    }

    const config = await getB2CHomeTemplateConfig(slug, auth.tenantDb!);
    return NextResponse.json(config);
  } catch (error) {
    console.error("[GET /api/b2b/b2c/.../home-template]", error);
    const message = error instanceof Error ? error.message : "Failed to load template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
