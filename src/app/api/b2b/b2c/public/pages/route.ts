import { NextRequest, NextResponse } from "next/server";
import { verifyAPIKey } from "@/lib/auth/api-key-auth";
import { getStorefrontByDomain } from "@/lib/services/b2c-storefront.service";
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

    const origin = req.headers.get("origin") || req.headers.get("referer");
    if (!origin) {
      return NextResponse.json({ error: "Origin header is required" }, { status: 400 });
    }

    let domain: string;
    try {
      domain = new URL(origin).hostname;
    } catch {
      return NextResponse.json({ error: "Invalid Origin header" }, { status: 400 });
    }

    const storefront = await getStorefrontByDomain(tenantDb, domain);
    if (!storefront) {
      return NextResponse.json({ error: `No storefront found for domain "${domain}"` }, { status: 404 });
    }

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
