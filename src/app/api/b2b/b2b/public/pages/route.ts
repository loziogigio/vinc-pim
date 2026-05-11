import { NextRequest, NextResponse } from "next/server";
import { verifyAPIKey } from "@/lib/auth/api-key-auth";
import { getPortalByDomain } from "@/lib/services/b2b-portal.service";
import { connectWithModels } from "@/lib/db/connection";

/**
 * GET /api/b2b/b2b/public/pages
 *
 * Returns active nav pages for a B2B portal (for navigation menus).
 * Auth: API key + Origin header → portal lookup by domain.
 *
 * Headers:
 *   x-api-key-id: ak_{tenant}_{key}
 *   x-api-secret: sk_{secret}
 *   origin: https://portal.example.com
 *
 * Response: { pages: [{ slug, title, sort_order }] }
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate tenant via API key
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

    // 2. Resolve portal by Origin header → domain match
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

    const portal = await getPortalByDomain(tenantDb, domain);
    if (!portal) {
      return NextResponse.json({ error: `No portal found for domain "${domain}"` }, { status: 404 });
    }

    // 3. Fetch active nav pages for this portal, sorted by sort_order then title
    const { B2BPage } = await connectWithModels(tenantDb);
    const pages = await B2BPage.find({
      portal_slug: portal.slug,
      status: "active",
      show_in_nav: true,
    })
      .sort({ sort_order: 1, title: 1 })
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
    console.error("[GET /api/b2b/b2b/public/pages]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
