/**
 * Admin Commissions Overview
 *
 * GET /api/admin/payments/commissions
 *
 * Returns per-tenant commission summary.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth, unauthorizedResponse } from "@/lib/auth/admin-auth";
import { listTenants } from "@/lib/services/admin-tenant.service";
import { getPooledConnection } from "@/lib/db/connection";
import { getTenantCommissionSummary, getTenantCommissionRate } from "@/lib/payments/commission.service";

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth) return unauthorizedResponse();

  try {
    const tenants = await listTenants();
    const activeTenants = tenants.filter((t) => t.status === "active");

    const commissions = [];

    for (const tenant of activeTenants) {
      try {
        const dbName = `vinc-${tenant.tenant_id}`;
        const connection = await getPooledConnection(dbName);

        const [summary, rate] = await Promise.all([
          getTenantCommissionSummary(connection, tenant.tenant_id),
          getTenantCommissionRate(connection, tenant.tenant_id),
        ]);

        commissions.push({
          tenant_id: tenant.tenant_id,
          tenant_name: tenant.name,
          commission_rate: rate,
          total_collected: Math.round(summary.total_collected * 100) / 100,
          transaction_count: summary.transaction_count,
        });
      } catch {
        // Skip tenants with connection issues
      }
    }

    // Sort by total_collected descending
    commissions.sort((a, b) => b.total_collected - a.total_collected);

    return NextResponse.json({
      success: true,
      commissions,
    });
  } catch (error) {
    console.error("Admin commissions error:", error);
    return NextResponse.json(
      { error: "Failed to get commissions" },
      { status: 500 }
    );
  }
}
