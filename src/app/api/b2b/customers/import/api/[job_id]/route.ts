/**
 * GET /api/b2b/customers/import/api/[job_id]
 *
 * Get the status and progress of a customer import job.
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import { connectWithModels } from "@/lib/db/connection";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ job_id: string }> },
) {
  try {
    const { job_id } = await params;

    // Authenticate
    const authMethod = req.headers.get("x-auth-method");
    let tenantDb: string;

    if (authMethod === "api-key") {
      const apiKeyResult = await verifyAPIKeyFromRequest(req, "customers");
      if (!apiKeyResult.authenticated) {
        return NextResponse.json(
          { error: apiKeyResult.error || "Unauthorized" },
          { status: apiKeyResult.statusCode || 401 },
        );
      }
      tenantDb = apiKeyResult.tenantDb!;
    } else {
      const session = await getB2BSession();
      if (!session || !session.isLoggedIn || !session.tenantId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      tenantDb = `vinc-${session.tenantId}`;
    }

    const { ImportJob: ImportJobModel } = await connectWithModels(tenantDb);

    const job = await ImportJobModel.findOne({
      job_id,
      job_type: "customer_import",
    }).lean();

    if (!job) {
      return NextResponse.json(
        { error: "Import job not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      job: {
        job_id: (job as any).job_id,
        status: (job as any).status,
        total_rows: (job as any).total_rows,
        processed_rows: (job as any).processed_rows,
        successful_rows: (job as any).successful_rows,
        failed_rows: (job as any).failed_rows,
        import_errors: (job as any).import_errors,
        started_at: (job as any).started_at,
        completed_at: (job as any).completed_at,
        duration_seconds: (job as any).duration_seconds,
        batch_id: (job as any).batch_id,
        batch_part: (job as any).batch_part,
        batch_total_parts: (job as any).batch_total_parts,
        created_at: (job as any).created_at,
      },
    });
  } catch (error: any) {
    console.error("Error fetching import job:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
