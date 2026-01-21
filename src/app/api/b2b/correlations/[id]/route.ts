import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";

/**
 * GET /api/b2b/correlations/[id]
 * Get a single correlation by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check for API key authentication first
    const authMethod = req.headers.get("x-auth-method");
    let tenantDb: string;

    if (authMethod === "api-key") {
      const apiKeyResult = await verifyAPIKeyFromRequest(req, "read");
      if (!apiKeyResult.authenticated) {
        return NextResponse.json(
          { error: apiKeyResult.error || "Unauthorized" },
          { status: apiKeyResult.statusCode || 401 }
        );
      }
      tenantDb = apiKeyResult.tenantDb!;
    } else {
      const session = await getB2BSession();
      if (!session || !session.tenantId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      tenantDb = `vinc-${session.tenantId}`;
    }

    const { ProductCorrelation } = await connectWithModels(tenantDb);

    const { id } = await params;

    const correlation = await ProductCorrelation.findOne({
      correlation_id: id,
    }).lean();

    if (!correlation) {
      return NextResponse.json(
        { error: "Correlation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ correlation });
  } catch (error) {
    console.error("Error fetching correlation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/b2b/correlations/[id]
 * Update a correlation
 *
 * Body:
 * - position: Display order
 * - is_active: Active status
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check for API key authentication first
    const authMethod = req.headers.get("x-auth-method");
    let tenantDb: string;

    if (authMethod === "api-key") {
      const apiKeyResult = await verifyAPIKeyFromRequest(req, "write");
      if (!apiKeyResult.authenticated) {
        return NextResponse.json(
          { error: apiKeyResult.error || "Unauthorized" },
          { status: apiKeyResult.statusCode || 401 }
        );
      }
      tenantDb = apiKeyResult.tenantDb!;
    } else {
      const session = await getB2BSession();
      if (!session || !session.tenantId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      tenantDb = `vinc-${session.tenantId}`;
    }

    const { ProductCorrelation } = await connectWithModels(tenantDb);

    const { id } = await params;
    const body = await req.json();

    // Only allow updating certain fields
    const allowedFields = ["position", "is_active"];
    const updateDoc: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateDoc[field] = body[field];
      }
    }

    if (Object.keys(updateDoc).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const correlation = await ProductCorrelation.findOneAndUpdate(
      { correlation_id: id },
      { $set: updateDoc },
      { new: true }
    ).lean();

    if (!correlation) {
      return NextResponse.json(
        { error: "Correlation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      correlation,
    });
  } catch (error) {
    console.error("Error updating correlation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/b2b/correlations/[id]
 * Delete a correlation
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check for API key authentication first
    const authMethod = req.headers.get("x-auth-method");
    let tenantDb: string;

    if (authMethod === "api-key") {
      const apiKeyResult = await verifyAPIKeyFromRequest(req, "write");
      if (!apiKeyResult.authenticated) {
        return NextResponse.json(
          { error: apiKeyResult.error || "Unauthorized" },
          { status: apiKeyResult.statusCode || 401 }
        );
      }
      tenantDb = apiKeyResult.tenantDb!;
    } else {
      const session = await getB2BSession();
      if (!session || !session.tenantId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      tenantDb = `vinc-${session.tenantId}`;
    }

    const { ProductCorrelation } = await connectWithModels(tenantDb);

    const { id } = await params;

    // Find the correlation first to check if it's bidirectional
    const correlation = await ProductCorrelation.findOne({
      correlation_id: id,
    }).lean() as any;

    if (!correlation) {
      return NextResponse.json(
        { error: "Correlation not found" },
        { status: 404 }
      );
    }

    // Delete the correlation
    await ProductCorrelation.deleteOne({ correlation_id: id });

    let deletedCount = 1;

    // If bidirectional, also delete the reverse correlation
    if (correlation.is_bidirectional) {
      const reverseResult = await ProductCorrelation.deleteOne({
        source_entity_code: correlation.target_entity_code,
        target_entity_code: correlation.source_entity_code,
        correlation_type: correlation.correlation_type,
      });
      deletedCount += reverseResult.deletedCount || 0;
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedCount} correlation(s)`,
      deletedCount,
    });
  } catch (error) {
    console.error("Error deleting correlation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
