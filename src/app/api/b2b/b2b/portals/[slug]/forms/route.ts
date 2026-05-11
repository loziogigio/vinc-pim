import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";

type RouteParams = { params: Promise<{ slug: string }> };

/**
 * GET /api/b2b/b2b/portals/[slug]/forms
 * List form submissions for a B2B portal
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
    const formType = url.searchParams.get("form_type") || undefined;

    const { B2BFormSubmission } = await connectWithModels(auth.tenantDb);

    const filter: Record<string, unknown> = { portal_slug: slug };
    if (pageSlug) filter.page_slug = pageSlug;
    if (formType) filter.form_type = formType;

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      B2BFormSubmission.find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      B2BFormSubmission.countDocuments(filter),
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
    console.error("[GET /api/b2b/b2b/portals/[slug]/forms]", error);
    const message = error instanceof Error ? error.message : "Failed to list submissions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
