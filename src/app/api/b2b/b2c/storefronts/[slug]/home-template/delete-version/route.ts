import { NextRequest, NextResponse } from "next/server";
import { initializeB2BRoute } from "@/lib/auth/b2b-helpers";
import { deleteB2CHomeTemplateVersion } from "@/lib/db/b2c-home-templates";

type RouteParams = { params: Promise<{ slug: string }> };

/**
 * POST /api/b2b/b2c/storefronts/[slug]/home-template/delete-version
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await initializeB2BRoute(req);
    if ("error" in auth && auth.error) return auth.error;

    const { slug } = await params;
    const { version } = await req.json();

    if (!version || typeof version !== "number") {
      return NextResponse.json({ error: "version is required (number)" }, { status: 400 });
    }

    const config = await deleteB2CHomeTemplateVersion(slug, version, auth.tenantDb!);
    return NextResponse.json(config);
  } catch (error) {
    console.error("[POST .../delete-version]", error);
    const message = error instanceof Error ? error.message : "Failed to delete version";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
