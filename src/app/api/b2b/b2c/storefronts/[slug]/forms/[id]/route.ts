import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";

type RouteParams = { params: Promise<{ slug: string; id: string }> };

/**
 * GET /api/b2b/b2c/storefronts/[slug]/forms/[id]
 * Get a single form submission
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { id } = await params;
    const { FormSubmission } = await connectWithModels(auth.tenantDb);

    const submission = await FormSubmission.findById(id).lean();
    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: submission });
  } catch (error) {
    console.error("[GET .../forms/[id]]", error);
    const message = error instanceof Error ? error.message : "Failed to get submission";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/b2b/b2c/storefronts/[slug]/forms/[id]
 * Delete a form submission
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { id } = await params;
    const { FormSubmission } = await connectWithModels(auth.tenantDb);

    const result = await FormSubmission.findByIdAndDelete(id);
    if (!result) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE .../forms/[id]]", error);
    const message = error instanceof Error ? error.message : "Failed to delete submission";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
