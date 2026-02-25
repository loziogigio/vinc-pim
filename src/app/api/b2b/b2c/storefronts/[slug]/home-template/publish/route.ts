import { NextRequest, NextResponse } from "next/server";
import { initializeB2BRoute } from "@/lib/auth/b2b-helpers";
import { publishB2CHomeTemplate } from "@/lib/db/b2c-home-templates";

type RouteParams = { params: Promise<{ slug: string }> };

/**
 * POST /api/b2b/b2c/storefronts/[slug]/home-template/publish
 * Publish the current draft version
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await initializeB2BRoute(req);
    if ("error" in auth && auth.error) return auth.error;

    const { slug } = await params;
    const metadata = await req.json().catch(() => ({}));

    const config = await publishB2CHomeTemplate(slug, metadata, auth.tenantDb!);
    return NextResponse.json(config);
  } catch (error) {
    console.error("[POST .../publish]", error);
    const message = error instanceof Error ? error.message : "Failed to publish";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
