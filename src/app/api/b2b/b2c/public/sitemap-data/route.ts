import { NextRequest, NextResponse } from "next/server";
import { verifyAPIKey } from "@/lib/auth/api-key-auth";
import { getStorefrontByDomain } from "@/lib/services/b2c-storefront.service";
import { getSitemapData, DEFAULT_ROBOTS_DISALLOW } from "@/lib/services/b2c-sitemap.service";

/**
 * GET /api/b2b/b2c/public/sitemap-data
 *
 * Returns structured sitemap data (JSON) for the B2C frontend to
 * generate sitemap.xml and robots.txt on its side.
 *
 * Headers:
 *   x-api-key-id: ak_{tenant}_{key}
 *   x-api-secret: sk_{secret}
 *   Origin: https://shop.example.com
 *
 * Response:
 *   {
 *     urls: ISitemapUrl[],
 *     robots_config: { custom_rules, disallow },
 *     stats: ISitemapStats,
 *     storefront: { slug, primary_domain }
 *   }
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate tenant via API key
    const keyId = req.headers.get("x-api-key-id");
    const secret = req.headers.get("x-api-secret");
    if (!keyId || !secret) {
      return NextResponse.json(
        { error: "Missing API key credentials" },
        { status: 401 }
      );
    }

    const authResult = await verifyAPIKey(keyId, secret);
    if (!authResult.valid || !authResult.tenantId) {
      return NextResponse.json(
        { error: authResult.error || "Invalid API key" },
        { status: 401 }
      );
    }

    const tenantDb = `vinc-${authResult.tenantId}`;

    // 2. Extract domain from Origin header
    const origin = req.headers.get("origin") || req.headers.get("referer");
    if (!origin) {
      return NextResponse.json(
        { error: "Origin header is required to identify the storefront" },
        { status: 400 }
      );
    }

    let domain: string;
    try {
      const url = new URL(origin);
      domain = url.hostname;
    } catch {
      return NextResponse.json(
        { error: "Invalid Origin header" },
        { status: 400 }
      );
    }

    // 3. Look up storefront by domain
    const storefront = await getStorefrontByDomain(tenantDb, domain);
    if (!storefront) {
      return NextResponse.json(
        { error: `No storefront found for domain "${domain}"` },
        { status: 404 }
      );
    }

    // 4. Get sitemap data
    const sitemap = await getSitemapData(tenantDb, storefront.slug);

    // Find primary domain for absolute URLs
    const domains = storefront.domains || [];
    const primaryDomain = domains.find(
      (d) => typeof d === "object" && d.is_primary
    );
    const primaryDomainStr =
      typeof primaryDomain === "object"
        ? primaryDomain.domain
        : domains[0]
          ? typeof domains[0] === "object"
            ? domains[0].domain
            : domains[0]
          : "";

    if (!sitemap) {
      // No sitemap generated yet — return empty with defaults
      return NextResponse.json({
        urls: [],
        robots_config: {
          custom_rules: "",
          disallow: DEFAULT_ROBOTS_DISALLOW,
        },
        stats: null,
        storefront: {
          slug: storefront.slug,
          primary_domain: primaryDomainStr,
        },
      });
    }

    return NextResponse.json({
      urls: sitemap.urls,
      robots_config: sitemap.robots_config,
      stats: sitemap.stats,
      storefront: {
        slug: storefront.slug,
        primary_domain: primaryDomainStr,
      },
    });
  } catch (error) {
    console.error("[GET /api/b2b/b2c/public/sitemap-data]", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
