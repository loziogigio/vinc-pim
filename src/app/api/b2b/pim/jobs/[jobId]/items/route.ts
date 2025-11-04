/**
 * API route to fetch imported items for a specific job
 * Shows the actual data that was imported
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { ImportJobModel } from "@/lib/db/models/import-job";
import { PIMProductModel } from "@/lib/db/models/pim-product";

/**
 * GET /api/b2b/pim/jobs/[jobId]/items
 * Fetch imported products for a specific job with pagination and search
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // TODO: Re-enable authentication when needed
    // const session = await getB2BSession();
    // if (!session || session.role !== "admin") {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    await connectToDatabase();

    const { jobId } = await params;
    const { searchParams } = new URL(req.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const search = searchParams.get("search") || "";
    const statusFilter = searchParams.get("status") || "";

    // Get the job to extract source_id
    const job = await ImportJobModel.findOne({ job_id: jobId }).lean();

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Build query to find products imported by this job
    // Try to match by job_id first, but fall back to source_id and import time range
    const jobStartTime = new Date((job as any).created_at);
    const jobEndTime = (job as any).completed_at ? new Date((job as any).completed_at) : new Date();

    const conditions: any[] = [
      { "source.source_id": (job as any).source_id },
    ];

    // Add job matching condition (job_id or import time range)
    conditions.push({
      $or: [
        { "source.job_id": jobId }, // If job_id is stored
        { // Fall back to matching by import time
          "source.imported_at": {
            $gte: jobStartTime.toISOString(),
            $lte: jobEndTime.toISOString(),
          },
        },
      ],
    });

    // Add search filter
    if (search) {
      conditions.push({
        $or: [
          { entity_code: { $regex: search, $options: "i" } },
          { sku: { $regex: search, $options: "i" } },
          { name: { $regex: search, $options: "i" } },
        ],
      });
    }

    // Add status filter
    if (statusFilter) {
      conditions.push({ status: statusFilter });
    }

    const query = { $and: conditions };

    // Get total count
    const total = await PIMProductModel.countDocuments(query);

    // Fetch paginated products
    const products = await PIMProductModel.find(query)
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      job: {
        job_id: (job as any).job_id,
        source_id: (job as any).source_id,
        batch_id: (job as any).batch_id,
        status: (job as any).status,
        total_rows: (job as any).total_rows,
        successful_rows: (job as any).successful_rows,
        failed_rows: (job as any).failed_rows,
        auto_published_count: (job as any).auto_published_count,
        created_at: (job as any).created_at,
        completed_at: (job as any).completed_at,
        duration_seconds: (job as any).duration_seconds,
        import_errors: (job as any).import_errors || [],
      },
    });
  } catch (error) {
    console.error("Error fetching job items:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
