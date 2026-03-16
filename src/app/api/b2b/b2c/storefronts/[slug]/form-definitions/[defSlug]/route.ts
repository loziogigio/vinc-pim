import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";

type RouteParams = { params: Promise<{ slug: string; defSlug: string }> };

/**
 * GET /api/b2b/b2c/storefronts/[slug]/form-definitions/[defSlug]
 * Get a single form definition
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug, defSlug } = await params;
    const { FormDefinition } = await connectWithModels(auth.tenantDb);

    const doc = await FormDefinition.findOne({
      storefront_slug: slug,
      slug: defSlug,
    }).lean();

    if (!doc) {
      return NextResponse.json({ error: "Form definition not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: doc });
  } catch (error) {
    console.error("[GET .../form-definitions/[defSlug]]", error);
    const message = error instanceof Error ? error.message : "Failed to get form definition";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/b2b/b2c/storefronts/[slug]/form-definitions/[defSlug]
 * Update a form definition
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug, defSlug } = await params;
    const body = await req.json();
    const { FormDefinition } = await connectWithModels(auth.tenantDb);

    const doc = await FormDefinition.findOne({
      storefront_slug: slug,
      slug: defSlug,
    });

    if (!doc) {
      return NextResponse.json({ error: "Form definition not found" }, { status: 404 });
    }

    // Update allowed fields
    if (body.name !== undefined) doc.set("name", body.name.trim());
    if (body.config !== undefined) doc.set("config", body.config);
    if (body.notification_emails !== undefined) doc.set("notification_emails", body.notification_emails);
    if (body.send_submitter_copy !== undefined) doc.set("send_submitter_copy", body.send_submitter_copy);
    if (body.enabled !== undefined) doc.set("enabled", body.enabled);

    await doc.save();

    return NextResponse.json({ success: true, data: doc.toObject() });
  } catch (error) {
    console.error("[PUT .../form-definitions/[defSlug]]", error);
    const message = error instanceof Error ? error.message : "Failed to update form definition";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/b2b/b2c/storefronts/[slug]/form-definitions/[defSlug]
 * Delete a form definition (blocked for system forms)
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug, defSlug } = await params;
    const { FormDefinition } = await connectWithModels(auth.tenantDb);

    const doc = await FormDefinition.findOne({
      storefront_slug: slug,
      slug: defSlug,
    }).lean();

    if (!doc) {
      return NextResponse.json({ error: "Form definition not found" }, { status: 404 });
    }

    if (doc.is_system) {
      return NextResponse.json(
        { error: "System form definitions cannot be deleted" },
        { status: 403 }
      );
    }

    await FormDefinition.deleteOne({ _id: doc._id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE .../form-definitions/[defSlug]]", error);
    const message = error instanceof Error ? error.message : "Failed to delete form definition";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
