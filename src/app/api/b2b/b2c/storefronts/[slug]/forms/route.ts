import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";

type RouteParams = { params: Promise<{ slug: string }> };

/**
 * GET /api/b2b/b2c/storefronts/[slug]/forms
 * List form submissions for a storefront
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug } = await params;
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "25", 10);
    const pageSlug = url.searchParams.get("page_slug") || undefined;

    const { FormSubmission } = await connectWithModels(auth.tenantDb);

    const filter: Record<string, unknown> = { storefront_slug: slug };
    if (pageSlug) filter.page_slug = pageSlug;

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      FormSubmission.find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FormSubmission.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("[GET .../forms]", error);
    const message = error instanceof Error ? error.message : "Failed to list submissions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
