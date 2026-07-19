import { NextRequest, NextResponse } from "next/server";
import { verifyAPIKey } from "@/lib/auth/api-key-auth";
import { resolvePublicStorefront } from "@/lib/services/b2c-public-resolve";
import { connectWithModels } from "@/lib/db/connection";

/**
 * GET /api/b2b/b2c/public/pages
 *
 * Returns published pages list for a storefront (for navigation).
 * Auth: API key + Origin header (same as /public/home).
 *
 * Response: { pages: [{ slug, title, sort_order }] }
 */
export async function GET(req: NextRequest) {
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

    const resolved = await resolvePublicStorefront(req, tenantDb);
    if ("response" in resolved) return resolved.response;
    const storefront = resolved.storefront;

    const { B2CPage } = await connectWithModels(tenantDb);
    const pages = await B2CPage.find({
      storefront_slug: storefront.slug,
      status: "active",
      show_in_nav: true,
    })
      .sort({ sort_order: 1 })
      .select("slug title sort_order")
      .lean();

    return NextResponse.json({
      pages: pages.map((p: any) => ({
        slug: p.slug,
        title: p.title,
        sort_order: p.sort_order,
      })),
    });
  } catch (error) {
    console.error("[GET /api/b2b/b2c/public/pages]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
