import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import {
  DEFAULT_CSV_LABELS,
  exportSubmissionsToCsv,
} from "@/lib/services/form-submission-export";

type RouteParams = { params: Promise<{ slug: string }> };

/**
 * POST /api/b2b/b2b/portals/[slug]/forms/export
 * Export B2B portal form submissions to CSV.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug } = await params;
    const body = await req.json().catch(() => ({}));

    const { B2BFormSubmission, B2BFormDefinition } = await connectWithModels(
      auth.tenantDb
    );

    return await exportSubmissionsToCsv({
      body,
      scopeField: "portal_slug",
      slug,
      submissionModel: B2BFormSubmission as never,
      definitionModel: B2BFormDefinition as never,
      labels: DEFAULT_CSV_LABELS,
    });
  } catch (error) {
    console.error("Error exporting B2B form submissions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
