import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import { safeRegexQuery, safePagination } from "@/lib/security";

/**
 * GET /api/b2b/pim/jobs
 * List import jobs and association jobs with filters and pagination
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate via API key or session
    const authMethod = req.headers.get("x-auth-method");
    let tenantDb: string;

    if (authMethod === "api-key") {
      const apiKeyResult = await verifyAPIKeyFromRequest(req, "pim");
      if (!apiKeyResult.authenticated) {
        return NextResponse.json(
          { error: apiKeyResult.error || "Unauthorized" },
          { status: apiKeyResult.statusCode || 401 }
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

    // Get tenant-specific models from connection pool
    const { ImportJob: ImportJobModel, AssociationJob: AssociationJobModel } = await connectWithModels(tenantDb);

    const { searchParams } = new URL(req.url);
    const { page, limit } = safePagination(searchParams, { limit: 25 });
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

    // Apply pagination at the DB level on each collection separately, then merge.
    // We over-fetch `skip + limit` per collection so the merged top page is correct
    // even when one side has all the most recent jobs. Worst-case extra fetch on
    // page N: 2 × N × limit docs (bounded). For page=1 limit=25 this is 50 docs total.
    const skip = (page - 1) * limit;
    const fetchPerCollection = skip + limit;

    let importJobs: any[] = [];
    let associationJobs: any[] = [];
    let totalImport = 0;
    let totalAssociation = 0;

    if (!jobType || jobType === "import") {
      const importQuery: any = { ...baseQuery };

      if (source) {
        importQuery.source_id = safeRegexQuery(source);
      }

      if (batch) {
        importQuery.batch_id = safeRegexQuery(batch);
      }

      if (search) {
        const safeSearch = safeRegexQuery(search);
        importQuery.$or = [
          { file_name: safeSearch },
          { job_id: safeSearch },
          { source_id: safeSearch },
        ];
      }

      // List preview: top 3 errors only, raw_data stripped (heaviest field).
      // Full errors are on /api/b2b/pim/jobs/[jobId]; frontend uses failed_rows for the real count.
      [totalImport, importJobs] = await Promise.all([
        ImportJobModel.countDocuments(importQuery),
        ImportJobModel.find(importQuery)
          .select({ import_errors: { $slice: 3 } })
          .sort({ created_at: -1 })
          .limit(fetchPerCollection)
          .lean(),
      ]);

      importJobs = importJobs.map((job: any) => ({
        ...job,
        job_category: "import",
        import_errors: (job.import_errors || []).map((e: any) => ({
          row: e.row,
          entity_code: e.entity_code,
          error: e.error,
        })),
      }));
    }

    if (!jobType || jobType === "association") {
      const associationQuery: any = { ...baseQuery };

      if (search) {
        const safeSearch = safeRegexQuery(search);
        associationQuery.$or = [
          { entity_name: safeSearch },
          { job_id: safeSearch },
          { "metadata.file_name": safeSearch },
        ];
      }

      [totalAssociation, associationJobs] = await Promise.all([
        AssociationJobModel.countDocuments(associationQuery),
        AssociationJobModel.find(associationQuery)
          .sort({ created_at: -1 })
          .limit(fetchPerCollection)
          .lean(),
      ]);

      associationJobs = associationJobs.map((job) => ({ ...job, job_category: "association" }));
    }

    const allJobs = [...importJobs, ...associationJobs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const total = totalImport + totalAssociation;
    const totalPages = Math.ceil(total / limit) || 1;
    const paginatedJobs = allJobs.slice(skip, skip + limit);

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
