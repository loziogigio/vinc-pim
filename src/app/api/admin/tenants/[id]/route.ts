/**
 * /api/admin/tenants/[id]
 *
 * GET    - Get tenant details
 * PATCH  - Update tenant (name, status, settings)
 * DELETE - Delete tenant (removes all data!)
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth, unauthorizedResponse } from "@/lib/auth/admin-auth";
import {
  getTenant,
  updateTenant,
  deleteTenant,
} from "@/lib/services/admin-tenant.service";
import {
  TENANT_STATUSES,
  type TenantStatus,
} from "@/lib/db/models/admin-tenant";
import { isAppId } from "@/config/app-ids";
import {
  B2B_PRICING_SOURCE_IDS,
  B2B_STOREFRONT_TEMPLATE_IDS,
  isB2BPricingSource,
  isB2BStorefrontTemplate,
} from "@/lib/constants/b2b-storefront";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/admin/tenants/[id]
 * Get tenant details
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const auth = await verifyAdminAuth(req);
  if (!auth) {
    return unauthorizedResponse();
  }

  const { id } = await params;

  try {
    const tenant = await getTenant(id);

    if (!tenant) {
      return NextResponse.json(
        { error: `Tenant '${id}' not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      tenant,
    });
  } catch (error) {
    console.error("Get tenant error:", error);
    return NextResponse.json(
      { error: "Failed to get tenant" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/tenants/[id]
 * Update tenant details
 *
 * Body (all optional):
 * - name: string - Display name
 * - status: "active" | "suspended" | "pending"
 * - settings: { features?: string[], limits?: { max_products?, max_users?, max_orders? } }
 * - project_code: string - Project identifier
 * - domains: Array<{ hostname, is_primary?, is_active? }> - Domain mappings
 * - api: { pim_api_url, b2b_api_url, erp_url, api_key_id, api_secret } - API configuration
 * - database: { mongo_url, mongo_db } - Database override
 * - require_login: boolean - Whether login is required
 * - home_settings_customer_id: string - Home settings customer ID
 * - builder_url: string - Builder/preview URL
 * - b2b_theme: "default" | "time" - Compiled vinc-b2b storefront template
 * - features: { pricing_source: "inline" | "erp" | "hybrid" } - Storefront price source
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await verifyAdminAuth(req);
  if (!auth) {
    return unauthorizedResponse();
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const {
      name,
      status,
      settings,
      project_code,
      domains,
      api,
      database,
      require_login,
      home_settings_customer_id,
      builder_url,
      b2b_theme,
      features,
      vetrina,
      enabled_apps,
      enabled_modules,
    } = body;

    // Build one update so status changes do not silently discard configuration
    // fields sent in the same PATCH. updateTenant performs the save, cache
    // notification, and Traefik refresh once for the complete change.
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (settings !== undefined) updates.settings = settings;
    if (project_code !== undefined) updates.project_code = project_code;
    if (domains !== undefined) updates.domains = domains;
    if (api !== undefined) updates.api = api;
    if (database !== undefined) updates.database = database;
    if (require_login !== undefined) updates.require_login = require_login;
    if (home_settings_customer_id !== undefined) updates.home_settings_customer_id = home_settings_customer_id;
    if (builder_url !== undefined) updates.builder_url = builder_url;
    if (b2b_theme !== undefined) {
      if (!isB2BStorefrontTemplate(b2b_theme)) {
        return NextResponse.json(
          {
            error: `Invalid b2b_theme. Expected one of: ${B2B_STOREFRONT_TEMPLATE_IDS.join(", ")}`,
          },
          { status: 400 }
        );
      }
      updates.b2b_theme = b2b_theme;
    }
    if (features !== undefined) {
      if (!features || typeof features !== "object" || Array.isArray(features)) {
        return NextResponse.json(
          { error: "features must be an object" },
          { status: 400 }
        );
      }

      const pricingSource = features.pricing_source;
      if (!isB2BPricingSource(pricingSource)) {
        return NextResponse.json(
          {
            error: `Invalid features.pricing_source. Expected one of: ${B2B_PRICING_SOURCE_IDS.join(", ")}`,
          },
          { status: 400 }
        );
      }

      // Only expose pricing_source through this endpoint. updateTenant merges
      // the nested path so unrelated flags (for example is_demo) survive.
      updates.features = { pricing_source: pricingSource };
    }
    if (vetrina !== undefined) updates.vetrina = vetrina;
    if (enabled_apps !== undefined) {
      const { getPlatformAppModel } = await import("@/lib/db/models/admin-platform-app");
      const PlatformApp = await getPlatformAppModel();
      const activeApps = await PlatformApp.find({ is_active: true }).select("app_id").lean();
      const validIds = new Set(activeApps.map((a) => a.app_id));

      // Fallback: if DB has no apps yet, accept static IDs for backward compat
      if (validIds.size === 0) {
        const { PLATFORM_APP_IDS } = await import("@/config/platform-apps.config");
        PLATFORM_APP_IDS.forEach((id) => validIds.add(id));
      }

      updates.enabled_apps = (enabled_apps as string[]).filter((id: string) => validIds.has(id));
    }

    if (Array.isArray(enabled_modules)) {
      updates.enabled_modules = enabled_modules.filter((id: string) => isAppId(id));
    }

    if (status !== undefined) {
      if (
        typeof status !== "string" ||
        !TENANT_STATUSES.includes(status as TenantStatus)
      ) {
        return NextResponse.json(
          {
            error: `Invalid status. Expected one of: ${TENANT_STATUSES.join(", ")}`,
          },
          { status: 400 }
        );
      }
      updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const tenant = await updateTenant(id, updates);

    const message =
      status === "suspended"
        ? `Tenant '${id}' has been suspended`
        : status === "active"
          ? `Tenant '${id}' has been activated`
          : undefined;

    return NextResponse.json({
      success: true,
      tenant: tenant.toObject(),
      ...(message ? { message } : {}),
    });
  } catch (error) {
    console.error("Update tenant error:", error);
    const message = error instanceof Error ? error.message : "Failed to update tenant";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * DELETE /api/admin/tenants/[id]
 * Delete tenant and ALL its data
 *
 * Query params:
 * - confirm: "yes" (required) - Must confirm deletion
 *
 * WARNING: This is irreversible! Deletes:
 * - MongoDB database (vinc-{tenant_id})
 * - Solr core (vinc-{tenant_id})
 * - Tenant record
 */
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const auth = await verifyAdminAuth(req);
  if (!auth) {
    return unauthorizedResponse();
  }

  const { id } = await params;

  // Require explicit confirmation
  const url = new URL(req.url);
  const confirm = url.searchParams.get("confirm");

  if (confirm !== "yes") {
    return NextResponse.json(
      {
        error: "Deletion requires explicit confirmation",
        hint: "Add ?confirm=yes to the request",
        warning: "This will permanently delete the MongoDB database, Solr core, and all tenant data!",
      },
      { status: 400 }
    );
  }

  try {
    await deleteTenant(id);

    return NextResponse.json({
      success: true,
      message: `Tenant '${id}' and all associated data have been permanently deleted`,
    });
  } catch (error) {
    console.error("Delete tenant error:", error);
    const message = error instanceof Error ? error.message : "Failed to delete tenant";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
