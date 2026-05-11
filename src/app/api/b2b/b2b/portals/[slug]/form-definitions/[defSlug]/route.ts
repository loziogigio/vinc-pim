import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import {
  isTenantMigrated,
  NOT_MIGRATED_RESPONSE_BODY,
} from "@/lib/services/b2b-portal-migration-flag.service";

type RouteParams = { params: Promise<{ slug: string; defSlug: string }> };

/**
 * GET /api/b2b/b2b/portals/[slug]/form-definitions/[defSlug]
 * Get a single form definition
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug, defSlug } = await params;
    const { B2BFormDefinition } = await connectWithModels(auth.tenantDb);

    const doc = await B2BFormDefinition.findOne({
      portal_slug: slug,
      slug: defSlug,
    }).lean();

    if (!doc) {
      return NextResponse.json({ error: "Form definition not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: doc });
  } catch (error) {
    console.error("[GET /api/b2b/b2b/portals/[slug]/form-definitions/[defSlug]]", error);
    const message = error instanceof Error ? error.message : "Failed to get form definition";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/b2b/b2b/portals/[slug]/form-definitions/[defSlug]
 * Update a form definition
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    if (!(await isTenantMigrated(auth.tenantId))) {
      return NextResponse.json(NOT_MIGRATED_RESPONSE_BODY, { status: 409 });
    }

    const { slug, defSlug } = await params;
    const body = await req.json();
    const { B2BFormDefinition } = await connectWithModels(auth.tenantDb);

    const doc = await B2BFormDefinition.findOne({
      portal_slug: slug,
      slug: defSlug,
    });

    if (!doc) {
      return NextResponse.json({ error: "Form definition not found" }, { status: 404 });
    }

    // Update allowed fields only (is_system is intentionally excluded)
    if (body.name !== undefined) doc.set("name", body.name.trim());
    if (body.config !== undefined) doc.set("config", body.config);
    if (body.notification_emails !== undefined) doc.set("notification_emails", body.notification_emails);
    if (body.send_submitter_copy !== undefined) doc.set("send_submitter_copy", body.send_submitter_copy);
    if (body.enabled !== undefined) doc.set("enabled", body.enabled);

    await doc.save();

    return NextResponse.json({ success: true, data: doc.toObject() });
  } catch (error) {
    console.error("[PUT /api/b2b/b2b/portals/[slug]/form-definitions/[defSlug]]", error);
    const message = error instanceof Error ? error.message : "Failed to update form definition";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/b2b/b2b/portals/[slug]/form-definitions/[defSlug]
 * Delete a form definition (blocked for system forms)
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    if (!(await isTenantMigrated(auth.tenantId))) {
      return NextResponse.json(NOT_MIGRATED_RESPONSE_BODY, { status: 409 });
    }

    const { slug, defSlug } = await params;
    const { B2BFormDefinition } = await connectWithModels(auth.tenantDb);

    const doc = await B2BFormDefinition.findOne({
      portal_slug: slug,
      slug: defSlug,
    }).lean();

    if (!doc) {
      return NextResponse.json({ error: "Form definition not found" }, { status: 404 });
    }

    if ((doc as { is_system: boolean }).is_system) {
      return NextResponse.json(
        { error: "System form definitions cannot be deleted" },
        { status: 403 }
      );
    }

    await B2BFormDefinition.deleteOne({ _id: (doc as { _id: unknown })._id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/b2b/b2b/portals/[slug]/form-definitions/[defSlug]]", error);
    const message = error instanceof Error ? error.message : "Failed to delete form definition";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
