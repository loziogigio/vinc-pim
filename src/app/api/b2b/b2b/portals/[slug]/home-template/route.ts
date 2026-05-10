/**
 * GET /api/b2b/b2b/portals/[slug]/home-template
 *
 * Returns the home-template PageConfig for the specified portal.
 * Supports ?v=X query param to load a specific version as current
 * (mirrors the behaviour of /api/home-template GET).
 *
 * Response shape (mirrors src/app/api/home-template/route.ts):
 *   { slug, name, versions, currentVersion, currentPublishedVersion, createdAt, updatedAt }
 *
 * When no template exists yet for the portal, an empty shape is returned
 * (200 + empty versions array) rather than a 404 — the builder can
 * proceed to create content via the write routes (Task 16).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  getHomeTemplate,
  loadHomeTemplateVersion,
} from "@/lib/services/b2b-home-template.service";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug } = await ctx.params;

    const { searchParams } = new URL(req.url);
    const versionParam = searchParams.get("v");

    if (versionParam) {
      const version = parseInt(versionParam, 10);
      if (!isNaN(version) && version > 0) {
        const config = await loadHomeTemplateVersion(auth.tenantDb, slug, version);
        return NextResponse.json(config);
      }
    }

    const config = await getHomeTemplate(auth.tenantDb, slug);
    return NextResponse.json(config);
  } catch (error) {
    console.error("[GET /api/b2b/b2b/portals/[slug]/home-template]", error);
    return NextResponse.json({ error: "Failed to load home template" }, { status: 500 });
  }
}
