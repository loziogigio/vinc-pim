/**
 * GET /api/public/b2b/sitemap-data
 *
 * Public, domain/tenant-aware endpoint (seo-url spec §5.3). Returns the
 * structured sitemap payload the B2B storefront turns into sitemap.xml:
 * products as flat slug URLs per locale, categories as
 * `/{lang}/{categoryRoot}/{path}`, CMS pages, and static routes.
 *
 * Tenant is resolved from the Host / X-Forwarded-Host header.
 *
 * Response (§5.3):
 *   { baseUrl, langs, entries: [{ loc, type, changefreq?, priority?, lastmod? }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveTenantIdByHost } from "@/lib/tenant/host-resolver";
import { buildB2BSitemapData } from "@/lib/services/b2b-sitemap.service";
import { hostFromRequest } from "@/lib/tenant/request-host";

export const revalidate = 300;

export async function GET(req: NextRequest) {
  const host = hostFromRequest(req) || "localhost";
  try {
    const { searchParams } = new URL(req.url);
    const portalSlug = searchParams.get("portal") || undefined;

    const tenantId = await resolveTenantIdByHost(req);
    if (!tenantId) {
      // A non-2xx response tells vinc-b2b this is unavailable, rather than an
      // authoritative empty sitemap (which is reserved for inactive portals).
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 },
      );
    }

    const tenantDb = `vinc-${tenantId}`;
    const data = await buildB2BSitemapData(tenantDb, host, portalSlug);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[GET /api/public/b2b/sitemap-data]", error);
    return NextResponse.json(
      { error: "B2B sitemap is temporarily unavailable" },
      { status: 503 },
    );
  }
}
