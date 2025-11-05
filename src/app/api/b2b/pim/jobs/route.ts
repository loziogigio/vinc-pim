import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { ImportJobModel } from "@/lib/db/models/import-job";
import { AssociationJobModel } from "@/lib/db/models/association-job";

/**
 * GET /api/b2b/pim/jobs
 * List import jobs and association jobs with filters and pagination
 */
export async function GET(req: NextRequest) {
  try {
    // TODO: Re-enable authentication
    // const session = await getB2BSession();
    // if (!session) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const status = searchParams.get("status");
    const jobType = searchParams.get("job_type"); // "import" or "association"
    const source = searchParams.get("source");
    const batch = searchParams.get("batch");
    const search = searchParams.get("search");
    const createdFrom = searchParams.get("created_from");
    const createdTo = searchParams.get("created_to");
    const completedFrom = searchParams.get("completed_from");
    const completedTo = searchParams.get("completed_to");

    // Build base query
    const baseQuery: any = {};

    if (status) {
      baseQuery.status = status;
    }

    // Created date range filter
    if (createdFrom || createdTo) {
      baseQuery.created_at = {};
      if (createdFrom) {
        baseQuery.created_at.$gte = new Date(createdFrom);
      }
      if (createdTo) {
        const endDate = new Date(createdTo);
        endDate.setHours(23, 59, 59, 999);
        baseQuery.created_at.$lte = endDate;
      }
    }

    // Completed date range filter
    if (completedFrom || completedTo) {
      baseQuery.completed_at = {};
      if (completedFrom) {
        baseQuery.completed_at.$gte = new Date(completedFrom);
      }
      if (completedTo) {
        const endDate = new Date(completedTo);
        endDate.setHours(23, 59, 59, 999);
        baseQuery.completed_at.$lte = endDate;
      }
    }

    let importJobs: any[] = [];
    let associationJobs: any[] = [];
    let totalImport = 0;
    let totalAssociation = 0;

    // Fetch import jobs (if not filtering to association only)
    if (!jobType || jobType === "import") {
      const importQuery = { ...baseQuery };

      if (source) {
        importQuery.source_id = { $regex: source, $options: "i" };
      }

      if (batch) {
        importQuery.batch_id = { $regex: batch, $options: "i" };
      }

      if (search) {
        importQuery.$or = [
          { file_name: { $regex: search, $options: "i" } },
          { job_id: { $regex: search, $options: "i" } },
          { source_id: { $regex: search, $options: "i" } },
        ];
      }

      totalImport = await ImportJobModel.countDocuments(importQuery);
      importJobs = await ImportJobModel.find(importQuery)
        .sort({ created_at: -1 })
        .lean();

      // Add job_category for frontend
      importJobs = importJobs.map(job => ({ ...job, job_category: "import" }));
    }

    // Fetch association jobs (if not filtering to import only)
    if (!jobType || jobType === "association") {
      const associationQuery = { ...baseQuery };

      if (search) {
        associationQuery.$or = [
          { entity_name: { $regex: search, $options: "i" } },
          { job_id: { $regex: search, $options: "i" } },
          { "metadata.file_name": { $regex: search, $options: "i" } },
        ];
      }

      totalAssociation = await AssociationJobModel.countDocuments(associationQuery);
      associationJobs = await AssociationJobModel.find(associationQuery)
        .sort({ created_at: -1 })
        .lean();

      // Add job_category for frontend
      associationJobs = associationJobs.map(job => ({ ...job, job_category: "association" }));
    }

    // Merge and sort all jobs by created_at
    const allJobs = [...importJobs, ...associationJobs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Apply pagination
    const total = totalImport + totalAssociation;
    const totalPages = Math.ceil(total / limit);
    const paginatedJobs = allJobs.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      jobs: paginatedJobs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      counts: {
        import: totalImport,
        association: totalAssociation,
      },
    });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
