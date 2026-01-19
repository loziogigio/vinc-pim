/**
 * API Route: Trigger Import for Source
 * POST /api/b2b/pim/sources/[source_id]/trigger
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { importQueue } from "@/lib/queue/queues";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ source_id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { source_id } = await params;

    const tenantDb = `vinc-${session.tenantId}`;
    const { ImportSource: ImportSourceModel, ImportJob: ImportJobModel } =
      await connectWithModels(tenantDb);

    // Find the source
    const source = await ImportSourceModel.findOne({ source_id });

    if (!source) {
      return NextResponse.json(
        { error: "Import source not found" },
        { status: 404 }
      );
    }

    // Verify it's an API source with configuration
    if (source.source_type !== "api") {
      return NextResponse.json(
        { error: "This endpoint only supports API sources. For CSV/Excel uploads, use the upload endpoint." },
        { status: 400 }
      );
    }

    if (!source.api_config || !source.api_config.endpoint) {
      return NextResponse.json(
        { error: "API configuration missing. Please configure the API endpoint first." },
        { status: 400 }
      );
    }

    // Create a new import job
    const jobId = `api-import-${source_id}-${Date.now()}`;

    const importJob = await ImportJobModel.create({
      // No wholesaler_id - database provides isolation
      source_id: source.source_id,
      job_id: jobId,
      status: "pending",
      total_rows: 0,
      processed_rows: 0,
      successful_rows: 0,
      failed_rows: 0,
      auto_published_count: 0,
      import_errors: [],
      created_at: new Date(),
      updated_at: new Date()
    });

    // Add job to BullMQ queue
    const queueJob = await importQueue.add(
      "api-import",
      {
        source_id: source.source_id,
        // No wholesaler_id - database provides isolation
        job_id: jobId,
        api_config: source.api_config,
        field_mappings: source.field_mappings,
        auto_publish_enabled: source.auto_publish_enabled,
        min_score_threshold: source.min_score_threshold,
        required_fields: source.required_fields,
      },
      {
        jobId: jobId,
        removeOnComplete: false,
        removeOnFail: false,
      }
    );

    return NextResponse.json({
      success: true,
      job_id: jobId,
      queue_job_id: queueJob.id,
      message: "Import job created and queued for processing",
      monitor_url: "/api/admin/bull-board",
      status_url: `/api/b2b/pim/sources/${source_id}/jobs/${jobId}`
    });

  } catch (error) {
    console.error("Error triggering import:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to trigger import" },
      { status: 500 }
    );
  }
}
