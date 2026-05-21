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
      // Unknown host → empty sitemap (consumer falls back to local generation).
      return NextResponse.json({
        baseUrl: `https://${host}`,
        langs: [],
        entries: [],
      });
    }

    const tenantDb = `vinc-${tenantId}`;
    const data = await buildB2BSitemapData(tenantDb, host, portalSlug);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[GET /api/public/b2b/sitemap-data]", error);
    return NextResponse.json({
      baseUrl: `https://${host}`,
      langs: [],
      entries: [],
    });
  }
}
