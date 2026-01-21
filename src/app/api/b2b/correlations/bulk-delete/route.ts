import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import { CORRELATION_TYPES, CorrelationType } from "@/lib/constants/correlation";

interface BulkDeleteResult {
  deleted: number;
  failed: number;
  errors: Array<{
    correlation_id: string;
    error: string;
  }>;
}

/**
 * POST /api/b2b/correlations/bulk-delete
 * Bulk delete correlations
 *
 * Body options:
 * 1. Delete by IDs:
 *    { "correlation_ids": ["id1", "id2", ...] }
 *
 * 2. Delete by filter:
 *    {
 *      "filter": {
 *        "source_entity_code": "001479",      // Optional
 *        "target_entity_code": "001480",      // Optional
 *        "correlation_type": "related"        // Optional (default: all types)
 *      }
 *    }
 *
 * 3. Delete all of a type:
 *    { "delete_all": true, "correlation_type": "related" }
 */
export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const { correlation_ids, filter, delete_all, correlation_type } = body;

    const result: BulkDeleteResult = {
      deleted: 0,
      failed: 0,
      errors: [],
    };

    // Option 1: Delete by specific IDs
    if (Array.isArray(correlation_ids) && correlation_ids.length > 0) {
      if (correlation_ids.length > 1000) {
        return NextResponse.json(
          { error: "Maximum 1000 correlation IDs per request" },
          { status: 400 }
        );
      }

      const deleteResult = await ProductCorrelation.deleteMany({
        correlation_id: { $in: correlation_ids },
      });

      result.deleted = deleteResult.deletedCount || 0;

      // Check if some IDs were not found
      if (result.deleted < correlation_ids.length) {
        result.failed = correlation_ids.length - result.deleted;
      }

      return NextResponse.json({
        success: true,
        result,
        message: `Deleted ${result.deleted} correlation(s)`,
      });
    }

    // Option 2: Delete by filter
    if (filter && typeof filter === "object") {
      const query: Record<string, unknown> = {};

      if (filter.source_entity_code) {
        query.source_entity_code = filter.source_entity_code;
      }
      if (filter.target_entity_code) {
        query.target_entity_code = filter.target_entity_code;
      }
      if (filter.correlation_type) {
        if (!CORRELATION_TYPES.includes(filter.correlation_type as CorrelationType)) {
          return NextResponse.json(
            { error: `Invalid correlation_type. Must be one of: ${CORRELATION_TYPES.join(", ")}` },
            { status: 400 }
          );
        }
        query.correlation_type = filter.correlation_type;
      }

      // Require at least one filter criterion to prevent accidental mass deletion
      if (Object.keys(query).length === 0) {
        return NextResponse.json(
          { error: "Filter must specify at least one criterion (source_entity_code, target_entity_code, or correlation_type)" },
          { status: 400 }
        );
      }

      const deleteResult = await ProductCorrelation.deleteMany(query);
      result.deleted = deleteResult.deletedCount || 0;

      return NextResponse.json({
        success: true,
        result,
        message: `Deleted ${result.deleted} correlation(s) matching filter`,
      });
    }

    // Option 3: Delete all of a specific type
    if (delete_all === true) {
      if (!correlation_type) {
        return NextResponse.json(
          { error: "correlation_type is required when using delete_all" },
          { status: 400 }
        );
      }

      if (!CORRELATION_TYPES.includes(correlation_type as CorrelationType)) {
        return NextResponse.json(
          { error: `Invalid correlation_type. Must be one of: ${CORRELATION_TYPES.join(", ")}` },
          { status: 400 }
        );
      }

      const deleteResult = await ProductCorrelation.deleteMany({
        correlation_type,
      });

      result.deleted = deleteResult.deletedCount || 0;

      return NextResponse.json({
        success: true,
        result,
        message: `Deleted all ${result.deleted} ${correlation_type} correlation(s)`,
      });
    }

    // No valid deletion criteria provided
    return NextResponse.json(
      { error: "Must provide correlation_ids array, filter object, or delete_all with correlation_type" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error in bulk correlation delete:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
