import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import {
  isTenantMigrated,
  NOT_MIGRATED_RESPONSE_BODY,
} from "@/lib/services/b2b-portal-migration-flag.service";

type RouteParams = { params: Promise<{ slug: string; id: string }> };

/**
 * GET /api/b2b/b2b/portals/[slug]/forms/[id]
 * Get a single form submission
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug, id } = await params;
    const { B2BFormSubmission } = await connectWithModels(auth.tenantDb);

    const submission = await B2BFormSubmission.findById(id).lean();
    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // Guard: ensure the submission belongs to the requested portal
    if ((submission as { portal_slug: string }).portal_slug !== slug) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: submission });
  } catch (error) {
    console.error("[GET /api/b2b/b2b/portals/[slug]/forms/[id]]", error);
    const message = error instanceof Error ? error.message : "Failed to get submission";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/b2b/b2b/portals/[slug]/forms/[id]
 * Update submission (toggle seen)
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    if (!(await isTenantMigrated(auth.tenantId))) {
      return NextResponse.json(NOT_MIGRATED_RESPONSE_BODY, { status: 409 });
    }

    const { slug, id } = await params;
    const body = await req.json();
    const { B2BFormSubmission } = await connectWithModels(auth.tenantDb);

    // Verify ownership before updating
    const existing = await B2BFormSubmission.findById(id).lean();
    if (!existing) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }
    if ((existing as { portal_slug: string }).portal_slug !== slug) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    const update: Record<string, unknown> = {};
    if (typeof body.seen === "boolean") update.seen = body.seen;

    const submission = await B2BFormSubmission.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: submission });
  } catch (error) {
    console.error("[PATCH /api/b2b/b2b/portals/[slug]/forms/[id]]", error);
    const message = error instanceof Error ? error.message : "Failed to update submission";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/b2b/b2b/portals/[slug]/forms/[id]
 * Delete a form submission
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    if (!(await isTenantMigrated(auth.tenantId))) {
      return NextResponse.json(NOT_MIGRATED_RESPONSE_BODY, { status: 409 });
    }

    const { slug, id } = await params;
    const { B2BFormSubmission } = await connectWithModels(auth.tenantDb);

    // Verify ownership before deleting
    const existing = await B2BFormSubmission.findById(id).lean();
    if (!existing) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }
    if ((existing as { portal_slug: string }).portal_slug !== slug) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    await B2BFormSubmission.findByIdAndDelete(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/b2b/b2b/portals/[slug]/forms/[id]]", error);
    const message = error instanceof Error ? error.message : "Failed to delete submission";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
