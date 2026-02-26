import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { renameB2CHomeTemplateVersion } from "@/lib/db/b2c-home-templates";

type RouteParams = { params: Promise<{ slug: string }> };

/**
 * PATCH /api/b2b/b2c/storefronts/[slug]/home-template/update-version
 * Rename a version label
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug } = await params;
    const { version, label } = await req.json();

    if (!version || typeof version !== "number") {
      return NextResponse.json({ error: "version is required (number)" }, { status: 400 });
    }

    const config = await renameB2CHomeTemplateVersion(
      slug,
      { version, label },
      auth.tenantDb
    );
    return NextResponse.json(config);
  } catch (error) {
    console.error("[PATCH .../update-version]", error);
    const message = error instanceof Error ? error.message : "Failed to update version";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
