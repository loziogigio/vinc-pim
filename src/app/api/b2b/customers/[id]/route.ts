import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { validateLegalInfo, IAddress } from "@/lib/db/models/customer";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import {
  getPortalUserFromRequest,
  hasCustomerAccess,
} from "@/lib/auth/portal-user-token";
import type { ICustomerAccess } from "@/lib/types/portal-user";
import type { UpdateCustomerRequest } from "@/lib/types/customer";

/**
 * Authenticate and get tenant ID
 * Also checks for portal user token and returns customer access restrictions
 * Returns tenant-specific models from connection pool
 */
async function authenticateRequest(req: NextRequest): Promise<{
  authenticated: boolean;
  tenantId?: string;
  tenantDb?: string;
  models?: Awaited<ReturnType<typeof connectWithModels>>;
  customerAccess?: ICustomerAccess[];
  error?: string;
  statusCode?: number;
}> {
  const authMethod = req.headers.get("x-auth-method");
  let tenantId: string;
  let tenantDb: string;

  if (authMethod === "api-key") {
    const apiKeyResult = await verifyAPIKeyFromRequest(req, "customers");
    if (!apiKeyResult.authenticated) {
      return {
        authenticated: false,
        error: apiKeyResult.error || "Unauthorized",
        statusCode: apiKeyResult.statusCode || 401,
      };
    }
    tenantId = apiKeyResult.tenantId!;
    tenantDb = apiKeyResult.tenantDb!;
  } else {
    const session = await getB2BSession();
    if (!session || !session.isLoggedIn || !session.tenantId) {
      return { authenticated: false, error: "Unauthorized", statusCode: 401 };
    }
    tenantId = session.tenantId;
    tenantDb = `vinc-${session.tenantId}`;
  }

  // Get tenant-specific models from connection pool
  const models = await connectWithModels(tenantDb);

  // Check for portal user token (additional access restriction)
  const portalUser = await getPortalUserFromRequest(req, tenantDb);

  return {
    authenticated: true,
    tenantId,
    tenantDb,
    models,
    customerAccess: portalUser?.customerAccess,
  };
}

/**
 * GET /api/b2b/customers/[id]
 * Get a specific customer by customer_id with order stats
 * Supports both session auth and API key auth
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customer_id } = await params;

    // Authenticate and get tenant
    const auth = await authenticateRequest(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode });
    }
    const tenantId = auth.tenantId!;
    const { Customer: CustomerModel, Order: OrderModel } = auth.models;

    // Portal user access check
    if (auth.customerAccess && !hasCustomerAccess(auth.customerAccess, customer_id)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const customer = await CustomerModel.findOne({ customer_id, tenant_id: tenantId }).lean();

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Calculate date thresholds
    const now = new Date();
    const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const days60Ago = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const days90Ago = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Get all order stats in parallel (filtered by tenant)
    const [
      orderStats,
      recentOrders,
      ordersByPeriod,
      ordersByAddress,
    ] = await Promise.all([
      // Overall stats
      OrderModel.aggregate([
        { $match: { customer_id, tenant_id: tenantId } },
        {
          $group: {
            _id: null,
            order_count: { $sum: 1 },
            total_spent: { $sum: "$order_total" },
            last_order_date: { $max: "$created_at" },
            first_order_date: { $min: "$created_at" },
            draft_count: {
              $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] },
            },
            pending_count: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
            },
            confirmed_count: {
              $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] },
            },
            shipped_count: {
              $sum: { $cond: [{ $eq: ["$status", "shipped"] }, 1, 0] },
            },
            cancelled_count: {
              $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
            },
            avg_order_value: { $avg: "$order_total" },
          },
        },
      ]),
      // Recent orders
      OrderModel.find({ customer_id, tenant_id: tenantId })
        .sort({ created_at: -1 })
        .limit(5)
        .select("order_id order_number status order_total created_at items shipping_address_id")
        .lean(),
      // Orders by time period (30/60/90 days)
      OrderModel.aggregate([
        { $match: { customer_id, tenant_id: tenantId } },
        {
          $group: {
            _id: null,
            // Last 30 days
            orders_30d: {
              $sum: { $cond: [{ $gte: ["$created_at", days30Ago] }, 1, 0] },
            },
            spent_30d: {
              $sum: { $cond: [{ $gte: ["$created_at", days30Ago] }, "$order_total", 0] },
            },
            // Last 60 days
            orders_60d: {
              $sum: { $cond: [{ $gte: ["$created_at", days60Ago] }, 1, 0] },
            },
            spent_60d: {
              $sum: { $cond: [{ $gte: ["$created_at", days60Ago] }, "$order_total", 0] },
            },
            // Last 90 days
            orders_90d: {
              $sum: { $cond: [{ $gte: ["$created_at", days90Ago] }, 1, 0] },
            },
            spent_90d: {
              $sum: { $cond: [{ $gte: ["$created_at", days90Ago] }, "$order_total", 0] },
            },
          },
        },
      ]),
      // Orders by shipping address
      OrderModel.aggregate([
        { $match: { customer_id, tenant_id: tenantId, shipping_address_id: { $ne: null } } },
        {
          $group: {
            _id: "$shipping_address_id",
            order_count: { $sum: 1 },
            total_spent: { $sum: "$order_total" },
            last_order_date: { $max: "$created_at" },
          },
        },
        { $sort: { order_count: -1 } },
      ]),
    ]);

    const stats = orderStats[0] || {
      order_count: 0,
      total_spent: 0,
      last_order_date: null,
      first_order_date: null,
      draft_count: 0,
      pending_count: 0,
      confirmed_count: 0,
      shipped_count: 0,
      cancelled_count: 0,
      avg_order_value: 0,
    };

    const periodStats = ordersByPeriod[0] || {
      orders_30d: 0,
      spent_30d: 0,
      orders_60d: 0,
      spent_60d: 0,
      orders_90d: 0,
      spent_90d: 0,
    };

    // Map address stats to include address details
    const addressStats = ordersByAddress.map((addrStat: { _id: string; order_count: number; total_spent: number; last_order_date: Date }) => {
      const address = (customer.addresses || []).find(
        (a: { address_id: string }) => a.address_id === addrStat._id
      );
      return {
        address_id: addrStat._id,
        address_label: address?.label || address?.city || "Unknown",
        address_city: address?.city,
        address_type: address?.address_type,
        order_count: addrStat.order_count,
        total_spent: addrStat.total_spent,
        last_order_date: addrStat.last_order_date,
      };
    });

    return NextResponse.json({
      success: true,
      customer: {
        ...customer,
        order_stats: {
          ...stats,
          ...periodStats,
        },
        orders_by_address: addressStats,
        recent_orders: recentOrders,
      },
    });
  } catch (error) {
    console.error("Error fetching customer:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/b2b/customers/[id]
 * Update a customer
 * Supports both session auth and API key auth
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customer_id } = await params;

    // Authenticate and get tenant
    const auth = await authenticateRequest(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode });
    }
    const tenantId = auth.tenantId!;
    const { Customer: CustomerModel } = auth.models;

    // Portal user access check - can only modify accessible customers
    if (auth.customerAccess && !hasCustomerAccess(auth.customerAccess, customer_id)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Find the customer (with tenant filter for security)
    const customer = await CustomerModel.findOne({ customer_id, tenant_id: tenantId });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    const body: UpdateCustomerRequest = await req.json();

    // Validate legal info if provided
    if (body.legal_info) {
      const validation = validateLegalInfo(body.legal_info);
      if (!validation.valid) {
        return NextResponse.json(
          { error: "Invalid legal info", details: validation.errors },
          { status: 400 }
        );
      }
    }

    // Check email uniqueness if changing
    if (body.email && body.email !== customer.email) {
      const existingCustomer = await CustomerModel.findOne({
        tenant_id: customer.tenant_id,
        email: body.email,
        customer_id: { $ne: customer_id },
      });

      if (existingCustomer) {
        return NextResponse.json(
          { error: "Customer with this email already exists" },
          { status: 409 }
        );
      }
    }

    // Allowed fields to update
    const allowedFields = [
      "customer_type",
      "email",
      "is_guest",
      "external_code",
      "phone",
      "first_name",
      "last_name",
      "company_name",
      "legal_info",
      "default_shipping_address_id",
      "default_billing_address_id",
    ];

    // Build update object
    const updateDoc: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field as keyof UpdateCustomerRequest] !== undefined) {
        updateDoc[field] = body[field as keyof UpdateCustomerRequest];
      }
    }

    // Validate default address IDs exist
    if (body.default_shipping_address_id) {
      const exists = customer.addresses.some(
        (a: IAddress) => a.address_id === body.default_shipping_address_id
      );
      if (!exists) {
        return NextResponse.json(
          { error: "Invalid default_shipping_address_id" },
          { status: 400 }
        );
      }
    }

    if (body.default_billing_address_id) {
      const exists = customer.addresses.some(
        (a: IAddress) => a.address_id === body.default_billing_address_id
      );
      if (!exists) {
        return NextResponse.json(
          { error: "Invalid default_billing_address_id" },
          { status: 400 }
        );
      }
    }

    // Update the customer
    const updatedCustomer = await CustomerModel.findOneAndUpdate(
      { customer_id },
      { $set: updateDoc },
      { new: true }
    ).lean();

    return NextResponse.json({
      success: true,
      customer: updatedCustomer,
      message: "Customer updated successfully",
    });
  } catch (error) {
    console.error("Error updating customer:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/b2b/customers/[id]
 * Delete a customer
 * Supports both session auth and API key auth
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customer_id } = await params;

    // Authenticate and get tenant
    const auth = await authenticateRequest(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode });
    }
    const tenantId = auth.tenantId!;
    const { Customer: CustomerModel } = auth.models;

    // Portal user access check - can only delete accessible customers
    if (auth.customerAccess && !hasCustomerAccess(auth.customerAccess, customer_id)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Find the customer first (with tenant filter for security)
    const customer = await CustomerModel.findOne({ customer_id, tenant_id: tenantId });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    await CustomerModel.deleteOne({ customer_id, tenant_id: tenantId });

    return NextResponse.json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting customer:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
