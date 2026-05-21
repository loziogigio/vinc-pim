/**
 * GET /api/public/b2b/resolve-product?slug={slug}&lang={lang}
 *
 * Public, domain/tenant-aware endpoint (seo-url spec §5.1). Resolves a published
 * PIM product from its (per-locale) URL slug, scoped to the tenant identified by
 * the request host.
 *
 * Tenant is resolved from the Host / X-Forwarded-Host header (same mechanism as
 * the global host-resolver). No API key required — only published product
 * identity is returned.
 *
 * Response:
 *   200 { sku, parentSku, name, slug, categoryAncestors, found: true }
 *   404 { found: false }
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveTenantIdByHost } from "@/lib/tenant/host-resolver";
import { resolveProductBySlug } from "@/lib/services/b2b-product-resolver.service";

// Cacheable per spec §5.1 (revalidate + tenant tag handled by the consumer's fetch).
export const revalidate = 300;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = (searchParams.get("slug") || "").trim();
    const lang = (searchParams.get("lang") || "it").trim();

    if (!slug) {
      return NextResponse.json({ found: false }, { status: 404 });
    }

    const tenantId = await resolveTenantIdByHost(req);
    if (!tenantId) {
      return NextResponse.json({ found: false }, { status: 404 });
    }

    const tenantDb = `vinc-${tenantId}`;
    const result = await resolveProductBySlug(tenantDb, slug, lang);

    if (!result.found) {
      return NextResponse.json({ found: false }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/public/b2b/resolve-product]", error);
    // Degrade to "not found" rather than 500 so the storefront fallback kicks in.
    return NextResponse.json({ found: false }, { status: 404 });
  }
}
