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
import { safeRegexQuery } from "@/lib/security";
import {
  buildOrderStatsScopeKey,
  getCachedOrderStats,
  setCachedOrderStats,
} from "@/lib/services/order-stats-cache";
import {
  computeOrderStats,
  EMPTY_ORDER_STATS,
} from "@/lib/services/order-stats.service";
import type { ICustomerAccess } from "@/lib/types/portal-user";
import { nanoid } from "nanoid";
import type { CreateOrderRequest } from "@/lib/types/order";
import {
  findOrCreateCustomer,
  findOrCreateAddress,
} from "@/lib/services/customer.service";
import {
  buildHookCtx,
  runBeforeHook,
  updateCtxFromOrder,
  runOnMergeAfterAuto,
} from "@/lib/services/windmill-proxy.service";

/**
 * Authenticate request via session or API key
 * Also checks for portal user token and returns customer access restrictions
 * Returns tenant-specific models from connection pool
 */
async function authenticateRequest(
  req: NextRequest,
  scope: string,
): Promise<{
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
        { status: auth.statusCode || 401 },
      );
    }
    const tenantId = auth.tenantId!;
    const { Order: OrderModel, Customer: CustomerModel } = auth.models;

    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20") || 20),
    );
    const status = searchParams.get("status");
    const year = searchParams.get("year");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const customerId = searchParams.get("customer_id");
    const cartNumber = searchParams.get("cart_number");
    const publicCode = searchParams.get("public_code");
    const customerCode = searchParams.get("customer_code"); // ERP / external_code
    const isCurrent = searchParams.get("is_current"); // Active cart filter
    const channel = searchParams.get("channel"); // Sales channel filter
    const shippingAddressId = searchParams.get("shipping_address_id"); // Address filter (internal ID)
    const addressCode =
      searchParams.get("address_code") ||
      searchParams.get("shipping_address_code"); // Address filter (external_code)
    const search = searchParams.get("search")?.trim(); // Free-text search: order_id / po_reference / customer_id / cart_number / order_number
    const compare =
      searchParams.get("compare") === "1" ||
      searchParams.get("compare") === "true"; // Include previous-period comparison
    const daily =
      searchParams.get("daily") === "1" || searchParams.get("daily") === "true"; // Include daily revenue series
    // List-only mode: callers that only need the order list (e.g. a customer's
    // Order History) pass stats=0 to skip the heavy stats aggregations entirely.
    const includeStats = !(
      searchParams.get("stats") === "0" || searchParams.get("stats") === "false"
    );

    // Server-side sort (whitelisted). Default: most recent first.
    const SORT_MAP: Record<string, Record<string, 1 | -1>> = {
      recent: { created_at: -1 },
      oldest: { created_at: 1 },
      total_high: { order_total: -1 },
      total_low: { order_total: 1 },
    };
    const sortSpec =
      SORT_MAP[searchParams.get("sort") || "recent"] || SORT_MAP.recent;

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
      if (
        auth.customerAccess &&
        !hasCustomerAccess(auth.customerAccess, customerId)
      ) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      query.customer_id = customerId;
    }

    if (status) {
      const statuses = status
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      query.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
    }

    if (year) {
      query.year = parseInt(year);
    }

    if (cartNumber) {
      query.cart_number = parseInt(cartNumber);
    }

    if (customerCode) {
      // Resolve external_code → customer_id for reliable matching
      const cust = await CustomerModel.findOne(
        { tenant_id: tenantId, external_code: customerCode },
        { customer_id: 1, addresses: 1 },
      ).lean();
      if (!cust) {
        return NextResponse.json({
          success: true,
          orders: [],
          pagination: { page, limit, total: 0, pages: 0 },
          stats: { ...EMPTY_ORDER_STATS },
        });
      }
      query.customer_id = (cust as any).customer_id;

      // Resolve address_code → address_id on the same customer
      if (addressCode) {
        const addr = (cust as any).addresses?.find(
          (a: any) => a.external_code === addressCode,
        );
        if (addr) {
          query.shipping_address_id = addr.address_id;
        } else {
          // Address not found — no orders can match
          return NextResponse.json({
            success: true,
            orders: [],
            pagination: { page, limit, total: 0, pages: 0 },
            stats: { ...EMPTY_ORDER_STATS },
          });
        }
      }
    }

    if (isCurrent === "true") {
      query.is_current = true;
    } else if (isCurrent === "false") {
      query.is_current = { $ne: true }; // false or undefined/null
    }

    if (channel) {
      query.channel = channel;
    }

    if (shippingAddressId) {
      query.shipping_address_id = shippingAddressId;
    }

    // Public code filter - need to lookup customer_ids first (within tenant)
    if (publicCode) {
      const matchingCustomers = await CustomerModel.find({
        tenant_id: tenantId,
        public_code: safeRegexQuery(publicCode),
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
          stats: { ...EMPTY_ORDER_STATS },
        });
      }
    }

    // Date range filter — by cart submission date, falling back to creation date
    // for orders that were never submitted (e.g. imported/synced orders).
    if (dateFrom || dateTo) {
      const range: Record<string, Date> = {};
      if (dateFrom) {
        range.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        // Set to end of day
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        range.$lte = endDate;
      }
      // submitted_at: null matches both null and missing, so the fallback only
      // applies to orders that have no submission date at all.
      const dateOr = [
        { submitted_at: range },
        { submitted_at: null, created_at: range },
      ];
      query.$and = [...((query.$and as unknown[]) ?? []), { $or: dateOr }];
    }

    // Free-text search across multiple fields. Applied ONLY to the list
    // (find + count) below — deliberately NOT to the stats aggregations. The
    // stats describe the current filter *scope* (tenant + date + status + …),
    // so the typed search box no longer triggers the unanchored po_reference
    // regex to be scanned three separate times (find, count, AND the stats
    // facet) on every keystroke.
    let searchOr: Record<string, unknown>[] | null = null;
    if (search) {
      const orConditions: Record<string, unknown>[] = [
        { order_id: search },
        { po_reference: safeRegexQuery(search) },
        { customer_id: search },
      ];
      if (/^\d+$/.test(search)) {
        const n = parseInt(search, 10);
        orConditions.push({ cart_number: n });
        orConditions.push({ order_number: n });
      }
      searchOr = orConditions;
    }

    // Build base query without status for stats aggregation (include all statuses, deleted included).
    // Note: this is the search-free `query`, so the stats reflect the filter scope, not the search box.
    const baseQuery = { ...query };
    delete baseQuery.status;

    // The list itself (find + count) IS filtered by the free-text search.
    const listQuery = searchOr ? { ...query, $or: searchOr } : query;

    // The heavy stats (status breakdown, time periods, comparison, daily) describe
    // the filter SCOPE and barely change second-to-second, so they're cached for a
    // short TTL per (tenant, scope). The orders list + count below stay live.
    // Stats are computed (and cached) only when the caller wants them.
    const statsScopeKey = includeStats
      ? buildOrderStatsScopeKey(baseQuery, { compare, daily })
      : "";
    const cachedStats = includeStats
      ? await getCachedOrderStats(tenantId, statsScopeKey)
      : null;

    // A separate count is needed when stats are skipped (no byStatus sum to
    // derive the total from) or when the list is narrowed (status / free-text
    // search). Otherwise the scope total == the byStatus sum the facet computes.
    const needsSeparateCount = !includeStats || !!status || !!searchOr;
    // Compute the heavy aggregations only on list-with-stats requests that miss
    // the cache; list-only requests and cache hits skip them entirely.
    const computeStats = includeStats && !cachedStats;

    // Execute queries in parallel. The stats computation (its own aggregations)
    // runs ONLY on a cache miss, concurrently with the live list + count.
    const [orders, countResult, computedStats] = await Promise.all([
      OrderModel.find(listQuery)
        .sort(sortSpec)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      needsSeparateCount
        ? OrderModel.countDocuments(listQuery)
        : Promise.resolve<number | null>(null),
      computeStats
        ? computeOrderStats(OrderModel, baseQuery, {
            compare,
            daily,
            dateFrom,
            dateTo,
          })
        : Promise.resolve<Record<string, unknown> | null>(null),
    ]);

    // Stats: skipped entirely on list-only requests; otherwise reuse the cached
    // block on a hit, or use the freshly computed one (which only ran on a miss)
    // and store it for the next callers.
    let stats: Record<string, unknown>;
    if (!includeStats) {
      stats = {};
    } else if (cachedStats) {
      stats = cachedStats;
    } else {
      stats = computedStats!;
      await setCachedOrderStats(tenantId, statsScopeKey, stats);
    }

    // A separate count is only needed when the list is narrowed (status/search);
    // otherwise the scope total equals the byStatus sum the facet already computed.
    const total =
      countResult ?? (Number((stats as Record<string, number>).total) || 0);

    // Fetch customer details for all orders (within tenant)
    const customerIds = [
      ...new Set(orders.map((o) => o.customer_id).filter(Boolean)),
    ];
    const customers = await CustomerModel.find({
      tenant_id: tenantId,
      customer_id: { $in: customerIds },
    })
      .select(
        "customer_id company_name first_name last_name email external_code public_code addresses",
      )
      .lean();

    // Create a map for quick lookup (include addresses for label backfill)
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
          addresses: (c as any).addresses || [],
        },
      ]),
    );

    // Enrich orders with customer info + resolve shipping address
    const enrichedOrders = orders.map((order) => {
      const cust = customerMap.get(order.customer_id);
      // Resolve full shipping address from customer addresses
      let shippingAddress = null;
      if (order.shipping_address_id && cust) {
        const addr = cust.addresses.find(
          (a: any) => a.address_id === order.shipping_address_id,
        );
        if (addr) {
          shippingAddress = {
            address_id: addr.address_id,
            external_code: addr.external_code || null,
            customer_code: order.customer_code || cust?.external_code || null,
            label: addr.label || null,
            recipient_name: addr.recipient_name || null,
            street_address: addr.street_address || null,
            street_address_2: addr.street_address_2 || null,
            city: addr.city || null,
            province: addr.province || null,
            postal_code: addr.postal_code || null,
            country: addr.country || null,
            phone: addr.phone || null,
          };
        }
      }
      // Build human-readable display reference
      // Draft → CA/{seq}/{year}, non-draft → OR/{seq}/{year}
      const prefix = order.status === "draft" ? "CA" : "OR";
      const num =
        order.status !== "draft" && order.order_number
          ? order.order_number
          : order.cart_number;
      const display_ref = `${prefix}/${num}/${order.year}`;

      return {
        ...order,
        display_ref,
        shipping_address: shippingAddress,
        shipping_address_code:
          order.shipping_address_code || shippingAddress?.external_code || null,
        customer_code: order.customer_code || cust?.external_code || null,
        customer_name: cust?.customer_name || order.customer_id,
        customer_company: cust?.company_name,
        customer_email: cust?.email,
        customer_public_code: cust?.public_code,
      };
    });

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
      { status: 500 },
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
        { status: auth.statusCode || 401 },
      );
    }
    const tenant_id = auth.tenantId!;
    const { Order: OrderModel } = auth.models;

    const body: CreateOrderRequest = await req.json();

    // Determine if this is a B2C guest order (buyer provided, no customer lookup)
    const isB2CGuest =
      !!body.buyer &&
      !body.customer_id &&
      !body.customer_code &&
      !body.customer;

    // For non-guest orders, require a customer identifier
    if (
      !isB2CGuest &&
      !body.customer_id &&
      !body.customer_code &&
      !body.customer
    ) {
      return NextResponse.json(
        {
          error:
            "customer_id, customer_code, customer object, or buyer snapshot is required",
        },
        { status: 400 },
      );
    }

    // B2C guest: validate buyer has required fields
    if (isB2CGuest) {
      const b = body.buyer!;
      if (!b.email || !b.first_name || !b.last_name) {
        return NextResponse.json(
          {
            error:
              "buyer.email, buyer.first_name, and buyer.last_name are required",
          },
          { status: 400 },
        );
      }
    }

    // Resolve customer (only for non-guest orders)
    let customer: any = null;
    let shipping_address_id: string | undefined;

    if (!isB2CGuest) {
      // Find or create customer
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
          { status: 400 },
        );
      }

      // Portal user access check
      if (
        auth.customerAccess &&
        !hasCustomerAccess(auth.customerAccess, customer.customer_id)
      ) {
        return NextResponse.json(
          { error: "Access denied to this customer" },
          { status: 403 },
        );
      }

      // Find or create shipping address (if provided)
      shipping_address_id = body.shipping_address_id;
      if (!shipping_address_id && body.shipping_address) {
        try {
          const address = await findOrCreateAddress(
            customer,
            {
              address: body.shipping_address,
            },
            tenant_id,
          );
          shipping_address_id = address.address_id;
        } catch (error) {
          console.error("Error finding/creating address:", error);
          // Non-fatal - continue without address
        }
      } else if (!shipping_address_id && customer.default_shipping_address_id) {
        // Use customer's default address if no address specified
        shipping_address_id = customer.default_shipping_address_id;
      }
    }

    // Generate IDs
    const order_id = nanoid(12);
    const session_id = `sess_${nanoid(16)}`;
    const flow_id = `flow_${nanoid(16)}`;
    const year = new Date().getFullYear();
    const cart_number = await getNextCartNumber(auth.tenantDb!, year);

    // Determine defaults based on order type
    const orderType = body.order_type || (isB2CGuest ? "b2c" : "b2b");
    const channel = body.channel || (isB2CGuest ? "b2c" : "b2b");
    const priceListType =
      body.price_list_type || (orderType === "b2c" ? "retail" : "wholesale");

    // ── BEFORE HOOK: validate with ERP ──
    const hookCtx = buildHookCtx(auth.tenantDb!, tenant_id, "cart.create", {
      channel,
      customerCode: customer?.external_code,
      requestData: body as Record<string, unknown>,
    });
    const before = await runBeforeHook(hookCtx);
    if (before.hooked && !before.allowed) {
      return NextResponse.json(
        {
          error: before.message || "Operation rejected by ERP",
          windmill: { phase: "before", blocked: true },
        },
        { status: 422 },
      );
    }

    // Create order with defaults
    const order = await OrderModel.create({
      order_id,
      cart_number,
      year,
      status: "draft",

      // Tenant
      tenant_id,

      // Customer (null for guest, populated for registered)
      customer_id: customer?.customer_id || null,
      customer_code: customer?.external_code || null,
      shipping_address_id: shipping_address_id || null,
      billing_address_id:
        body.billing_address_id || customer?.default_billing_address_id || null,

      // B2C buyer snapshot (embedded on order for all B2C orders)
      buyer: body.buyer || null,
      invoice_requested: body.invoice_requested ?? false,
      invoice_data: body.invoice_data || null,
      shipping_snapshot: body.shipping_snapshot || null,
      billing_snapshot: body.billing_snapshot || null,

      // Delivery
      requested_delivery_date: body.requested_delivery_date
        ? new Date(body.requested_delivery_date)
        : undefined,
      delivery_slot: body.delivery_slot,
      delivery_route: body.delivery_route,
      shipping_method: body.shipping_method,
      requires_delivery: body.requires_delivery ?? true,

      // Payment method (selected at checkout)
      ...(body.payment_method
        ? {
            payment: {
              payment_status: "awaiting",
              payment_method: body.payment_method,
              amount_due: 0,
              amount_paid: 0,
              amount_remaining: 0,
              payments: [],
            },
          }
        : {}),

      // Pricing Context
      price_list_id: body.price_list_id || "default",
      price_list_type: priceListType,
      order_type: orderType,
      currency: body.currency || "EUR",
      price_decimals: body.price_decimals ?? 2,
      pricelist_type: body.pricelist_type,
      pricelist_code: body.pricelist_code,

      // Totals (all 0 initially, shipping_cost from request if provided)
      subtotal_gross: 0,
      subtotal_net: 0,
      total_discount: 0,
      total_vat: 0,
      shipping_cost: body.shipping_cost || 0,
      order_total: 0,

      // B2B Fields
      po_reference: body.po_reference,
      cost_center: body.cost_center,
      notes: body.notes,

      // Tracking
      session_id,
      flow_id,
      source: "web",
      channel,
      channel_ref: body.channel_ref || undefined,

      // Items (empty)
      items: [],
    });

    // ── ON + AFTER HOOKS ──
    updateCtxFromOrder(hookCtx, order);
    const on = await runOnMergeAfterAuto(hookCtx, OrderModel, order._id, {
      orderId: order.order_id,
    });

    return NextResponse.json(
      {
        success: true,
        order,
        customer: customer
          ? {
              customer_id: customer.customer_id,
              external_code: customer.external_code,
              company_name: customer.company_name,
              email: customer.email,
            }
          : null,
        windmill: {
          channel,
          before: before.hooked ? { allowed: before.allowed } : undefined,
          on: on.hooked
            ? {
                synced: on.success,
                timed_out: on.timedOut,
                message: on.response?.message,
              }
            : undefined,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
