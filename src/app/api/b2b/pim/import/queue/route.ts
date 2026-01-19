import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { importQueue } from "@/lib/queue/queues";

/**
 * POST /api/b2b/pim/import/queue
 * Queue products for asynchronous import via the import-worker
 *
 * This endpoint queues the job and returns immediately.
 * The import-worker processes the job in the background.
 *
 * Example request body:
 * {
 *   "source_id": "api-source-1",
 *   "products": [
 *     {
 *       "entity_code": "SKU001",
 *       "sku": "SKU001",
 *       "name": "Product Name",
 *       "description": "Product description",
 *       "price": 29.99
 *     }
 *   ],
 *   "batch_metadata": {
 *     "batch_id": "batch_123",
 *     "batch_part": 1,
 *     "batch_total_parts": 3,
 *     "batch_total_items": 300
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { ImportSource: ImportSourceModel, ImportJob: ImportJobModel } = await connectWithModels(tenantDb);

    const body = await req.json();
    const { source_id, products, batch_metadata } = body;

    // Validate request
    if (!source_id) {
      return NextResponse.json(
        { error: "Missing source_id in request body" },
        { status: 400 }
      );
    }

    if (!products || !Array.isArray(products)) {
      return NextResponse.json(
        { error: "Missing or invalid products array in request body" },
        { status: 400 }
      );
    }

    if (products.length === 0) {
      return NextResponse.json(
        { error: "Products array is empty" },
        { status: 400 }
      );
    }

    if (products.length > 10000) {
      return NextResponse.json(
        { error: "Too many products. Maximum 10,000 per request" },
        { status: 400 }
      );
    }

    // Verify source exists
    console.log(`🔍 Looking for source: ${source_id}`);
    const source = await ImportSourceModel.findOne({ source_id });

    if (!source) {
      const allSources = await ImportSourceModel.find({}).limit(10);
      console.log(`📋 Available sources in DB:`, allSources.map(s => s.source_id));
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Generate job ID
    const jobId = `queue_import_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create import job record (pending status)
    await ImportJobModel.create({
      source_id: source_id,
      job_id: jobId,
      file_name: `Queue Import - ${products.length} products`,
      file_size: JSON.stringify(products).length,
      status: "pending",
      total_rows: products.length,
      ...(batch_metadata?.batch_id && { batch_id: batch_metadata.batch_id }),
      ...(batch_metadata && {
        batch_part: batch_metadata.batch_part,
        batch_total_parts: batch_metadata.batch_total_parts,
        batch_total_items: batch_metadata.batch_total_items,
      }),
    });

    console.log(`\n📮 Queuing import job: ${jobId}`);
    console.log(`   Products: ${products.length}`);
    console.log(`   Source: ${source_id}`);
    if (batch_metadata) {
      console.log(`   Batch: ${batch_metadata.batch_id} (part ${batch_metadata.batch_part}/${batch_metadata.batch_total_parts})`);
    }

    // Queue the job for import-worker to process
    await importQueue.add(
      "process-import",
      {
        job_id: jobId,
        source_id: source_id,
        // Pass products directly - import-worker.ts line 159 handles this
        products: products,
        api_config: {
          endpoint: "direct-queue", // Marker for direct products from queue endpoint
          method: "GET",
        },
        // Include batch metadata if provided
        ...(batch_metadata && { batch_metadata }),
      },
      {
        jobId: jobId,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      }
    );

    console.log(`✅ Job ${jobId} queued successfully`);

    return NextResponse.json({
      success: true,
      job_id: jobId,
      status: "queued",
      summary: {
        products_queued: products.length,
        source_id: source_id,
        batch_metadata: batch_metadata || null,
      },
      message: `Queued ${products.length} products for import. Job ID: ${jobId}`,
      monitoring: {
        job_status_endpoint: `/api/b2b/pim/import/jobs/${jobId}`,
        redis_queue_check: "redis-cli llen bull:import-queue:wait",
        mongodb_check: `db.importjobs.findOne({ job_id: "${jobId}" })`,
      },
    });
  } catch (error: any) {
    console.error("Error queuing import job:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/b2b/pim/import/queue
 * Get queue status and pending jobs count
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { ImportJob: ImportJobModel } = await connectWithModels(tenantDb);

    // Get pending and processing jobs
    const pendingJobs = await ImportJobModel.find({ status: "pending" })
      .sort({ created_at: -1 })
      .limit(10)
      .select("job_id source_id total_rows status created_at batch_id batch_part batch_total_parts")
      .lean();

    const processingJobs = await ImportJobModel.find({ status: "processing" })
      .sort({ started_at: -1 })
      .limit(5)
      .select("job_id source_id total_rows processed_rows status started_at batch_id batch_part")
      .lean();

    // Get queue stats from Redis if available
    let queueStats = null;
    try {
      const waitingCount = await importQueue.getWaitingCount();
      const activeCount = await importQueue.getActiveCount();
      const completedCount = await importQueue.getCompletedCount();
      const failedCount = await importQueue.getFailedCount();

      queueStats = {
        waiting: waitingCount,
        active: activeCount,
        completed: completedCount,
        failed: failedCount,
      };
    } catch (e) {
      // Redis might not be available
    }

    return NextResponse.json({
      queue_stats: queueStats,
      pending_jobs: pendingJobs,
      processing_jobs: processingJobs,
    });
  } catch (error: any) {
    console.error("Error fetching queue status:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
