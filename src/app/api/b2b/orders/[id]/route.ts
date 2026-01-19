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

    // Return order with paginated items and customer/address details
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
        totalItemsCount, // Total items in order (unfiltered)
        hasSearch: !!search,
      },
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

    // Only allow modifications on draft orders
    if (order.status !== "draft") {
      return NextResponse.json(
        { error: "Cannot modify non-draft orders" },
        { status: 400 }
      );
    }

    const body = await req.json();

    // Allowed fields to update
    const allowedFields = [
      "shipping_address_id",
      "billing_address_id",
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

    // Update the order (with tenant filter for security)
    const updatedOrder = await OrderModel.findOneAndUpdate(
      { order_id, tenant_id: tenantId },
      { $set: updateDoc },
      { new: true }
    ).lean();

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

    await OrderModel.deleteOne({ order_id, tenant_id: tenantId });

    return NextResponse.json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting order:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
