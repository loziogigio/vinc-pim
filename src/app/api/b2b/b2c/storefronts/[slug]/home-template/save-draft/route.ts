import { NextRequest, NextResponse } from "next/server";
import { initializeB2BRoute } from "@/lib/auth/b2b-helpers";
import { saveB2CHomeTemplateDraft } from "@/lib/db/b2c-home-templates";

type RouteParams = { params: Promise<{ slug: string }> };

/**
 * POST /api/b2b/b2c/storefronts/[slug]/home-template/save-draft
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await initializeB2BRoute(req);
    if ("error" in auth && auth.error) return auth.error;

    const { slug } = await params;
    const { blocks, seo } = await req.json();

    if (!Array.isArray(blocks)) {
      return NextResponse.json({ error: "blocks must be an array" }, { status: 400 });
    }

    const config = await saveB2CHomeTemplateDraft(slug, { blocks, seo }, auth.tenantDb!);
    return NextResponse.json(config);
  } catch (error) {
    console.error("[POST .../save-draft]", error);
    const message = error instanceof Error ? error.message : "Failed to save draft";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
