import { NextRequest, NextResponse } from "next/server";
import { verifyAPIKey } from "@/lib/auth/api-key-auth";
import { connectWithModels } from "@/lib/db/connection";
import type { IB2BSitemap } from "@/lib/db/models/b2b-sitemap";

/**
 * Default paths to disallow in robots.txt for B2B portals.
 * Mirrors the defaults in the B2BSitemapSchema and B2C sitemap service.
 */
export const DEFAULT_ROBOTS_DISALLOW = [
  "/api/",
  "/admin/",
  "/preview/",
  "/search",
  "/pages/login",
  "/pages/register",
  "/pages/forgot-password",
  "/pages/update-password",
  "/pages/confirm-subscription",
  "/pages/account",
  "/pages/address",
  "/pages/change-password",
  "/pages/orders",
  "/pages/profile",
  "/pages/reminders",
  "/pages/wishlist",
  "/pages/cart",
  "/pages/pay",
  "/pages/payment-success",
  "/pages/payment-failed",
  "/public/orders/",
];

/**
 * GET /api/b2b/b2b/public/sitemap-data
 *
 * Returns structured sitemap data (JSON) for the B2B portal frontend to
 * generate sitemap.xml and robots.txt on its side. Mirrors the B2C public
 * sitemap-data route convention, substituting storefront → portal.
 *
 * Headers:
 *   x-api-key-id: ak_{tenant}_{key}
 *   x-api-secret: sk_{secret}
 *
 * Query params:
 *   portal  Portal slug (default: "default")
 *
 * Response:
 *   {
 *     urls: ISitemapUrl[],
 *     robots_config: { custom_rules, disallow },
 *     stats: ISitemapStats | null,
 *     portal: { slug }
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
        { status: 401 },
      );
    }

    const authResult = await verifyAPIKey(keyId, secret);
    if (!authResult.valid || !authResult.tenantId) {
      return NextResponse.json(
        { error: authResult.error || "Invalid API key" },
        { status: 401 },
      );
    }

    const tenantDb = `vinc-${authResult.tenantId}`;

    // 2. Resolve portal slug from query param (default: "default")
    const { searchParams } = new URL(req.url);
    const portalSlug = searchParams.get("portal") || "default";

    // 3. Look up sitemap data for this portal
    const { B2BSitemap } = await connectWithModels(tenantDb);
    const sitemap = (await B2BSitemap.findOne({
      portal_slug: portalSlug,
    }).lean()) as IB2BSitemap | null;

    if (!sitemap) {
      // No sitemap generated yet — return empty with defaults
      return NextResponse.json({
        urls: [],
        robots_config: {
          custom_rules: "",
          disallow: DEFAULT_ROBOTS_DISALLOW,
        },
        stats: null,
        portal: { slug: portalSlug },
      });
    }

    return NextResponse.json({
      urls: sitemap.urls,
      robots_config: sitemap.robots_config,
      stats: sitemap.stats,
      portal: { slug: portalSlug },
    });
  } catch (error) {
    console.error("[GET /api/b2b/b2b/public/sitemap-data]", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
