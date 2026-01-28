import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { getNextCartNumber } from "@/lib/db/models/counter";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import {
  getPortalUserFromRequest,
  getAccessibleCustomerIds,
  hasCustomerAccess,
} from "@/lib/auth/portal-user-token";
import type { ICustomerAccess } from "@/lib/types/portal-user";
import { nanoid } from "nanoid";
import type { CreateOrderRequest } from "@/lib/types/order";
import {
  findOrCreateCustomer,
  findOrCreateAddress,
} from "@/lib/services/customer.service";

/**
 * Authenticate request via session or API key
 * Also checks for portal user token and returns customer access restrictions
 * Returns tenant-specific models from connection pool
 */
async function authenticateRequest(req: NextRequest, scope: string): Promise<{
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
    const apiKeyResult = await verifyAPIKeyFromRequest(req, scope);
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
 * GET /api/b2b/orders
 * List orders for the current tenant with pagination and filters
 * Supports both session auth and API key auth
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, "orders");
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.statusCode || 401 }
      );
    }
    const tenantId = auth.tenantId!;
    const { Order: OrderModel, Customer: CustomerModel } = auth.models;

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");
    const year = searchParams.get("year");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const customerId = searchParams.get("customer_id");
    const cartNumber = searchParams.get("cart_number");
    const publicCode = searchParams.get("public_code");
    const customerCode = searchParams.get("customer_code"); // ERP code
    const isCurrent = searchParams.get("is_current"); // Active cart filter
    const shippingAddressId = searchParams.get("shipping_address_id"); // Address filter (internal ID)
    const shippingAddressCode = searchParams.get("shipping_address_code"); // Address filter (external/ERP code)

    // Build query - always filter by tenant
    const query: Record<string, unknown> = {
      tenant_id: tenantId,
    };

    // If portal user, restrict to accessible customers only
    if (auth.customerAccess && auth.customerAccess.length > 0) {
      const accessibleIds = getAccessibleCustomerIds(auth.customerAccess);
      query.customer_id = { $in: accessibleIds };
    }

    if (customerId) {
      // If portal user, verify access to the requested customer
      if (auth.customerAccess && !hasCustomerAccess(auth.customerAccess, customerId)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      query.customer_id = customerId;
    }

    if (status) {
      query.status = status;
    }

    if (year) {
      query.year = parseInt(year);
    }

    if (cartNumber) {
      query.cart_number = parseInt(cartNumber);
    }

    if (customerCode) {
      // ERP code filter - direct match on order's customer_code field
      query.customer_code = { $regex: customerCode, $options: "i" };
    }

    if (isCurrent === "true") {
      query.is_current = true;
    } else if (isCurrent === "false") {
      query.is_current = { $ne: true }; // false or undefined/null
    }

    if (shippingAddressId) {
      query.shipping_address_id = shippingAddressId;
    }

    if (shippingAddressCode) {
      query.shipping_address_code = shippingAddressCode;
    }

    // Public code filter - need to lookup customer_ids first (within tenant)
    if (publicCode) {
      const matchingCustomers = await CustomerModel.find({
        tenant_id: tenantId,
        public_code: { $regex: publicCode, $options: "i" },
      })
        .select("customer_id")
        .lean();

      const matchingIds = matchingCustomers.map((c) => c.customer_id);
      if (matchingIds.length > 0) {
        query.customer_id = { $in: matchingIds };
      } else {
        // No matching customers - return empty result
        return NextResponse.json({
          success: true,
          orders: [],
          pagination: { page, limit, total: 0, pages: 0 },
          stats: { draft: 0, pending: 0, confirmed: 0, shipped: 0, cancelled: 0, total: 0, totalValue: 0 },
        });
      }
    }

    // Date range filter
    if (dateFrom || dateTo) {
      query.created_at = {};
      if (dateFrom) {
        (query.created_at as Record<string, Date>).$gte = new Date(dateFrom);
      }
      if (dateTo) {
        // Set to end of day
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        (query.created_at as Record<string, Date>).$lte = endDate;
      }
    }

    // Build base query without status for stats aggregation
    const baseQuery = { ...query };
    delete baseQuery.status;

    // Execute queries in parallel: orders, count, and stats
    const [orders, total, statsAgg] = await Promise.all([
      OrderModel.find(query)
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      OrderModel.countDocuments(query),
      // Aggregate stats for the filtered dataset (without status filter)
      OrderModel.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            value: { $sum: "$order_total" },
          },
        },
      ]),
    ]);

    // Calculate stats from aggregation
    const stats = {
      draft: 0,
      pending: 0,
      confirmed: 0,
      shipped: 0,
      cancelled: 0,
      total: 0,
      totalValue: 0,
    };

    statsAgg.forEach((s: { _id: string; count: number; value: number }) => {
      if (s._id in stats) {
        stats[s._id as keyof typeof stats] = s.count;
      }
      stats.total += s.count;
      stats.totalValue += s.value || 0;
    });

    // Fetch customer details for all orders (within tenant)
    const customerIds = [...new Set(orders.map((o) => o.customer_id).filter(Boolean))];
    const customers = await CustomerModel.find({
      tenant_id: tenantId,
      customer_id: { $in: customerIds },
    })
      .select("customer_id company_name first_name last_name email external_code public_code")
      .lean();

    // Create a map for quick lookup
    const customerMap = new Map(
      customers.map((c) => [
        c.customer_id,
        {
          customer_name:
            c.company_name ||
            [c.first_name, c.last_name].filter(Boolean).join(" ") ||
            c.email,
          company_name: c.company_name,
          email: c.email,
          external_code: c.external_code,
          public_code: c.public_code,
        },
      ])
    );

    // Enrich orders with customer info
    const enrichedOrders = orders.map((order) => ({
      ...order,
      customer_name: customerMap.get(order.customer_id)?.customer_name || order.customer_id,
      customer_company: customerMap.get(order.customer_id)?.company_name,
      customer_email: customerMap.get(order.customer_id)?.email,
      customer_public_code: customerMap.get(order.customer_id)?.public_code,
    }));

    return NextResponse.json({
      success: true,
      orders: enrichedOrders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      stats,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/b2b/orders
 * Create a new draft order (cart)
 * Supports both session auth and API key auth
 *
 * Customer lookup priority:
 * 1. customer_id (internal ID)
 * 2. customer_code (external_code / ERP code)
 * 3. customer object (lookup by external_code or VAT, or create new)
 *
 * Address lookup priority:
 * 1. shipping_address_id (internal ID)
 * 2. shipping_address object (lookup by external_code, or create new)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, "orders");
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.statusCode || 401 }
      );
    }
    const tenant_id = auth.tenantId!;
    const { Order: OrderModel } = auth.models;

    const body: CreateOrderRequest = await req.json();

    // Validate that we have some customer identifier
    if (!body.customer_id && !body.customer_code && !body.customer) {
      return NextResponse.json(
        { error: "customer_id, customer_code, or customer object is required" },
        { status: 400 }
      );
    }

    // Find or create customer
    let customer;
    try {
      const result = await findOrCreateCustomer(tenant_id, {
        customer_id: body.customer_id,
        customer_code: body.customer_code,
        customer: body.customer,
      });
      customer = result.customer;
    } catch (error) {
      console.error("Error finding/creating customer:", error);
      return NextResponse.json(
        { error: "Failed to find or create customer" },
        { status: 400 }
      );
    }

    // Portal user access check
    if (auth.customerAccess && !hasCustomerAccess(auth.customerAccess, customer.customer_id)) {
      return NextResponse.json({ error: "Access denied to this customer" }, { status: 403 });
    }

    // Find or create shipping address (if provided)
    let shipping_address_id = body.shipping_address_id;
    if (!shipping_address_id && body.shipping_address) {
      try {
        const address = await findOrCreateAddress(customer, {
          address: body.shipping_address,
        });
        shipping_address_id = address.address_id;
      } catch (error) {
        console.error("Error finding/creating address:", error);
        // Non-fatal - continue without address
      }
    } else if (!shipping_address_id && customer.default_shipping_address_id) {
      // Use customer's default address if no address specified
      shipping_address_id = customer.default_shipping_address_id;
    }

    // Generate IDs
    const order_id = nanoid(12);
    const session_id = `sess_${nanoid(16)}`;
    const flow_id = `flow_${nanoid(16)}`;
    const year = new Date().getFullYear();
    const cart_number = await getNextCartNumber(auth.tenantDb!, year);

    // Create order with defaults
    const order = await OrderModel.create({
      order_id,
      cart_number, // Sequential cart number per year
      year,
      status: "draft",

      // Tenant
      tenant_id,

      // Customer (from found/created customer)
      customer_id: customer.customer_id,
      customer_code: customer.external_code,
      shipping_address_id: shipping_address_id || null,
      billing_address_id: body.billing_address_id || customer.default_billing_address_id,

      // Delivery
      requested_delivery_date: body.requested_delivery_date
        ? new Date(body.requested_delivery_date)
        : undefined,
      delivery_slot: body.delivery_slot,
      delivery_route: body.delivery_route,
      shipping_method: body.shipping_method,

      // Pricing Context
      price_list_id: body.price_list_id || "default",
      price_list_type: body.price_list_type || "wholesale",
      order_type: body.order_type || "b2b",
      currency: body.currency || "EUR",
      pricelist_type: body.pricelist_type, // External pricelist type (e.g., "VEND")
      pricelist_code: body.pricelist_code, // External pricelist code (e.g., "02")

      // Totals (all 0 initially)
      subtotal_gross: 0,
      subtotal_net: 0,
      total_discount: 0,
      total_vat: 0,
      shipping_cost: 0,
      order_total: 0,

      // B2B Fields
      po_reference: body.po_reference,
      cost_center: body.cost_center,
      notes: body.notes,

      // Tracking
      session_id,
      flow_id,
      source: "web",

      // Items (empty)
      items: [],
    });

    return NextResponse.json(
      {
        success: true,
        order,
        customer: {
          customer_id: customer.customer_id,
          external_code: customer.external_code,
          company_name: customer.company_name,
          email: customer.email,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
