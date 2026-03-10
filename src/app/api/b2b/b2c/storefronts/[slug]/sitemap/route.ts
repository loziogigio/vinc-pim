import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  getSitemapData,
  generateSitemapForStorefront,
  validateSitemap,
  updateRobotsRules,
  DEFAULT_ROBOTS_DISALLOW,
} from "@/lib/services/b2c-sitemap.service";

/**
 * GET /api/b2b/b2c/storefronts/[slug]/sitemap
 *
 * Returns sitemap stats, robots config, and validation for admin UI.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { slug } = await params;
  const { tenantDb } = auth;

  try {
    const sitemap = await getSitemapData(tenantDb, slug);

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
    console.error(`[GET /api/b2b/b2c/storefronts/${slug}/sitemap]`, error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/b2b/b2c/storefronts/[slug]/sitemap
 *
 * Actions:
 *   - { action: "regenerate" } — Regenerate sitemap data now
 *   - { action: "validate" }   — Run validation checks
 *   - { action: "update_robots_rules", custom_rules: "..." } — Update custom robots rules
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { slug } = await params;
  const { tenantDb } = auth;

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "regenerate": {
        const result = await generateSitemapForStorefront(tenantDb, slug);
        return NextResponse.json({ success: true, data: result });
      }

      case "validate": {
        const validation = await validateSitemap(tenantDb, slug);
        return NextResponse.json({ success: true, data: validation });
      }

      case "update_robots_rules": {
        const { custom_rules } = body;
        if (typeof custom_rules !== "string") {
          return NextResponse.json(
            { error: "custom_rules must be a string" },
            { status: 400 }
          );
        }
        await updateRobotsRules(tenantDb, slug, custom_rules);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Use "regenerate", "validate", or "update_robots_rules"` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error(`[POST /api/b2b/b2c/storefronts/${slug}/sitemap]`, error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
