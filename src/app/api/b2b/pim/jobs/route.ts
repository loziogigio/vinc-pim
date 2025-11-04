import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { ImportJobModel } from "@/lib/db/models/import-job";

/**
 * GET /api/b2b/pim/jobs
 * List import jobs with filters and pagination
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
    const source = searchParams.get("source");
    const batch = searchParams.get("batch");
    const search = searchParams.get("search");
    const createdFrom = searchParams.get("created_from");
    const createdTo = searchParams.get("created_to");
    const completedFrom = searchParams.get("completed_from");
    const completedTo = searchParams.get("completed_to");

    // Build query
    const query: any = {};

    if (status) {
      query.status = status;
    }

    if (source) {
      query.source_id = { $regex: source, $options: "i" };
    }

    if (batch) {
      query["batch_id"] = { $regex: batch, $options: "i" };
    }

    if (search) {
      query.$or = [
        { file_name: { $regex: search, $options: "i" } },
        { job_id: { $regex: search, $options: "i" } },
        { source_id: { $regex: search, $options: "i" } },
      ];
    }

    // Created date range filter
    if (createdFrom || createdTo) {
      query.created_at = {};
      if (createdFrom) {
        query.created_at.$gte = new Date(createdFrom);
      }
      if (createdTo) {
        // Include the entire end date
        const endDate = new Date(createdTo);
        endDate.setHours(23, 59, 59, 999);
        query.created_at.$lte = endDate;
      }
    }

    // Completed date range filter
    if (completedFrom || completedTo) {
      query.completed_at = {};
      if (completedFrom) {
        query.completed_at.$gte = new Date(completedFrom);
      }
      if (completedTo) {
        // Include the entire end date
        const endDate = new Date(completedTo);
        endDate.setHours(23, 59, 59, 999);
        query.completed_at.$lte = endDate;
      }
    }

    // Get total count
    const total = await ImportJobModel.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    // Get paginated jobs
    const jobs = await ImportJobModel.find(query)
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
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
