import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getPageBySlug, updatePage, deletePage } from "@/lib/services/b2b-page.service";
import {
  isTenantMigrated,
  NOT_MIGRATED_RESPONSE_BODY,
} from "@/lib/services/b2b-portal-migration-flag.service";

type RouteParams = { params: Promise<{ slug: string; pageSlug: string }> };

/**
 * GET /api/b2b/b2b/portals/[slug]/pages/[pageSlug]
 * Get page metadata
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug, pageSlug } = await params;
    const page = await getPageBySlug(auth.tenantDb, slug, pageSlug);

    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: page });
  } catch (error) {
    console.error("[GET /api/b2b/b2b/portals/[slug]/pages/[pageSlug]]", error);
    const message = error instanceof Error ? error.message : "Failed to get page";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/b2b/b2b/portals/[slug]/pages/[pageSlug]
 * Update page metadata
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    if (!(await isTenantMigrated(auth.tenantId))) {
      return NextResponse.json(NOT_MIGRATED_RESPONSE_BODY, { status: 409 });
    }

    const { slug, pageSlug } = await params;
    const body = await req.json();

    const page = await updatePage(auth.tenantDb, slug, pageSlug, {
      title: body.title,
      slug: body.slug,
      lang: body.lang,
      status: body.status,
      show_in_nav: body.show_in_nav,
      sort_order: body.sort_order,
    });

    return NextResponse.json({ success: true, data: page });
  } catch (error) {
    console.error("[PATCH /api/b2b/b2b/portals/[slug]/pages/[pageSlug]]", error);
    const message = error instanceof Error ? error.message : "Failed to update page";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * DELETE /api/b2b/b2b/portals/[slug]/pages/[pageSlug]
 * Delete page + template + form submissions
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    if (!(await isTenantMigrated(auth.tenantId))) {
      return NextResponse.json(NOT_MIGRATED_RESPONSE_BODY, { status: 409 });
    }

    const { slug, pageSlug } = await params;
    await deletePage(auth.tenantDb, slug, pageSlug);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/b2b/b2b/portals/[slug]/pages/[pageSlug]]", error);
    const message = error instanceof Error ? error.message : "Failed to delete page";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
