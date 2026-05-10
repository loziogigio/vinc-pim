/**
 * GET / PATCH / POST /api/b2b/b2b/portals/[slug]/sitemap
 *
 * Mirrors src/app/api/b2b/b2c/storefronts/[slug]/sitemap/route.ts with
 * B2CSitemap → B2BSitemap and storefront_slug → portal_slug substitutions.
 *
 *   GET   — returns sitemap stats, robots config, and validation for admin UI.
 *            Works for all tenants (no migration gate). Returns a sensible
 *            default shape when no b2bsitemaps row exists for the portal yet.
 *
 *   PATCH — updates sitemap settings (robots config, etc.).
 *            Migration gate: returns 409 NOT_MIGRATED for unmigrated tenants.
 *
 *   POST  — action-based, mirrors the B2C sitemap route's POST. Actions:
 *            • { action: "browse_urls", type?, search?, page?, limit? }
 *                Paginated/filtered view of the stored sitemap URLs, plus the
 *                portal's primary domain. No migration gate (read-only).
 *            • { action: "update_robots_rules", custom_rules: string }
 *                Persists custom robots.txt rules. Migration gate applies.
 *            • { action: "regenerate" } / { action: "validate" }
 *                NOT YET SUPPORTED — there is no B2B sitemap *generator*
 *                service (the B2C one is hard-coded to B2C storefront data
 *                models). Returns 501 with a clear message rather than 404.
 *                See SitemapSection: until a generator exists, the B2B portal
 *                detail page shows "no sitemap generated yet".
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import {
  isTenantMigrated,
  NOT_MIGRATED_RESPONSE_BODY,
} from "@/lib/services/b2b-portal-migration-flag.service";
import type { IB2BSitemap, ISitemapUrl } from "@/lib/db/models/b2b-sitemap";

/** Default disallow paths for B2B portal robots.txt */
const DEFAULT_ROBOTS_DISALLOW = [
  // API & internal
  "/api/",
  "/admin/",
  "/preview/",
  // Search (dynamic, query-dependent)
  "/search",
  // Auth pages
  "/pages/login",
  "/pages/register",
  "/pages/forgot-password",
  "/pages/update-password",
  "/pages/confirm-subscription",
  // Account (auth-protected)
  "/pages/account",
  "/pages/address",
  "/pages/change-password",
  "/pages/orders",
  "/pages/profile",
  "/pages/reminders",
  "/pages/wishlist",
  // Checkout & payment
  "/pages/cart",
  "/pages/pay",
  "/pages/payment-success",
  "/pages/payment-failed",
  // Guest order (token-protected)
  "/public/orders/",
];

type Ctx = { params: Promise<{ slug: string }> };

/**
 * GET /api/b2b/b2b/portals/[slug]/sitemap
 *
 * Returns sitemap stats, robots config, and validation for admin UI.
 * Returns a default empty shape when no sitemap document exists yet.
 * No migration gate — works for all tenants.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug } = await ctx.params;
    const { tenantDb } = auth;

    const { B2BSitemap } = await connectWithModels(tenantDb);
    const sitemap = (await B2BSitemap.findOne({ portal_slug: slug }).lean()) as IB2BSitemap | null;

    if (!sitemap) {
      return NextResponse.json({
        success: true,
        data: {
          generated: false,
          stats: null,
          robots_config: {
            custom_rules: "",
            disallow: DEFAULT_ROBOTS_DISALLOW,
          },
          validation: null,
          url_count: 0,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        generated: true,
        stats: sitemap.stats,
        robots_config: sitemap.robots_config,
        validation: sitemap.validation,
        url_count: sitemap.urls?.length || 0,
      },
    });
  } catch (error) {
    console.error("[GET /api/b2b/b2b/portals/[slug]/sitemap]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/b2b/b2b/portals/[slug]/sitemap
 *
 * Updates sitemap settings for the portal (robots config, etc.).
 * Migration gate: returns 409 NOT_MIGRATED if tenant has not been migrated.
 *
 * Accepted body fields (all optional):
 *   - settings: { enabled?: boolean }
 *   - robots_config: { custom_rules?: string; disallow?: string[] }
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug } = await ctx.params;
    const { tenantDb, tenantId } = auth;

    // Migration gate — must be checked BEFORE performing the write.
    if (!(await isTenantMigrated(tenantId))) {
      return NextResponse.json(NOT_MIGRATED_RESPONSE_BODY, { status: 409 });
    }

    const body = await req.json();
    const { settings, robots_config } = body as {
      settings?: Record<string, unknown>;
      robots_config?: { custom_rules?: string; disallow?: string[] };
    };

    const { B2BSitemap } = await connectWithModels(tenantDb);

    // Ensure the document exists before applying dotted-path $set updates.
    // Using $setOnInsert alongside dotted-path $set (e.g. "robots_config.custom_rules")
    // causes a ConflictingUpdateOperators error in MongoDB when the parent field
    // is also referenced in $setOnInsert.  Create-or-noop first, then update.
    await B2BSitemap.findOneAndUpdate(
      { portal_slug: slug },
      {
        $setOnInsert: {
          portal_slug: slug,
          urls: [],
          robots_config: {
            custom_rules: "",
            disallow: DEFAULT_ROBOTS_DISALLOW,
          },
          stats: {},
          validation: {},
        },
      },
      { upsert: true }
    );

    // Build update — only apply provided fields
    const $set: Record<string, unknown> = {};

    if (settings !== undefined) {
      // settings is a free-form config object stored on the document
      $set["settings"] = settings;
    }

    if (robots_config !== undefined) {
      if (robots_config.custom_rules !== undefined) {
        $set["robots_config.custom_rules"] = robots_config.custom_rules;
      }
      if (robots_config.disallow !== undefined) {
        $set["robots_config.disallow"] = robots_config.disallow;
      }
    }

    let updated: IB2BSitemap | null = null;
    if (Object.keys($set).length > 0) {
      updated = await B2BSitemap.findOneAndUpdate(
        { portal_slug: slug },
        { $set },
        { new: true }
      ).lean() as IB2BSitemap | null;
    } else {
      updated = await B2BSitemap.findOne({ portal_slug: slug }).lean() as IB2BSitemap | null;
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[PATCH /api/b2b/b2b/portals/[slug]/sitemap]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/b2b/b2b/portals/[slug]/sitemap
 *
 * Action-based endpoint mirroring the B2C sitemap route's POST so that the
 * shared SitemapSection component works against the B2B portal API unchanged.
 *
 * Actions:
 *   - { action: "browse_urls", type?, search?, page?, limit? }
 *       Read-only. Returns { urls, pagination, primary_domain } from the
 *       stored b2bsitemaps document for this portal (empty until a generator
 *       populates it).  No migration gate.
 *   - { action: "update_robots_rules", custom_rules: string }
 *       Persists custom robots.txt rules on robots_config.custom_rules.
 *       Migration gate: 409 NOT_MIGRATED for unmigrated tenants.
 *   - { action: "regenerate" } | { action: "validate" }
 *       501 Not Implemented — see file header.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug } = await ctx.params;
    const { tenantDb, tenantId } = auth;

    const body = await req.json();
    const { action } = body as { action?: string };

    switch (action) {
      case "browse_urls": {
        const result = await browseSitemapUrls(tenantDb, slug, {
          type: body.type,
          search: body.search,
          page: body.page,
          limit: body.limit,
        });
        return NextResponse.json({ success: true, data: result });
      }

      case "update_robots_rules": {
        // Write — gate on migration BEFORE touching the DB.
        if (!(await isTenantMigrated(tenantId))) {
          return NextResponse.json(NOT_MIGRATED_RESPONSE_BODY, { status: 409 });
        }
        const { custom_rules } = body as { custom_rules?: unknown };
        if (typeof custom_rules !== "string") {
          return NextResponse.json(
            { error: "custom_rules must be a string" },
            { status: 400 }
          );
        }
        const { B2BSitemap } = await connectWithModels(tenantDb);
        // Two-step upsert to avoid ConflictingUpdateOperators between a dotted
        // $set path and $setOnInsert on the same parent field (same pattern as PATCH).
        await B2BSitemap.findOneAndUpdate(
          { portal_slug: slug },
          {
            $setOnInsert: {
              portal_slug: slug,
              urls: [],
              robots_config: { custom_rules: "", disallow: DEFAULT_ROBOTS_DISALLOW },
              stats: {},
              validation: {},
            },
          },
          { upsert: true }
        );
        await B2BSitemap.updateOne(
          { portal_slug: slug },
          { $set: { "robots_config.custom_rules": custom_rules } }
        );
        return NextResponse.json({ success: true });
      }

      case "regenerate":
      case "validate": {
        // No B2B sitemap generator service exists yet (the B2C one is hard-coded
        // to B2C storefront/page/product/category data models). Surface a clear
        // 501 rather than a confusing 404 so SitemapSection can show the error.
        return NextResponse.json(
          {
            error:
              "Sitemap generation is not yet supported for B2B portals. Configure robots.txt rules manually for now.",
            code: "NOT_SUPPORTED",
          },
          { status: 501 }
        );
      }

      default:
        return NextResponse.json(
          {
            error: `Unknown action: ${action}. Use "browse_urls" or "update_robots_rules".`,
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[POST /api/b2b/b2b/portals/[slug]/sitemap]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Paginated/filtered view of a portal's stored sitemap URLs, plus its primary
 * domain (resolved from the B2BPortal document). Mirrors getSitemapUrls() in
 * b2c-sitemap.service.ts, B2C → B2B.
 */
async function browseSitemapUrls(
  tenantDb: string,
  portalSlug: string,
  options: { type?: string; search?: string; page?: number; limit?: number }
): Promise<{
  urls: ISitemapUrl[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  primary_domain: string | null;
}> {
  const { B2BSitemap, B2BPortal } = await connectWithModels(tenantDb);

  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 25));

  const sitemap = (await B2BSitemap.findOne({ portal_slug: portalSlug })
    .select("urls")
    .lean()) as Pick<IB2BSitemap, "urls"> | null;

  let urls = sitemap?.urls || [];

  if (options.type && options.type !== "all") {
    urls = urls.filter((u) => u.type === options.type);
  }
  if (options.search) {
    const search = options.search.toLowerCase();
    urls = urls.filter((u) => u.path.toLowerCase().includes(search));
  }

  const total = urls.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const paginatedUrls = urls.slice(start, start + limit);

  // Primary domain: the entry flagged is_primary, else the first domain.
  const portal = (await B2BPortal.findOne({ slug: portalSlug })
    .select("domains")
    .lean()) as { domains?: Array<string | { domain: string; is_primary?: boolean }> } | null;

  let primaryDomain: string | null = null;
  if (portal?.domains) {
    for (const d of portal.domains) {
      if (typeof d === "object" && d.is_primary) {
        primaryDomain = d.domain;
        break;
      }
    }
    if (!primaryDomain && portal.domains.length > 0) {
      const first = portal.domains[0];
      primaryDomain = typeof first === "string" ? first : first.domain;
    }
  }

  return {
    urls: paginatedUrls,
    pagination: { page, limit, total, totalPages },
    primary_domain: primaryDomain,
  };
}
