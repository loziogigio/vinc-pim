import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { ImportJobModel } from "@/lib/db/models/import-job";

/**
 * GET /api/b2b/pim/batches
 * Get list of unique batch IDs for autocomplete
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";

    // Build query to find batch IDs
    const query: any = {
      batch_id: { $exists: true, $ne: null, $nin: [""] },
    };

    // If search term provided, filter batch IDs
    if (search) {
      query.batch_id = { $regex: search, $options: "i" };
    }

    // Get distinct batch IDs from import jobs
    const batches = await ImportJobModel.distinct("batch_id", query);

    // Sort and limit to 50 most recent
    const sortedBatches = batches
      .filter((b) => b) // Remove any null/undefined
      .sort()
      .reverse()
      .slice(0, 50);

    return NextResponse.json({
      batches: sortedBatches,
    });
  } catch (error) {
    console.error("Error fetching batch IDs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
