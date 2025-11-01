/**
 * Batch Tracking Utility
 * Helper functions for tracking split batch imports
 */

import { ImportJobModel } from "../db/models/import-job";

export interface BatchProgress {
  batch_id: string;
  total_parts: number;
  completed_parts: number;
  failed_parts: number;
  in_progress_parts: number;
  total_items_processed: number;
  total_items_failed: number;
  is_complete: boolean;
  status: "incomplete" | "in_progress" | "partial_success" | "complete" | "failed";
  missing_parts: number[];
  jobs: any[];
}

/**
 * Check batch completion status and progress
 */
export async function checkBatchCompletion(
  batch_id: string,
  wholesaler_id?: string
): Promise<BatchProgress> {
  const filter: any = { batch_id };
  if (wholesaler_id) {
    filter.wholesaler_id = wholesaler_id;
  }

  const jobs = await ImportJobModel.find(filter).sort({ batch_part: 1 }).exec();

  if (jobs.length === 0) {
    throw new Error(`No jobs found for batch_id: ${batch_id}`);
  }

  const expectedParts = jobs[0]?.batch_total_parts || 0;
  const receivedParts = jobs.length;

  // Check for missing parts
  const missing_parts: number[] = [];
  if (receivedParts < expectedParts) {
    for (let i = 1; i <= expectedParts; i++) {
      if (!jobs.find((j) => j.batch_part === i)) {
        missing_parts.push(i);
      }
    }
  }

  // Calculate progress
  const completed_parts = jobs.filter((j) => j.status === "completed").length;
  const failed_parts = jobs.filter((j) => j.status === "failed").length;
  const in_progress_parts = jobs.filter(
    (j) => j.status === "processing" || j.status === "pending"
  ).length;

  const total_items_processed = jobs.reduce((sum, j) => sum + j.successful_rows, 0);
  const total_items_failed = jobs.reduce((sum, j) => sum + j.failed_rows, 0);

  const allCompleted = jobs.every(
    (j) => j.status === "completed" || j.status === "failed"
  );
  const anyFailed = jobs.some((j) => j.status === "failed");
  const allFailed = jobs.every((j) => j.status === "failed");

  // Determine overall status
  let status: BatchProgress["status"];
  if (missing_parts.length > 0) {
    status = "incomplete";
  } else if (in_progress_parts > 0) {
    status = "in_progress";
  } else if (allFailed) {
    status = "failed";
  } else if (allCompleted) {
    status = anyFailed ? "partial_success" : "complete";
  } else {
    status = "in_progress";
  }

  return {
    batch_id,
    total_parts: expectedParts,
    completed_parts,
    failed_parts,
    in_progress_parts,
    total_items_processed,
    total_items_failed,
    is_complete: allCompleted && missing_parts.length === 0,
    status,
    missing_parts,
    jobs: jobs.map((j) => ({
      job_id: j.job_id,
      batch_part: j.batch_part,
      status: j.status,
      total_rows: j.total_rows,
      successful_rows: j.successful_rows,
      failed_rows: j.failed_rows,
      created_at: j.created_at,
      completed_at: j.completed_at,
    })),
  };
}

/**
 * Get all batches with their progress
 */
export async function getAllBatches(wholesaler_id: string) {
  const batchGroups = await ImportJobModel.aggregate([
    {
      $match: {
        wholesaler_id,
        batch_id: { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: "$batch_id",
        total_parts: { $first: "$batch_total_parts" },
        total_items: { $first: "$batch_total_items" },
        completed_count: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        failed_count: {
          $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
        },
        in_progress_count: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ["$status", "processing"] },
                  { $eq: ["$status", "pending"] },
                ],
              },
              1,
              0,
            ],
          },
        },
        total_successful: { $sum: "$successful_rows" },
        total_failed: { $sum: "$failed_rows" },
        latest_update: { $max: "$updated_at" },
        earliest_created: { $min: "$created_at" },
        jobs: { $push: "$$ROOT" },
      },
    },
    { $sort: { latest_update: -1 } },
  ]);

  return batchGroups.map((batch) => ({
    batch_id: batch._id,
    total_parts: batch.total_parts,
    total_items: batch.total_items,
    completed_parts: batch.completed_count,
    failed_parts: batch.failed_count,
    in_progress_parts: batch.in_progress_count,
    total_successful: batch.total_successful,
    total_failed: batch.total_failed,
    progress_percent:
      batch.total_parts > 0
        ? Math.round((batch.completed_count / batch.total_parts) * 100)
        : 0,
    status:
      batch.in_progress_count > 0
        ? "in_progress"
        : batch.failed_count > 0
        ? "partial_success"
        : "complete",
    latest_update: batch.latest_update,
    earliest_created: batch.earliest_created,
    jobs: batch.jobs,
  }));
}

/**
 * Auto-generate batch_id for sources without explicit batch metadata
 * Groups imports by source + time window (1 hour)
 */
export async function autoGenerateBatchId(
  source_id: string,
  wholesaler_id: string
): Promise<string> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const recentJobs = await ImportJobModel.find({
    source_id,
    wholesaler_id,
    created_at: { $gte: oneHourAgo },
    batch_id: { $exists: false }, // Only jobs without explicit batch_id
  })
    .sort({ created_at: 1 })
    .limit(1)
    .exec();

  if (recentJobs.length > 0) {
    // Use existing auto-generated batch
    return `auto-${source_id}-${recentJobs[0]._id}`;
  }

  // Create new auto-generated batch
  return `auto-${source_id}-${Date.now()}`;
}
