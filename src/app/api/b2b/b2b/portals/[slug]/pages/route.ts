import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { listPages, createPage } from "@/lib/services/b2b-page.service";
import {
  isTenantMigrated,
  NOT_MIGRATED_RESPONSE_BODY,
} from "@/lib/services/b2b-portal-migration-flag.service";

type RouteParams = { params: Promise<{ slug: string }> };

/**
 * GET /api/b2b/b2b/portals/[slug]/pages
 * List pages for a B2B portal
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug } = await params;
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const status = url.searchParams.get("status") || undefined;
    const lang = url.searchParams.get("lang") || undefined;

    const result = await listPages(auth.tenantDb, slug, { page, limit, status, lang });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[GET /api/b2b/b2b/portals/[slug]/pages]", error);
    const message = error instanceof Error ? error.message : "Failed to list pages";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/b2b/b2b/portals/[slug]/pages
 * Create a new page for a B2B portal
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    if (!(await isTenantMigrated(auth.tenantId))) {
      return NextResponse.json(NOT_MIGRATED_RESPONSE_BODY, { status: 409 });
    }

    const { slug } = await params;
    const body = await req.json();

    if (!body.slug || !body.title) {
      return NextResponse.json(
        { error: "slug and title are required" },
        { status: 400 }
      );
    }

    const page = await createPage(auth.tenantDb, slug, {
      slug: body.slug,
      title: body.title,
      lang: body.lang,
      show_in_nav: body.show_in_nav,
      sort_order: body.sort_order,
    });

    return NextResponse.json({ success: true, data: page }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/b2b/b2b/portals/[slug]/pages]", error);
    const message = error instanceof Error ? error.message : "Failed to create page";
    const status = message.includes("already exists") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
