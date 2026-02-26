/**
 * Admin Payment Stats
 *
 * GET /api/admin/payments/stats
 *
 * Aggregates payment statistics across all tenants.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth, unauthorizedResponse } from "@/lib/auth/admin-auth";
import { listTenants } from "@/lib/services/admin-tenant.service";
import { getPooledConnection } from "@/lib/db/connection";
import { getModelRegistry } from "@/lib/db/model-registry";

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth) return unauthorizedResponse();

  try {
    const tenants = await listTenants();
    const activeTenants = tenants.filter((t) => t.status === "active");

    let totalVolume = 0;
    let totalCommissions = 0;
    let totalTransactions = 0;
    let tenantsWithPayments = 0;

    for (const tenant of activeTenants) {
      try {
        const dbName = `vinc-${tenant.tenant_id}`;
        const connection = await getPooledConnection(dbName);
        const registry = getModelRegistry(connection);
        const PaymentTransaction = registry.PaymentTransaction;

        if (!PaymentTransaction) continue;

        const result = await PaymentTransaction.aggregate([
          { $match: { status: "completed" } },
          {
            $group: {
              _id: null,
              volume: { $sum: "$gross_amount" },
              commissions: { $sum: "$commission_amount" },
              count: { $sum: 1 },
            },
          },
        ]);

        if (result.length > 0) {
          totalVolume += result[0].volume || 0;
          totalCommissions += result[0].commissions || 0;
          totalTransactions += result[0].count || 0;
          tenantsWithPayments++;
        }
      } catch {
        // Skip tenants with connection issues
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        total_volume: Math.round(totalVolume * 100) / 100,
        total_commissions: Math.round(totalCommissions * 100) / 100,
        active_tenants: tenantsWithPayments,
        total_transactions: totalTransactions,
      },
    });
  } catch (error) {
    console.error("Admin payment stats error:", error);
    return NextResponse.json(
      { error: "Failed to get payment stats" },
      { status: 500 }
    );
  }
}
