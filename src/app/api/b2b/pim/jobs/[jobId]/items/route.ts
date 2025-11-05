/**
 * API route to fetch imported items for a specific job
 * Shows the actual data that was imported
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { ImportJobModel } from "@/lib/db/models/import-job";
import { AssociationJobModel } from "@/lib/db/models/association-job";
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

    // Try to find the job in ImportJob first
    let job = await ImportJobModel.findOne({ job_id: jobId }).lean() as any;
    let jobType: "import" | "association" | null = null;

    if (job) {
      jobType = "import";
    } else {
      // Try AssociationJob
      job = await AssociationJobModel.findOne({ job_id: jobId }).lean() as any;
      if (job) {
        jobType = "association";
      }
    }

    if (!job || !jobType) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Handle import jobs
    if (jobType === "import") {
      // Build query to find products imported by this job
      const jobStartTime = new Date(job.created_at);
      const jobEndTime = job.completed_at ? new Date(job.completed_at) : new Date();

      const conditions: any[] = [
        { "source.source_id": job.source_id },
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
          ...job,
          job_category: "import",
        },
      });
    }

    // Handle association jobs
    if (jobType === "association") {
      const entityCodes = job.metadata?.entity_codes || [];

      // Filter by search if provided
      let filteredCodes = entityCodes;
      if (search) {
        filteredCodes = entityCodes.filter((code: string) =>
          code.toLowerCase().includes(search.toLowerCase())
        );
      }

      // Paginate entity codes
      const total = filteredCodes.length;
      const paginatedCodes = filteredCodes.slice(
        (page - 1) * limit,
        page * limit
      );

      // Fetch product details for the paginated entity codes
      const products = await PIMProductModel.find({
        entity_code: { $in: paginatedCodes },
        wholesaler_id: job.wholesaler_id,
        isCurrent: true,
      })
        .select("entity_code sku name status brand collections category image")
        .lean() as any[];

      // Create a map for quick lookup
      const productMap = new Map(
        products.map((p: any) => [p.entity_code, p])
      );

      // Create items array with both successful and failed
      const items = paginatedCodes.map((code: string) => {
        const product = productMap.get(code);
        if (product) {
          return {
            ...product,
            association_status: "success",
          };
        } else {
          return {
            entity_code: code,
            association_status: "failed",
            error: "Product not found or association failed",
          };
        }
      });

      return NextResponse.json({
        products: items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        job: {
          ...job,
          job_category: "association",
        },
      });
    }
  } catch (error) {
    console.error("Error fetching job items:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
