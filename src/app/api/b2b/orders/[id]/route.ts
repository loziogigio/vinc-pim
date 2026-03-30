import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { ILineItem, IOrder } from "@/lib/db/models/order";
import { ICustomer, IAddress } from "@/lib/db/models/customer";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import {
  getPortalUserFromRequest,
  hasCustomerAccess,
} from "@/lib/auth/portal-user-token";
import type { ICustomerAccess } from "@/lib/types/portal-user";
import { buildHookCtxFromOrder, runOnHook, runOnMergeAfter, mergeOrderErpData } from "@/lib/services/windmill-proxy.service";

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
    const apiKeyResult = await verifyAPIKeyFromRequest(req, "orders");
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
 * GET /api/b2b/orders/[id]
 * Get a specific order by order_id
 * Supports both session auth and API key auth
 *
 * Query params for items pagination:
 *   - page: Page number (default: 1)
 *   - limit: Items per page (default: 20)
 *   - search: Search filter for SKU, entity_code, or name
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: order_id } = await params;
    const { searchParams } = new URL(req.url);

    // Authenticate and get tenant
    const auth = await authenticateRequest(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode });
    }
    const tenantId = auth.tenantId!;
    const { Order: OrderModel, Customer: CustomerModel } = auth.models;

    // Pagination params
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const search = searchParams.get("search")?.toLowerCase() || "";

    // Fetch order (with tenant filter for security)
    const order = await OrderModel.findOne({ order_id, tenant_id: tenantId }).lean<IOrder>();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Portal user access check
    if (auth.customerAccess && order.customer_id && !hasCustomerAccess(auth.customerAccess, order.customer_id)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get all items for filtering
    const allItems = order.items || [];
    const totalItemsCount = allItems.length;

    // Filter items by search query
    let filteredItems: ILineItem[] = allItems;
    if (search) {
      filteredItems = allItems.filter((item: ILineItem) => {
        return (
          item.entity_code?.toLowerCase().includes(search) ||
          item.sku?.toLowerCase().includes(search) ||
          item.name?.toLowerCase().includes(search)
        );
      });
    }

    const filteredCount = filteredItems.length;

    // Paginate items
    const skip = (page - 1) * limit;
    const paginatedItems = filteredItems.slice(skip, skip + limit);

    // Fetch customer details if customer_id exists
    let customer: Partial<ICustomer> | null = null;
    let shippingAddress: IAddress | null = null;

    if (order.customer_id) {
      const customerDoc = await CustomerModel.findOne({
        customer_id: order.customer_id,
        tenant_id: tenantId,
      }).lean<ICustomer>();

      if (customerDoc) {
        // Extract relevant customer info (without sensitive data)
        customer = {
          customer_id: customerDoc.customer_id,
          external_code: customerDoc.external_code,
          public_code: customerDoc.public_code,
          customer_type: customerDoc.customer_type,
          email: customerDoc.email,
          phone: customerDoc.phone,
          first_name: customerDoc.first_name,
          last_name: customerDoc.last_name,
          company_name: customerDoc.company_name,
          legal_info: customerDoc.legal_info,
          tags: customerDoc.tags,
        };

        // Find shipping address
        if (order.shipping_address_id && customerDoc.addresses) {
          shippingAddress =
            customerDoc.addresses.find(
              (addr) => addr.address_id === order.shipping_address_id
            ) || null;
        }
      }
    }

    // ── ON HOOK: enrich with ERP data (prices, stock) ──
    const hookCtx = buildHookCtxFromOrder(auth.tenantDb!, tenantId, "cart.get", order);
    const on = await runOnHook(hookCtx);
    if (on.hooked && on.success && on.response?.data) {
      await mergeOrderErpData(OrderModel, (order as any)._id, on.response);
    }

    // Return order with paginated items and customer/address details
    // promo_progress is stored on the order itself (recalculated on every save)
    return NextResponse.json({
      success: true,
      order: {
        ...order,
        items: paginatedItems,
      },
      customer,
      shippingAddress,
      pagination: {
        page,
        limit,
        total: filteredCount,
        totalPages: Math.ceil(filteredCount / limit),
        totalItemsCount,
        hasSearch: !!search,
      },
      ...(on.hooked ? { windmill: { channel, on: { synced: on.success, timed_out: on.timedOut } } } : {}),
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/b2b/orders/[id]
 * Update order fields (for draft orders only)
 * Supports both session auth and API key auth
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: order_id } = await params;

    // Authenticate and get tenant
    const auth = await authenticateRequest(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode });
    }
    const tenantId = auth.tenantId!;
    const { Order: OrderModel } = auth.models;

    // Find the order (with tenant filter for security)
    const order = await OrderModel.findOne({ order_id, tenant_id: tenantId });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Portal user access check
    if (auth.customerAccess && order.customer_id && !hasCustomerAccess(auth.customerAccess, order.customer_id)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();

    // Fields that bypass the draft-only restriction
    const anyStatusFields = ["erp_cart_id", "erp_order_id", "erp_sync_status", "erp_data", "erp_items", "processing_status", "processing_phase", "processing_job_id"];
    const bodyKeys = Object.keys(body);
    const isErpOnly = bodyKeys.every(k => anyStatusFields.includes(k));

    // payment_method can be updated on draft OR pending orders (payment retry)
    const isPaymentMethodOnly = bodyKeys.length === 1 && body.payment_method !== undefined;
    const allowedStatuses = isPaymentMethodOnly ? ["draft", "pending"] : ["draft"];

    if (!isErpOnly && !allowedStatuses.includes(order.status)) {
      return NextResponse.json(
        { error: isPaymentMethodOnly
            ? "Cannot modify payment method on orders in this state"
            : "Cannot modify non-draft orders" },
        { status: 400 }
      );
    }

    // Allowed fields to update (draft only)
    const allowedFields = [
      "requested_delivery_date",
      "delivery_slot",
      "delivery_route",
      "shipping_method",
      "po_reference",
      "cost_center",
      "notes",
    ];

    // Build update object
    const updateDoc: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === "requested_delivery_date" && body[field]) {
          updateDoc[field] = new Date(body[field]);
        } else {
          updateDoc[field] = body[field];
        }
      }
    }

    // payment_method lives under the payment subdocument
    if (body.payment_method !== undefined) {
      updateDoc["payment.payment_method"] = body.payment_method;
    }

    // is_current flag — only on draft orders, max one per customer+address
    if (body.is_current !== undefined) {
      if (order.status !== "draft") {
        return NextResponse.json(
          { error: "is_current can only be set on draft orders" },
          { status: 400 },
        );
      }
      const wantCurrent = !!body.is_current;
      if (wantCurrent && order.customer_code && order.shipping_address_code) {
        // Unset is_current on any other draft for same customer+address
        await OrderModel.updateMany(
          {
            tenant_id: tenantId,
            customer_code: order.customer_code,
            shipping_address_code: order.shipping_address_code,
            status: "draft",
            is_current: true,
            order_id: { $ne: order_id },
          },
          { $set: { is_current: false } },
        );
      }
      updateDoc.is_current = wantCurrent;
    }

    // ERP fields — writable on any status (set by external systems)
    const erpFields = ["erp_cart_id", "erp_order_id", "erp_sync_status", "processing_status", "processing_phase", "processing_job_id"];
    const unsetDoc: Record<string, unknown> = {};
    for (const field of erpFields) {
      if (body[field] !== undefined) {
        if (body[field] === null) {
          unsetDoc[field] = "";
        } else {
          updateDoc[field] = body[field];
        }
      }
    }
    // erp_data: null clears entirely, object merges keys
    if (body.erp_data === null) {
      unsetDoc.erp_data = "";
    } else if (body.erp_data && typeof body.erp_data === "object") {
      for (const [key, value] of Object.entries(body.erp_data)) {
        updateDoc[`erp_data.${key}`] = value;
      }
    }

    // Update the order (with tenant filter for security)
    const updateOp: Record<string, unknown> = {};
    if (Object.keys(updateDoc).length) updateOp.$set = updateDoc;
    if (Object.keys(unsetDoc).length) updateOp.$unset = unsetDoc;

    if (Object.keys(updateOp).length) {
      await OrderModel.updateOne({ order_id, tenant_id: tenantId }, updateOp);
    }

    // Per-item ERP data: [{ line_number, erp_line_number?, erp_data? }]
    if (Array.isArray(body.erp_items)) {
      for (const item of body.erp_items) {
        if (!item.line_number) continue;
        const itemSet: Record<string, unknown> = {};
        if (item.erp_line_number != null) itemSet["items.$.erp_line_number"] = item.erp_line_number;
        if (item.erp_data) itemSet["items.$.erp_data"] = item.erp_data;
        if (Object.keys(itemSet).length) {
          await OrderModel.updateOne(
            { order_id, tenant_id: tenantId, "items.line_number": item.line_number },
            { $set: itemSet },
          );
        }
      }
    }

    const updatedOrder = await OrderModel.findOne({ order_id, tenant_id: tenantId }).lean();

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: "Order updated successfully",
    });
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/b2b/orders/[id]
 * Delete a draft order
 * Supports both session auth and API key auth
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: order_id } = await params;

    // Authenticate and get tenant
    const auth = await authenticateRequest(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode });
    }
    const tenantId = auth.tenantId!;
    const { Order: OrderModel } = auth.models;

    // Find the order first (with tenant filter for security)
    const order = await OrderModel.findOne({ order_id, tenant_id: tenantId });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Portal user access check
    if (auth.customerAccess && order.customer_id && !hasCustomerAccess(auth.customerAccess, order.customer_id)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Only allow deletion of draft orders
    if (order.status !== "draft") {
      return NextResponse.json(
        { error: "Cannot delete non-draft orders" },
        { status: 400 }
      );
    }

    // ── HOOKS: sync deletion to ERP + fire-and-forget ──
    const delCtx = buildHookCtxFromOrder(auth.tenantDb!, tenantId, "cart.delete", order);
    await runOnMergeAfter(delCtx, OrderModel, (order as any)._id);

    await OrderModel.updateOne(
      { order_id, tenant_id: tenantId },
      { $set: { status: "deleted", deleted_at: new Date(), is_current: false } }
    );

    return NextResponse.json({
      success: true,
      message: "Order deleted successfully",
      ...(delOn.hooked ? { windmill: { channel: delChannel, on: { synced: delOn.success, timed_out: delOn.timedOut } } } : {}),
    });
  } catch (error) {
    console.error("Error deleting order:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
