/**
 * GET /api/public/b2b/seo-config
 *
 * Public, domain/tenant-aware endpoint (seo-url spec §5.2). Returns the
 * per-tenant SEO / routing config the B2B storefront needs: category URL root
 * (default "categorie", optional per-locale overrides) + robots rules.
 *
 * Tenant is resolved from the Host / X-Forwarded-Host header. Missing config
 * fields fall back to safe defaults so the endpoint always returns 200.
 *
 * Response (§5.2):
 *   { categoryRoot: { default, [locale]: string },
 *     robots: { noindex, allow, disallow, sitemapUrl } }
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveTenantIdByHost } from "@/lib/tenant/host-resolver";
import {
  getSeoConfig,
  buildSeoConfig,
} from "@/lib/services/b2b-seo-config.service";
import { hostFromRequest } from "@/lib/tenant/request-host";

export const revalidate = 300;

export async function GET(req: NextRequest) {
  const host = hostFromRequest(req) || "localhost";
  try {
    const { searchParams } = new URL(req.url);
    const portalSlug = searchParams.get("portal") || undefined;

    const tenantId = await resolveTenantIdByHost(req);
    if (!tenantId) {
      // Unknown host → return safe defaults (consumer falls back gracefully).
      return NextResponse.json(buildSeoConfig(undefined, host));
    }

    const tenantDb = `vinc-${tenantId}`;
    const config = await getSeoConfig(tenantDb, host, portalSlug);
    return NextResponse.json(config);
  } catch (error) {
    console.error("[GET /api/public/b2b/seo-config]", error);
    return NextResponse.json(buildSeoConfig(undefined, host));
  }
}
