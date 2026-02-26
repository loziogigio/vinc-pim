/**
 * Payment Dashboard Stats
 *
 * GET /api/b2b/payments/stats
 *
 * Aggregated payment statistics for tenant dashboard.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getPooledConnection } from "@/lib/db/connection";
import { getModelRegistry } from "@/lib/db/model-registry";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);
    const registry = getModelRegistry(connection);
    const PaymentTransaction = registry.PaymentTransaction;

    const result = await PaymentTransaction.aggregate([
      { $match: { tenant_id: auth.tenantId } },
      {
        $group: {
          _id: null,
          total_transactions: { $sum: 1 },
          total_volume: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, "$gross_amount", 0],
            },
          },
          completed_count: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, 1, 0],
            },
          },
          pending_count: {
            $sum: {
              $cond: [
                { $in: ["$status", ["pending", "processing"]] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const stats = result[0] || {
      total_transactions: 0,
      total_volume: 0,
      completed_count: 0,
      pending_count: 0,
    };

    const successfulRate =
      stats.total_transactions > 0
        ? Math.round((stats.completed_count / stats.total_transactions) * 1000) / 10
        : 0;

    return NextResponse.json({
      success: true,
      stats: {
        total_transactions: stats.total_transactions,
        total_volume: Math.round(stats.total_volume * 100) / 100,
        successful_rate: successfulRate,
        pending_count: stats.pending_count,
      },
    });
  } catch (error) {
    console.error("Payment stats error:", error);
    return NextResponse.json(
      { error: "Failed to get payment stats" },
      { status: 500 }
    );
  }
}
