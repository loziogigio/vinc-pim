/**
 * GET /api/b2b/pricing/stats
 *
 * Aggregated pricing stats (30-day window) + circuit breaker state.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { getCircuitState } from "@/lib/pricing/circuit-breaker";

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId } = auth;

  try {
    const { PricingRequestLog, TenantPricingConfig } =
      await connectWithModels(tenantDb);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Aggregate stats
    const [statsResult] = await PricingRequestLog.aggregate([
      { $match: { created_at: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: null,
          total_requests: { $sum: 1 },
          success_count: {
            $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
          },
          failed_count: {
            $sum: {
              $cond: [
                { $in: ["$status", ["failed", "timed_out", "circuit_open"]] },
                1,
                0,
              ],
            },
          },
          avg_duration_ms: { $avg: "$duration_ms" },
          total_resolved: { $sum: "$resolved_count" },
          total_errors: { $sum: "$error_count" },
        },
      },
    ]);

    const stats = statsResult || {
      total_requests: 0,
      success_count: 0,
      failed_count: 0,
      avg_duration_ms: 0,
      total_resolved: 0,
      total_errors: 0,
    };

    const successRate =
      stats.total_requests > 0
        ? Math.round((stats.success_count / stats.total_requests) * 100)
        : 0;

    // Get circuit breaker state
    const circuitState = getCircuitState(tenantId);

    // Get active provider info
    const config = await TenantPricingConfig.findOne({
      tenant_id: tenantId,
    }).lean();

    // Recent logs (last 5)
    const recentLogs = await PricingRequestLog.find()
      .sort({ created_at: -1 })
      .limit(5)
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          total_requests: stats.total_requests,
          success_count: stats.success_count,
          failed_count: stats.failed_count,
          success_rate: successRate,
          avg_duration_ms: Math.round(stats.avg_duration_ms || 0),
          total_resolved: stats.total_resolved,
          total_errors: stats.total_errors,
        },
        circuit_breaker: circuitState,
        active_provider: config?.active_provider || null,
        recent_logs: recentLogs,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/b2b/pricing/stats] Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
