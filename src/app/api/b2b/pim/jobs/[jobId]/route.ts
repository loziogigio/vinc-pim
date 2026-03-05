/**
 * Job Management API
 * Manage individual import jobs: retry, cancel, delete
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { importQueue, customerImportQueue, portalUserImportQueue } from "@/lib/queue/queues";

/**
 * Try to find a BullMQ job across all import-related queues
 */
async function findBullMQJob(jobId: string) {
  for (const queue of [importQueue, customerImportQueue, portalUserImportQueue]) {
    const job = await queue.getJob(jobId);
    if (job) return { job, queue };
  }
  return null;
}

/**
 * POST /api/b2b/pim/jobs/[jobId]
 * Perform actions on a job: retry, cancel, or delete
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb } = auth;
    const { jobId } = await params;
    const { action } = await req.json();

    const { ImportJob, AssociationJob } = await connectWithModels(tenantDb);

    switch (action) {
      case "retry": {
        const result = await findBullMQJob(jobId);
        if (!result) {
          return NextResponse.json({ error: "Job not found in queue" }, { status: 404 });
        }
        const state = await result.job.getState();
        if (state !== "failed") {
          return NextResponse.json(
            { error: `Cannot retry job in state: ${state}` },
            { status: 400 }
          );
        }
        await result.job.retry();
        // Reset status in MongoDB
        await ImportJob.updateOne(
          { job_id: jobId },
          { $set: { status: "pending" } }
        );
        await AssociationJob.updateOne(
          { job_id: jobId },
          { $set: { status: "pending" } }
        );
        return NextResponse.json({
          success: true,
          message: "Job queued for retry",
        });
      }

      case "cancel": {
        // Find the job in MongoDB first
        let mongoJob: any =
          (await ImportJob.findOne({ job_id: jobId })) ||
          (await AssociationJob.findOne({ job_id: jobId }));

        if (!mongoJob) {
          return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        if (mongoJob.status !== "pending" && mongoJob.status !== "processing") {
          return NextResponse.json(
            { error: `Cannot cancel job in status: ${mongoJob.status}` },
            { status: 400 }
          );
        }

        // Try to remove from BullMQ queue
        const result = await findBullMQJob(jobId);
        if (result) {
          const state = await result.job.getState();
          if (state === "waiting" || state === "delayed") {
            await result.job.remove();
          } else if (state === "active") {
            // For active jobs, move to failed so the worker stops
            await result.job.moveToFailed(
              new Error("Job cancelled by user"),
              result.job.token || "0"
            );
          }
        }

        // Update MongoDB status to cancelled
        const now = new Date();
        const updateFields = {
          status: "cancelled",
          completed_at: now,
        };

        await ImportJob.updateOne({ job_id: jobId }, { $set: updateFields });
        await AssociationJob.updateOne({ job_id: jobId }, { $set: updateFields });

        return NextResponse.json({
          success: true,
          message: "Job cancelled",
        });
      }

      case "delete": {
        // Remove from BullMQ if present
        const result = await findBullMQJob(jobId);
        if (result) {
          await result.job.remove();
        }

        // Delete from MongoDB
        await ImportJob.deleteOne({ job_id: jobId });
        await AssociationJob.deleteOne({ job_id: jobId });

        return NextResponse.json({
          success: true,
          message: "Job deleted",
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error managing job:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/b2b/pim/jobs/[jobId]
 * Get detailed information about a specific job
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb } = auth;
    const { jobId } = await params;
    const { ImportJob, AssociationJob } = await connectWithModels(tenantDb);

    // Check MongoDB for job details
    const mongoJob =
      (await ImportJob.findOne({ job_id: jobId }).lean()) ||
      (await AssociationJob.findOne({ job_id: jobId }).lean());

    // Also try BullMQ for queue state
    const result = await findBullMQJob(jobId);

    if (!mongoJob && !result) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const queueState = result ? await result.job.getState() : null;

    return NextResponse.json({
      job: {
        ...(mongoJob || {}),
        id: result?.job.id || jobId,
        name: result?.job.name,
        state: queueState,
        progress: result?.job.progress,
        failedReason: result?.job.failedReason,
        stacktrace: result?.job.stacktrace,
        attemptsMade: result?.job.attemptsMade,
        timestamp: result?.job.timestamp,
        processedOn: result?.job.processedOn,
        finishedOn: result?.job.finishedOn,
        returnvalue: result?.job.returnvalue,
      },
    });
  } catch (error) {
    console.error("Error fetching job:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
