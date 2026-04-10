/**
 * GET /api/b2b/tenant/enabled-apps
 *
 * Returns the platform applications enabled for the current tenant.
 * Used by vinc-b2b app launcher to determine which apps to show in the toggle.
 *
 * Returns rich app objects (with url, name, description) plus a flat
 * enabled_app_ids array for backward compatibility.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getTenant } from "@/lib/services/admin-tenant.service";
import { getPlatformAppModel } from "@/lib/db/models/admin-platform-app";
import {
  resolveEnabledApps,
  sortWithB2BFirst,
} from "@/config/platform-apps.config";
import { getHomeSettings } from "@/lib/db/home-settings";
import { getAuthClientModel } from "@/lib/db/models/sso-auth-client";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    const tenant = await getTenant(auth.tenantId);

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      );
    }

    // Fetch platform apps, OAuth clients, and tenant branding in parallel
    const PlatformApp = await getPlatformAppModel();
    const AuthClient = await getAuthClientModel();
    const [dbApps, authClients, homeSettings] = await Promise.all([
      PlatformApp.find({ is_active: true }).sort({ sort_order: 1 }).lean(),
      AuthClient.find({ is_active: true }).select("client_id redirect_uris").lean(),
      getHomeSettings(auth.tenantDb).catch(() => null),
    ]);

    // Map client_id -> redirect_uris from OAuth clients
    const clientRedirectMap = new Map<string, string[]>();
    for (const client of authClients) {
      clientRedirectMap.set(client.client_id, client.redirect_uris || []);
    }

    console.log(
      `[enabled-apps] tenant=${auth.tenantId} enabled_apps=${JSON.stringify(tenant.enabled_apps)} dbApps=${dbApps.length}`
    );

    // Build tenant branding from home settings
    const tenant_branding = {
      company_name:
        homeSettings?.company_info?.legal_name ||
        homeSettings?.branding?.title ||
        tenant.name ||
        "",
      logo: homeSettings?.branding?.logo || "",
      favicon: homeSettings?.branding?.favicon || "",
    };

    if (dbApps.length > 0) {
      // Dynamic path: filter by tenant's enabled_apps
      let filtered = dbApps;
      if (tenant.enabled_apps && tenant.enabled_apps.length > 0) {
        const enabledSet = new Set(tenant.enabled_apps);
        filtered = dbApps.filter((a) => enabledSet.has(a.app_id));
      }

      const sorted = sortWithB2BFirst(filtered);

      // Build tenant domains list (for dynamic redirect resolution)
      const tenant_domains = (tenant.domains || [])
        .filter((d: { is_active?: boolean }) => d.is_active !== false)
        .map((d: { hostname: string; protocol?: string; is_primary?: boolean }) => ({
          hostname: d.hostname,
          url: `${d.protocol || "https"}://${d.hostname}`,
          is_primary: !!d.is_primary,
        }));

      return NextResponse.json({
        success: true,
        enabled_apps: sorted.map((a) => ({
          app_id: a.app_id,
          name: a.name,
          description: a.description || "",
          url: a.url,
          icon: a.icon || "",
          color: a.color || "",
          redirect_uris: clientRedirectMap.get(a.app_id) || [],
        })),
        enabled_app_ids: sorted.map((a) => a.app_id),
        tenant_branding,
        tenant_domains,
      });
    }

    // Fallback: static config (backward compat when DB is empty)
    const enabled_apps = resolveEnabledApps(tenant.enabled_apps);

    return NextResponse.json({
      success: true,
      enabled_apps,
      enabled_app_ids: enabled_apps,
      tenant_branding,
    });
  } catch (error) {
    console.error("[enabled-apps] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch enabled apps" },
      { status: 500 }
    );
  }
}
