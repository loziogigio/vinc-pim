import { NextRequest, NextResponse } from "next/server";
import { verifyAPIKey } from "@/lib/auth/api-key-auth";
import { getPortalBySlug } from "@/lib/services/b2b-portal.service";
import { connectWithModels } from "@/lib/db/connection";
import { getHomeSettings } from "@/lib/db/home-settings";

/**
 * GET /api/b2b/b2b/public/home
 *
 * Public API for B2B portal frontends (Next.js, Nuxt.js, Flutter, etc.).
 * Authenticates tenant via API key, then looks up the portal by the
 * `portal` query parameter (default: "default").
 *
 * Headers:
 *   x-api-key-id: ak_{tenant}_{key}
 *   x-api-secret: sk_{secret}
 *
 * Query params:
 *   portal  Portal slug (default: "default")
 *
 * Response:
 *   { portal, homeTemplate }
 *
 *   `portal` is the full portal config (branding, header, footer, etc.)
 *   as returned by getPortalBySlug — includes read-through fallback from
 *   b2bhomesettings for unmigrated tenants.
 *
 *   `homeTemplate` is the currently published home template version (blocks,
 *   seo, etc.), or null if no published version exists yet.
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

    const tenantId = authResult.tenantId;
    const tenantDb = `vinc-${tenantId}`;

    // 2. Resolve portal slug from query param (default: "default")
    const { searchParams } = new URL(req.url);
    const portalSlug = searchParams.get("portal") || "default";

    // 3. Look up portal (applies read-through fallback for unmigrated tenants)
    const portal = await getPortalBySlug(tenantDb, portalSlug, tenantId);
    if (!portal) {
      return NextResponse.json(
        { error: `No portal found for slug "${portalSlug}"` },
        { status: 404 },
      );
    }

    // `cardStyle` (and `priceDecimals` inside it) still lives on b2bhomesettings
    // — buildPortalFromHomeSettings intentionally omits it. Read it directly
    // and merge onto the portal so storefronts get the tenant's saved value
    // instead of falling back to defaults.
    const homeSettings = await getHomeSettings(tenantDb).catch(() => null);
    const portalWithCardStyle = {
      ...portal,
      ...(homeSettings?.cardStyle ? { cardStyle: homeSettings.cardStyle } : {}),
    };

    // 4. Get published home template for this portal
    const { HomeTemplate } = await connectWithModels(tenantDb);
    const publishedVersion = await HomeTemplate.findOne({
      portal_slug: portalSlug,
      templateId: "home",
      isCurrentPublished: true,
      status: "published",
    }).lean();

    let homeTemplate: Record<string, unknown> | null = null;
    if (publishedVersion) {
      const v = publishedVersion as any;
      homeTemplate = {
        blocks: v.blocks ?? [],
        seo: v.seo ?? {},
        version: v.version,
        publishedAt: v.publishedAt,
        tags: v.tags,
        priority: v.priority,
        isDefault: v.isDefault,
        activeFrom: v.activeFrom,
        activeTo: v.activeTo,
        comment: v.comment,
      };
    }

    return NextResponse.json({ portal: portalWithCardStyle, homeTemplate });
  } catch (error) {
    console.error("[GET /api/b2b/b2b/public/home]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
