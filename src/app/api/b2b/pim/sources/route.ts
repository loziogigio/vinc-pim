import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";

/**
 * GET /api/b2b/pim/sources
 * List all import sources with pagination and filtering
 */
export async function GET(req: NextRequest) {
  try {
    // Check for API key authentication first
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
    const { ImportSource: ImportSourceModel } = await connectWithModels(tenantDb);

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
    // Check for API key authentication first
    const authMethod = req.headers.get("x-auth-method");
    let createdBy = "api";
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
      createdBy = `api-key:${req.headers.get("x-api-key-id")}`;
    } else {
      const session = await getB2BSession();
      if (!session || !session.isLoggedIn || !session.tenantId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      tenantDb = `vinc-${session.tenantId}`;
      createdBy = session.userId || "session";
    }

    // Get tenant-specific models from connection pool
    const { ImportSource: ImportSourceModel } = await connectWithModels(tenantDb);

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
      // No wholesaler_id - database provides isolation
      created_by: createdBy,
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
