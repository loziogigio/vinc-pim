import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";

type RouteParams = { params: Promise<{ slug: string }> };

const toSlug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * GET /api/b2b/b2c/storefronts/[slug]/form-definitions
 * List all form definitions for a storefront
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug } = await params;
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    const { FormDefinition } = await connectWithModels(auth.tenantDb);

    const filter = { storefront_slug: slug };
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      FormDefinition.find(filter)
        .sort({ is_system: -1, created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FormDefinition.countDocuments(filter),
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
    console.error("[GET .../form-definitions]", error);
    const message = error instanceof Error ? error.message : "Failed to list form definitions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/b2b/b2c/storefronts/[slug]/form-definitions
 * Create a new form definition
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug } = await params;
    const body = await req.json();

    const { name, config, notification_emails, send_submitter_copy, enabled } = body;
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const defSlug = body.slug?.trim() || toSlug(name);
    if (!defSlug) {
      return NextResponse.json({ error: "Could not generate slug from name" }, { status: 400 });
    }

    const { FormDefinition } = await connectWithModels(auth.tenantDb);

    // Check uniqueness
    const existing = await FormDefinition.findOne({
      storefront_slug: slug,
      slug: defSlug,
    }).lean();
    if (existing) {
      return NextResponse.json(
        { error: `A form definition with slug "${defSlug}" already exists` },
        { status: 409 }
      );
    }

    const doc = await FormDefinition.create({
      storefront_slug: slug,
      slug: defSlug,
      name: name.trim(),
      config: config || { variant: "form", fields: [] },
      notification_emails: notification_emails || [],
      send_submitter_copy: send_submitter_copy ?? false,
      is_system: false,
      enabled: enabled ?? true,
    });

    return NextResponse.json({ success: true, data: doc }, { status: 201 });
  } catch (error) {
    console.error("[POST .../form-definitions]", error);
    const message = error instanceof Error ? error.message : "Failed to create form definition";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
