import { NextRequest, NextResponse } from "next/server";
import { initializeB2BRoute } from "@/lib/auth/b2b-helpers";
import {
  getStorefrontBySlug,
  updateStorefront,
  deleteStorefront,
} from "@/lib/services/b2c-storefront.service";

type RouteParams = { params: Promise<{ slug: string }> };

/**
 * GET /api/b2b/b2c/storefronts/[slug]
 * Get a single storefront by slug
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await initializeB2BRoute(req);
    if ("error" in auth && auth.error) return auth.error;

    const { slug } = await params;
    const storefront = await getStorefrontBySlug(auth.tenantDb!, slug);

    if (!storefront) {
      return NextResponse.json({ error: "Storefront not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: storefront });
  } catch (error) {
    console.error("[GET /api/b2b/b2c/storefronts/[slug]]", error);
    const message = error instanceof Error ? error.message : "Failed to get storefront";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/b2b/b2c/storefronts/[slug]
 * Update a storefront
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await initializeB2BRoute(req);
    if ("error" in auth && auth.error) return auth.error;

    const { slug } = await params;
    const body = await req.json();

    const storefront = await updateStorefront(auth.tenantDb!, slug, body);
    return NextResponse.json({ success: true, data: storefront });
  } catch (error) {
    console.error("[PATCH /api/b2b/b2c/storefronts/[slug]]", error);
    const message = error instanceof Error ? error.message : "Failed to update storefront";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * DELETE /api/b2b/b2c/storefronts/[slug]
 * Delete a storefront and its templates
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await initializeB2BRoute(req);
    if ("error" in auth && auth.error) return auth.error;

    const { slug } = await params;
    await deleteStorefront(auth.tenantDb!, slug);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/b2b/b2c/storefronts/[slug]]", error);
    const message = error instanceof Error ? error.message : "Failed to delete storefront";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
