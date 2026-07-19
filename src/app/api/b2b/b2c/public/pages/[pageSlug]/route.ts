import { NextRequest, NextResponse } from "next/server";
import { verifyAPIKey } from "@/lib/auth/api-key-auth";
import { resolvePublicStorefront } from "@/lib/services/b2c-public-resolve";
import { getPublishedB2CPageTemplate, getLatestB2CPageTemplate } from "@/lib/db/b2c-page-templates";

type RouteParams = { params: Promise<{ pageSlug: string }> };

/**
 * GET /api/b2b/b2c/public/pages/[pageSlug]
 *
 * Returns published page content (blocks, seo) for a B2C frontend.
 * Auth: API key + Origin header.
 *
 * Response: { blocks, seo, version, publishedAt }
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const keyId = req.headers.get("x-api-key-id");
    const secret = req.headers.get("x-api-secret");
    if (!keyId || !secret) {
      return NextResponse.json({ error: "Missing API key credentials" }, { status: 401 });
    }

    const authResult = await verifyAPIKey(keyId, secret);
    if (!authResult.valid || !authResult.tenantId) {
      return NextResponse.json({ error: authResult.error || "Invalid API key" }, { status: 401 });
    }

    const tenantDb = `vinc-${authResult.tenantId}`;
    const { pageSlug } = await params;

    const resolved = await resolvePublicStorefront(req, tenantDb);
    if ("response" in resolved) return resolved.response;
    const storefront = resolved.storefront;

    const isPreview = req.nextUrl.searchParams.get("preview") === "true";
    const template = isPreview
      ? await getLatestB2CPageTemplate(storefront.slug, pageSlug, tenantDb)
      : await getPublishedB2CPageTemplate(storefront.slug, pageSlug, tenantDb);
    if (!template) {
      return NextResponse.json({ error: "Page not found or not published" }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("[GET /api/b2b/b2c/public/pages/[pageSlug]]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
