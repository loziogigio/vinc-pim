import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getPageBySlug, updatePage, deletePage } from "@/lib/services/b2c-page.service";

type RouteParams = { params: Promise<{ slug: string; pageSlug: string }> };

/**
 * GET /api/b2b/b2c/storefronts/[slug]/pages/[pageSlug]
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
    console.error("[GET .../pages/[pageSlug]]", error);
    const message = error instanceof Error ? error.message : "Failed to get page";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/b2b/b2c/storefronts/[slug]/pages/[pageSlug]
 * Update page metadata
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug, pageSlug } = await params;
    const body = await req.json();

    const page = await updatePage(auth.tenantDb, slug, pageSlug, {
      title: body.title,
      slug: body.slug,
      status: body.status,
      show_in_nav: body.show_in_nav,
      sort_order: body.sort_order,
    });

    return NextResponse.json({ success: true, data: page });
  } catch (error) {
    console.error("[PATCH .../pages/[pageSlug]]", error);
    const message = error instanceof Error ? error.message : "Failed to update page";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/b2b/b2c/storefronts/[slug]/pages/[pageSlug]
 * Delete page + template + submissions
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug, pageSlug } = await params;
    await deletePage(auth.tenantDb, slug, pageSlug);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE .../pages/[pageSlug]]", error);
    const message = error instanceof Error ? error.message : "Failed to delete page";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
