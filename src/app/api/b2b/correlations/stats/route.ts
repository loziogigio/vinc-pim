import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import { CORRELATION_TYPES, CorrelationType } from "@/lib/constants/correlation";

/**
 * GET /api/b2b/correlations/stats
 * Get correlation statistics for dashboard
 */
export async function GET(req: NextRequest) {
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

    const { ProductCorrelation, ImportJob } = await connectWithModels(tenantDb);

    // Get total correlations count
    const totalCorrelations = await ProductCorrelation.countDocuments({
      is_active: true,
    });

    // Get unique products with correlations
    const uniqueSourceProducts = await ProductCorrelation.distinct("source_entity_code", {
      is_active: true,
    });
    const productsWithCorrelations = uniqueSourceProducts.length;

    // Get counts by type
    const typeAggregation = await ProductCorrelation.aggregate([
      { $match: { is_active: true } },
      { $group: { _id: "$correlation_type", count: { $sum: 1 } } },
    ]);

    // Initialize by_type with all types set to 0
    const byType: Record<CorrelationType, number> = {} as Record<CorrelationType, number>;
    for (const type of CORRELATION_TYPES) {
      byType[type] = 0;
    }

    // Fill in actual counts
    for (const item of typeAggregation) {
      if (CORRELATION_TYPES.includes(item._id as CorrelationType)) {
        byType[item._id as CorrelationType] = item.count;
      }
    }

    // Get last import info (look for correlation imports)
    const lastImport = await ImportJob.findOne({
      job_type: "import",
      status: { $in: ["completed", "failed", "partial"] },
    })
      .sort({ completed_at: -1 })
      .select("job_id completed_at total_rows successful_rows failed_rows")
      .lean() as any;

    const stats = {
      total_correlations: totalCorrelations,
      products_with_correlations: productsWithCorrelations,
      by_type: byType,
      last_import: lastImport
        ? {
            job_id: lastImport.job_id,
            imported_at: lastImport.completed_at,
            rows_processed: lastImport.total_rows || 0,
            success_count: lastImport.successful_rows || 0,
            error_count: lastImport.failed_rows || 0,
          }
        : undefined,
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error("Error fetching correlation stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
