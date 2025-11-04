import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectToDatabase } from "@/lib/db/connection";
import { ImportSourceModel } from "@/lib/db/models/import-source";

/**
 * GET /api/b2b/pim/sources
 * List all import sources with pagination and filtering
 */
export async function GET(req: NextRequest) {
  try {
    // TODO: Re-enable authentication
    // const session = await getB2BSession();
    // if (!session || session.role !== "admin") {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "";

    // Build query
    const query: any = {};

    if (search) {
      query.$or = [
        { source_name: { $regex: search, $options: "i" } },
        { source_id: { $regex: search, $options: "i" } },
      ];
    }

    if (type) {
      query.source_type = type;
    }

    // Get total count
    const total = await ImportSourceModel.countDocuments(query);

    // Get paginated sources
    const sources = await ImportSourceModel.find(query)
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return NextResponse.json({
      sources,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching sources:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/b2b/pim/sources
 * Create new import source configuration
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await req.json();

    // Validate required fields
    if (!body.source_id || !body.source_name || !body.source_type) {
      return NextResponse.json(
        { error: "Missing required fields: source_id, source_name, source_type" },
        { status: 400 }
      );
    }

    // Check if source_id already exists
    const existing = await ImportSourceModel.findOne({
      source_id: body.source_id,
    });

    if (existing) {
      return NextResponse.json(
        { error: "Source ID already exists" },
        { status: 409 }
      );
    }

    const source = await ImportSourceModel.create({
      ...body,
      wholesaler_id: session.userId,
      created_by: session.userId,
      stats: {
        total_imports: 0,
        total_products: 0,
        avg_completeness_score: 0,
      },
    });

    return NextResponse.json({ source }, { status: 201 });
  } catch (error) {
    console.error("Error creating source:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
