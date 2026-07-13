/**
 * GET / PATCH / DELETE /api/b2b/b2b/portals/[slug]
 *
 * Dual-state behavior per the B2B Portal Refactor Phase 1 spec:
 *
 *   GET   — always works, even for unmigrated tenants. The service layer
 *            performs a read-through fallback to b2bhomesettings and returns
 *            an IB2BPortalSynthesized (synthesized: true) when no row exists
 *            in b2bportals. A 404 is returned only if no data exists at all.
 *
 *   PATCH — write gate: checks isTenantMigrated() first. Returns 409
 *            NOT_MIGRATED if the tenant has not been migrated. Proceeds with
 *            updatePortal() only for migrated tenants.
 *
 *   DELETE — same write gate as PATCH. Returns 409 NOT_MIGRATED for
 *             unmigrated tenants.
 *
 * All handlers use requireTenantAuth and await params per Next.js 15 convention.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { hasHomeBuilderAccess } from "@/lib/auth/home-builder-access";
import {
  getPortalBySlug,
  updatePortal,
  deletePortal,
  B2BPortalValidationError,
} from "@/lib/services/b2b-portal.service";
import {
  isTenantMigrated,
  NOT_MIGRATED_RESPONSE_BODY,
} from "@/lib/services/b2b-portal-migration-flag.service";
import { invalidateB2BCache } from "@/lib/cache/redis-client";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * GET /api/b2b/b2b/portals/[slug]
 *
 * Returns the portal for the given slug. For unmigrated tenants the service
 * synthesizes the response from b2bhomesettings (synthesized: true in the
 * response body). No migration gate applies to GET.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug } = await ctx.params;

    // tenantDisplayName is not on the auth result; fall back to tenantId.
    // The service uses this only for the synthesized portal name field.
    const tenantDisplayName = auth.tenantId;

    const portal = await getPortalBySlug(auth.tenantDb, slug, tenantDisplayName);
    if (!portal) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    return NextResponse.json(portal);
  } catch (error) {
    console.error("[GET /api/b2b/b2b/portals/[slug]]", error);
    return NextResponse.json({ error: "Failed to load portal" }, { status: 500 });
  }
}

/**
 * PATCH /api/b2b/b2b/portals/[slug]
 *
 * Updates fields on the portal. Requires the tenant to be migrated.
 * Returns 409 NOT_MIGRATED if not yet migrated.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug } = await ctx.params;
    const patch = await req.json();

    const writesCustomScripts =
      patch !== null &&
      typeof patch === "object" &&
      !Array.isArray(patch) &&
      Object.prototype.hasOwnProperty.call(patch, "custom_scripts");

    // Executable storefront code is a portal-administration capability. Do
    // not allow API keys or customer/portal-user credentials to inject it.
    if (
      writesCustomScripts &&
      (!auth.userId ||
        auth.authMethod !== "session" ||
        auth.userType !== "b2b_user" ||
        !(await hasHomeBuilderAccess(auth.tenantId)))
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Migration gate — must be checked BEFORE performing the write.
    if (!(await isTenantMigrated(auth.tenantId))) {
      return NextResponse.json(NOT_MIGRATED_RESPONSE_BODY, { status: 409 });
    }

    const portal = await updatePortal(auth.tenantDb, slug, patch);
    if (!portal) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    // Branding/header/footer/meta/scripts feed home-settings. Routing/channel
    // changes also affect the generated sitemap contract consumed by vinc-b2b.
    const cacheNames = ["home-settings"];
    if (
      patch.seo_config !== undefined ||
      patch.channel !== undefined ||
      patch.domains !== undefined ||
      patch.status !== undefined ||
      patch.settings?.default_language !== undefined
    ) {
      cacheNames.push("sitemap");
    }
    void invalidateB2BCache(auth.tenantId, cacheNames);

    return NextResponse.json({ success: true, data: portal });
  } catch (error) {
    console.error("[PATCH /api/b2b/b2b/portals/[slug]]", error);
    if (error instanceof B2BPortalValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update portal" }, { status: 500 });
  }
}

/**
 * DELETE /api/b2b/b2b/portals/[slug]
 *
 * Deletes the portal. Requires the tenant to be migrated.
 * Returns 409 NOT_MIGRATED if not yet migrated.
 */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug } = await ctx.params;

    // Migration gate — must be checked BEFORE performing the write.
    if (!(await isTenantMigrated(auth.tenantId))) {
      return NextResponse.json(NOT_MIGRATED_RESPONSE_BODY, { status: 409 });
    }

    const deleted = await deletePortal(auth.tenantDb, slug);
    if (!deleted) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/b2b/b2b/portals/[slug]]", error);
    return NextResponse.json({ error: "Failed to delete portal" }, { status: 500 });
  }
}
