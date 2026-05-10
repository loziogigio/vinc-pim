/**
 * GET / PATCH /api/b2b/b2b/portals/[slug]/sitemap
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
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { isTenantMigrated } from "@/lib/services/b2b-portal-migration-flag.service";
import type { IB2BSitemap } from "@/lib/db/models/b2b-sitemap";

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

/** Shared 409 body for unmigrated tenants on write operations. */
const NOT_MIGRATED_BODY = {
  error: "B2B portal not migrated for this tenant. Run scripts/migrate-b2b-portal.ts.",
  code: "NOT_MIGRATED" as const,
};

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
      return NextResponse.json(NOT_MIGRATED_BODY, { status: 409 });
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
