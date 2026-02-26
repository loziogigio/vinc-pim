/**
 * List Payment Transactions
 *
 * GET /api/b2b/payments/transactions
 *
 * Server-side paginated list of payment transactions for a tenant.
 * Supports filtering by status, provider, payment_type, order_id, and date range.
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

    // Filters
    const status = searchParams.get("status");
    const provider = searchParams.get("provider");
    const paymentType = searchParams.get("payment_type");
    const orderId = searchParams.get("order_id");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const search = searchParams.get("search");

    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);
    const registry = getModelRegistry(connection);
    const PaymentTransaction = registry.PaymentTransaction;

    // Build query
    const query: Record<string, unknown> = { tenant_id: auth.tenantId };

    if (status) query.status = status;
    if (provider) query.provider = provider;
    if (paymentType) query.payment_type = paymentType;
    if (orderId) query.order_id = orderId;

    if (dateFrom || dateTo) {
      const dateQuery: Record<string, Date> = {};
      if (dateFrom) dateQuery.$gte = new Date(dateFrom);
      if (dateTo) dateQuery.$lte = new Date(dateTo);
      query.created_at = dateQuery;
    }

    if (search) {
      query.$or = [
        { transaction_id: { $regex: search, $options: "i" } },
        { provider_payment_id: { $regex: search, $options: "i" } },
        { customer_email: { $regex: search, $options: "i" } },
        { order_id: { $regex: search, $options: "i" } },
      ];
    }

    const [transactions, total] = await Promise.all([
      PaymentTransaction.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .select("-events") // Exclude audit trail from list view
        .lean(),
      PaymentTransaction.countDocuments(query),
    ]);

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("List transactions error:", error);
    return NextResponse.json(
      { error: "Failed to list transactions" },
      { status: 500 }
    );
  }
}
