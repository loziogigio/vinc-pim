/**
 * List Recurring Contracts
 *
 * GET /api/b2b/payments/recurring
 *
 * Paginated list of recurring payment contracts for a tenant.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getPooledConnection } from "@/lib/db/connection";
import { getModelRegistry } from "@/lib/db/model-registry";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const skip = (page - 1) * limit;

    const status = searchParams.get("status");
    const provider = searchParams.get("provider");
    const contractType = searchParams.get("contract_type");
    const search = searchParams.get("search");

    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);
    const registry = getModelRegistry(connection);
    const RecurringContract = registry.RecurringContract;

    const query: Record<string, unknown> = { tenant_id: auth.tenantId };

    if (status) query.status = status;
    if (provider) query.provider = provider;
    if (contractType) query.contract_type = contractType;

    if (search) {
      query.$or = [
        { contract_id: { $regex: search, $options: "i" } },
        { customer_id: { $regex: search, $options: "i" } },
        { provider_contract_id: { $regex: search, $options: "i" } },
      ];
    }

    const [contracts, total] = await Promise.all([
      RecurringContract.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      RecurringContract.countDocuments(query),
    ]);

    return NextResponse.json({
      contracts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("List recurring contracts error:", error);
    return NextResponse.json(
      { error: "Failed to list recurring contracts" },
      { status: 500 }
    );
  }
}
