import { NextRequest, NextResponse } from "next/server";
import type { AddItemRequest } from "@/lib/types/order";
import {
  getDraftOrder,
  validateQuantity,
  validateAddItemRequest,
  findMergeableItem,
  updateItemQuantity,
  createLineItem,
  batchUpdateItems,
  batchRemoveItems,
  parseLineNumbers,
  saveOrder,
} from "@/lib/services/order.service";
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
 */
async function authenticateRequest(req: NextRequest): Promise<{
  authenticated: boolean;
  tenantId?: string;
  tenantDb?: string;
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

  // Check for portal user token (additional access restriction)
  const portalUser = await getPortalUserFromRequest(req, tenantDb);

  return {
    authenticated: true,
    tenantId,
    tenantDb,
    customerAccess: portalUser?.customerAccess,
  };
}

/**
 * POST /api/b2b/orders/[id]/items
 * Add an item to the cart
 * Supports both session auth and API key auth
 *
 * If entity_code already exists (with matching promo/price), increment quantity.
 * Otherwise, create a new line item.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: order_id } = await params;

    // Authenticate and get tenant
    const auth = await authenticateRequest(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode });
    }

    // Get draft order with tenant filter for security
    const orderResult = await getDraftOrder(order_id, auth.tenantId, auth.tenantDb);
    if (!orderResult.success) {
      return NextResponse.json(
        { error: orderResult.error },
        { status: orderResult.status }
      );
    }
    const order = orderResult.data!;

    // Portal user access check
    if (auth.customerAccess && order.customer_id && !hasCustomerAccess(auth.customerAccess, order.customer_id)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body: AddItemRequest = await req.json();

    // Validate required fields
    const missingFields = validateAddItemRequest(body);
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate quantity
    const quantityError = validateQuantity({
      quantity: body.quantity,
      min_order_quantity: body.min_order_quantity,
      pack_size: body.pack_size,
    });
    if (quantityError) {
      return NextResponse.json({ error: quantityError }, { status: 400 });
    }

    // Smart merge: only merge if ALL key fields match
    const existing = findMergeableItem(order, body);
    let item;

    if (existing) {
      // Update existing item - add to quantity
      const newQuantity = existing.item.quantity + body.quantity;
      updateItemQuantity(existing.item, newQuantity);
      item = existing.item;
    } else {
      // Create new line item
      item = createLineItem(order, body);
      order.items.push(item);
    }

    // Save with recalculated totals
    await saveOrder(order);

    return NextResponse.json({
      success: true,
      order: order.toObject(),
      item,
    });
  } catch (error) {
    console.error("Error adding item to order:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/b2b/orders/[id]/items
 * Update items in the cart (batch operation)
 * Supports both session auth and API key auth
 *
 * Body: { items: [{ line_number: 10, quantity: 20 }, ...] }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: order_id } = await params;

    // Authenticate and get tenant
    const auth = await authenticateRequest(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode });
    }

    // Get draft order with tenant filter for security
    const orderResult = await getDraftOrder(order_id, auth.tenantId, auth.tenantDb);
    if (!orderResult.success) {
      return NextResponse.json(
        { error: orderResult.error },
        { status: orderResult.status }
      );
    }
    const order = orderResult.data!;

    // Portal user access check
    if (auth.customerAccess && order.customer_id && !hasCustomerAccess(auth.customerAccess, order.customer_id)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const itemsToUpdate = body.items;

    if (!itemsToUpdate || !Array.isArray(itemsToUpdate)) {
      return NextResponse.json(
        { error: "Missing required field: items (array)" },
        { status: 400 }
      );
    }

    // Batch update items
    const results = batchUpdateItems(order, itemsToUpdate);

    // Save with recalculated totals
    await saveOrder(order);

    return NextResponse.json({
      success: true,
      order: order.toObject(),
      results,
    });
  } catch (error) {
    console.error("Error updating items:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/b2b/orders/[id]/items
 * Remove items from the cart (batch operation)
 * Supports both session auth and API key auth
 *
 * Body: { items: [{ line_number: 10 }, ...] }
 *   or: { line_numbers: [10, 20, 30] }
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: order_id } = await params;

    // Authenticate and get tenant
    const auth = await authenticateRequest(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode });
    }

    // Get draft order with tenant filter for security
    const orderResult = await getDraftOrder(order_id, auth.tenantId, auth.tenantDb);
    if (!orderResult.success) {
      return NextResponse.json(
        { error: orderResult.error },
        { status: orderResult.status }
      );
    }
    const order = orderResult.data!;

    // Portal user access check
    if (auth.customerAccess && order.customer_id && !hasCustomerAccess(auth.customerAccess, order.customer_id)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();

    // Parse line numbers (supports both formats)
    const lineNumbers = parseLineNumbers(body);
    if (!lineNumbers) {
      return NextResponse.json(
        { error: "Missing required field: items or line_numbers (array)" },
        { status: 400 }
      );
    }

    // Batch remove items
    const results = batchRemoveItems(order, lineNumbers);

    // Save with recalculated totals
    await saveOrder(order);

    return NextResponse.json({
      success: true,
      order: order.toObject(),
      results,
      message: `Removed ${results.filter((r) => r.success).length} item(s)`,
    });
  } catch (error) {
    console.error("Error removing items:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
