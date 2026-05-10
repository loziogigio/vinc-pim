import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  listPortals,
  createPortal,
} from "@/lib/services/b2b-portal.service";
import {
  isTenantMigrated,
  NOT_MIGRATED_RESPONSE_BODY,
} from "@/lib/services/b2b-portal-migration-flag.service";

/**
 * GET /api/b2b/b2b/portals
 * List all B2B portals for the tenant.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || undefined;

    const result = await listPortals(auth.tenantDb, { page, limit, search, status });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/b2b/b2b/portals]", error);
    const message = error instanceof Error ? error.message : "Failed to list portals";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/b2b/b2b/portals
 * Create a new B2B portal.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    // Migration gate — unmigrated tenants cannot create portals.
    if (!(await isTenantMigrated(auth.tenantId))) {
      return NextResponse.json(NOT_MIGRATED_RESPONSE_BODY, { status: 409 });
    }

    const body = await req.json();
    const { name, slug, channel, domains, settings } = body;

    if (!name || !slug || !channel) {
      return NextResponse.json(
        { error: "Name, slug, and channel are required" },
        { status: 400 },
      );
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: "Slug must be lowercase alphanumeric with dashes" },
        { status: 400 },
      );
    }

    const portal = await createPortal(auth.tenantDb, {
      name,
      slug,
      channel,
      domains,
      settings,
    });

    return NextResponse.json({ success: true, data: portal }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/b2b/b2b/portals]", error);
    const message = error instanceof Error ? error.message : "Failed to create portal";
    const status = message.includes("already exists") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
