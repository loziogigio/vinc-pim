import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import {
  DEFAULT_CSV_LABELS,
  exportSubmissionsToCsv,
} from "@/lib/services/form-submission-export";

type RouteParams = { params: Promise<{ slug: string }> };

/**
 * POST /api/b2b/b2c/storefronts/[slug]/forms/export
 * Export form submissions to CSV — either an explicit id selection or every row
 * matching the inbox's filters.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug } = await params;
    const body = await req.json().catch(() => ({}));

    const { FormSubmission, FormDefinition } = await connectWithModels(auth.tenantDb);

    return await exportSubmissionsToCsv({
      body,
      scopeField: "storefront_slug",
      slug,
      submissionModel: FormSubmission as never,
      definitionModel: FormDefinition as never,
      labels: DEFAULT_CSV_LABELS,
    });
  } catch (error) {
    console.error("Error exporting form submissions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
