import { NextRequest, NextResponse } from "next/server";
import { initializeB2BRoute } from "@/lib/auth/b2b-helpers";
import {
  listStorefronts,
  createStorefront,
} from "@/lib/services/b2c-storefront.service";

/**
 * GET /api/b2b/b2c/storefronts
 * List all B2C storefronts for the tenant
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await initializeB2BRoute(req);
    if ("error" in auth && auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";

    const result = await listStorefronts(auth.tenantDb!, { page, limit, search });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/b2b/b2c/storefronts]", error);
    const message = error instanceof Error ? error.message : "Failed to list storefronts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/b2b/b2c/storefronts
 * Create a new B2C storefront
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await initializeB2BRoute(req);
    if ("error" in auth && auth.error) return auth.error;

    const body = await req.json();
    const { name, slug, domains, settings } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      );
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: "Slug must be lowercase alphanumeric with dashes" },
        { status: 400 }
      );
    }

    const storefront = await createStorefront(auth.tenantDb!, {
      name,
      slug,
      domains,
      settings,
    });

    return NextResponse.json({ success: true, data: storefront }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/b2b/b2c/storefronts]", error);
    const message = error instanceof Error ? error.message : "Failed to create storefront";
    const status = message.includes("already exists") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
