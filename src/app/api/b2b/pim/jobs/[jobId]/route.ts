/**
 * Job Management API
 * Manage individual import jobs: retry, cancel, delete
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { importQueue } from "@/lib/queue/queues";

/**
 * POST /api/b2b/pim/jobs/[jobId]
 * Perform actions on a job: retry, cancel, or delete
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await params;
    const { action } = await req.json();

    // Get the job from the queue
    const job = await importQueue.getJob(jobId);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    switch (action) {
      case "retry":
        // Retry a failed job
        const state = await job.getState();
        if (state === "failed") {
          await job.retry();
          return NextResponse.json({
            success: true,
            message: "Job queued for retry"
          });
        } else {
          return NextResponse.json(
            { error: `Cannot retry job in state: ${state}` },
            { status: 400 }
          );
        }

      case "cancel":
        // Cancel an active or waiting job
        const currentState = await job.getState();
        if (currentState === "active" || currentState === "waiting") {
          await job.remove();
          return NextResponse.json({
            success: true,
            message: "Job cancelled"
          });
        } else {
          return NextResponse.json(
            { error: `Cannot cancel job in state: ${currentState}` },
            { status: 400 }
          );
        }

      case "delete":
        // Delete a completed or failed job
        await job.remove();
        return NextResponse.json({
          success: true,
          message: "Job deleted"
        });

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
    const session = await getB2BSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await params;
    const job = await importQueue.getJob(jobId);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const state = await job.getState();
    const progress = job.progress;
    const failedReason = job.failedReason;
    const stacktrace = job.stacktrace;

    return NextResponse.json({
      job: {
        id: job.id,
        name: job.name,
        data: job.data,
        state,
        progress,
        failedReason,
        stacktrace,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        returnvalue: job.returnvalue,
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
