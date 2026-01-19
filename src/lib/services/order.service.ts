/**
 * Order Service
 *
 * Reusable functions for order/cart operations.
 * Used by API routes for consistent behavior.
 */

import { connectWithModels } from "@/lib/db/connection";
import {
  calculateLineItemTotals,
  getNextLineNumber,
  recalculateOrderTotals,
  ILineItem,
  IOrder,
} from "@/lib/db/models/order";
import type { AddItemRequest } from "@/lib/types/order";

// ============================================
// TYPES
// ============================================

export interface ServiceResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

export interface BatchItemResult {
  line_number: number;
  success: boolean;
  error?: string;
}

export interface QuantityValidation {
  quantity: number;
  min_order_quantity?: number;
  pack_size?: number;
}

// ============================================
// ORDER RETRIEVAL
// ============================================

export interface GetOrderOptions {
  requireDraft?: boolean;
  tenantId?: string;
  tenantDb?: string;
}

/**
 * Get an order by ID and optionally validate it's in draft status.
 * Handles database connection automatically.
 *
 * @param orderId - The order ID to find
 * @param options.requireDraft - If true, only return draft orders
 * @param options.tenantId - If provided, filter by tenant_id for security
 * @param options.tenantDb - REQUIRED: tenant database name (e.g., "vinc-hidros-it")
 */
export async function getOrder(
  orderId: string,
  options: GetOrderOptions = {}
): Promise<ServiceResult<IOrder>> {
  const { requireDraft = false, tenantId, tenantDb } = options;

  if (!tenantDb) {
    return {
      success: false,
      error: "Tenant database is required",
      status: 400,
    };
  }

  // Get Order model via connectWithModels
  const { Order } = await connectWithModels(tenantDb);

  // Build query with optional tenant filter
  const query: Record<string, unknown> = { order_id: orderId };
  if (tenantId) {
    query.tenant_id = tenantId;
  }

  const order = await Order.findOne(query);

  if (!order) {
    return {
      success: false,
      error: "Order not found",
      status: 404,
    };
  }

  if (requireDraft && order.status !== "draft") {
    return {
      success: false,
      error: "Cannot modify orders that are not in draft status",
      status: 400,
    };
  }

  return { success: true, data: order as IOrder };
}

/**
 * Get a draft order (cart) by ID.
 * Shorthand for getOrder with requireDraft=true.
 *
 * @param orderId - The order ID to find
 * @param tenantId - Optional tenant ID for security filtering
 * @param tenantDb - Optional tenant database to connect to
 */
export async function getDraftOrder(
  orderId: string,
  tenantId?: string,
  tenantDb?: string
): Promise<ServiceResult<IOrder>> {
  return getOrder(orderId, { requireDraft: true, tenantId, tenantDb });
}

// ============================================
// QUANTITY VALIDATION
// ============================================

/**
 * Validate quantity against constraints.
 * Returns error message if invalid, undefined if valid.
 */
export function validateQuantity(opts: QuantityValidation): string | undefined {
  const { quantity, min_order_quantity, pack_size } = opts;

  if (quantity <= 0) {
    return "Quantity must be greater than 0";
  }

  if (min_order_quantity && quantity < min_order_quantity) {
    return `Minimum order quantity is ${min_order_quantity}`;
  }

  if (pack_size && quantity % pack_size !== 0) {
    return `Quantity must be a multiple of ${pack_size}`;
  }

  return undefined;
}

/**
 * Validate quantity for update operations (cannot use DELETE message).
 */
export function validateQuantityForUpdate(
  opts: QuantityValidation
): string | undefined {
  const { quantity, min_order_quantity, pack_size } = opts;

  if (quantity <= 0) {
    return "Quantity must be greater than 0. Use DELETE to remove.";
  }

  if (min_order_quantity && quantity < min_order_quantity) {
    return `Minimum order quantity is ${min_order_quantity}`;
  }

  if (pack_size && quantity % pack_size !== 0) {
    return `Quantity must be a multiple of ${pack_size}`;
  }

  return undefined;
}

// ============================================
// LINE ITEM OPERATIONS
// ============================================

/**
 * Find an item in order by line_number.
 */
export function findItemByLineNumber(
  order: IOrder,
  lineNumber: number
): ILineItem | undefined {
  return order.items.find((i: ILineItem) => i.line_number === lineNumber);
}

/**
 * Find matching item for smart merge.
 * Only merges if ALL key fields match.
 */
export function findMergeableItem(
  order: IOrder,
  body: AddItemRequest
): { item: ILineItem; index: number } | undefined {
  const index = order.items.findIndex(
    (item: ILineItem) =>
      item.entity_code === body.entity_code &&
      item.promo_code === body.promo_code &&
      item.promo_row === body.promo_row &&
      item.pack_size === body.pack_size &&
      item.unit_price === body.unit_price
  );

  if (index >= 0) {
    return { item: order.items[index], index };
  }
  return undefined;
}

/**
 * Update item quantity and recalculate line totals.
 */
export function updateItemQuantity(
  item: ILineItem,
  newQuantity: number
): void {
  const totals = calculateLineItemTotals(
    newQuantity,
    item.list_price,
    item.unit_price,
    item.vat_rate
  );

  item.quantity = newQuantity;
  item.line_gross = totals.line_gross;
  item.line_net = totals.line_net;
  item.line_vat = totals.line_vat;
  item.line_total = totals.line_total;
  item.updated_at = new Date();
}

/**
 * Create a new line item from request body.
 */
export function createLineItem(
  order: IOrder,
  body: AddItemRequest
): ILineItem {
  const totals = calculateLineItemTotals(
    body.quantity,
    body.list_price,
    body.unit_price,
    body.vat_rate
  );

  // Calculate total discount percent from discounts array
  let total_discount_percent = 0;
  if (body.discounts && body.discounts.length > 0) {
    let remaining = 100;
    for (const d of body.discounts.sort((a, b) => a.tier - b.tier)) {
      if (d.type === "percentage") {
        remaining = remaining * (1 + d.value / 100);
      }
    }
    total_discount_percent = Math.round((100 - remaining) * 100) / 100;
  }

  const now = new Date();

  return {
    line_number: getNextLineNumber(order.items),
    entity_code: body.entity_code,
    sku: body.sku,
    product_source: body.product_source || "pim",
    external_ref: body.external_ref,

    // Quantity & Packaging
    quantity: body.quantity,
    quantity_unit: body.quantity_unit,
    min_order_quantity: body.min_order_quantity,
    pack_size: body.pack_size,
    packaging_code: body.packaging_code,
    packaging_label: body.packaging_label,

    // Pricing
    list_price: body.list_price,
    retail_price: body.retail_price,
    unit_price: body.unit_price,
    promo_price: body.promo_price,
    vat_rate: body.vat_rate,

    // Line Totals
    ...totals,

    // Discounts
    discounts: body.discounts || [],
    total_discount_percent,

    // Promotion
    promo_id: body.promo_id,
    is_gift_line: body.is_gift_line || false,
    gift_with_purchase: body.gift_with_purchase,

    // Product Snapshot
    name: body.name,
    image_url: body.image_url,
    brand: body.brand,
    category: body.category,

    // Tracking
    added_at: now,
    updated_at: now,
    added_from: body.added_from,
    added_via: body.added_via,

    // Promo tracking
    promo_code: body.promo_code,
    promo_row: body.promo_row,
    promo_label: body.promo_label,
    promo_discount_pct: body.promo_discount_pct,
    promo_discount_amt: body.promo_discount_amt,

    // Raw source payload
    raw_data: body as unknown as Record<string, unknown>,
  };
}

// ============================================
// BATCH OPERATIONS
// ============================================

interface UpdateItemInput {
  line_number: number;
  quantity: number;
}

/**
 * Batch update items in order.
 * Returns results for each item.
 */
export function batchUpdateItems(
  order: IOrder,
  updates: UpdateItemInput[]
): BatchItemResult[] {
  const results: BatchItemResult[] = [];

  for (const update of updates) {
    const { line_number, quantity } = update;

    if (line_number === undefined) {
      results.push({
        line_number: 0,
        success: false,
        error: "Missing line_number",
      });
      continue;
    }

    const item = findItemByLineNumber(order, line_number);

    if (!item) {
      results.push({
        line_number,
        success: false,
        error: "Item not found",
      });
      continue;
    }

    if (quantity !== undefined) {
      const validationError = validateQuantityForUpdate({
        quantity,
        min_order_quantity: item.min_order_quantity,
        pack_size: item.pack_size,
      });

      if (validationError) {
        results.push({
          line_number,
          success: false,
          error: validationError,
        });
        continue;
      }

      updateItemQuantity(item, quantity);
    }

    results.push({ line_number, success: true });
  }

  return results;
}

/**
 * Batch remove items from order.
 * Returns results for each item.
 */
export function batchRemoveItems(
  order: IOrder,
  lineNumbers: number[]
): BatchItemResult[] {
  const results: BatchItemResult[] = [];

  for (const line_number of lineNumbers) {
    const itemIndex = order.items.findIndex(
      (i: ILineItem) => i.line_number === line_number
    );

    if (itemIndex === -1) {
      results.push({
        line_number,
        success: false,
        error: "Item not found",
      });
      continue;
    }

    order.items.splice(itemIndex, 1);
    results.push({ line_number, success: true });
  }

  return results;
}

// ============================================
// ORDER OPERATIONS
// ============================================

/**
 * Save order after modifications.
 * Recalculates totals and persists to database.
 */
export async function saveOrder(order: IOrder): Promise<void> {
  recalculateOrderTotals(order);
  await order.save();
}

// ============================================
// VALIDATION HELPERS
// ============================================

const ADD_ITEM_REQUIRED_FIELDS = [
  "entity_code",
  "sku",
  "quantity",
  "list_price",
  "unit_price",
  "vat_rate",
  "name",
] as const;

/**
 * Validate AddItemRequest has all required fields.
 * Returns array of missing field names.
 */
export function validateAddItemRequest(
  body: Partial<AddItemRequest>
): string[] {
  return ADD_ITEM_REQUIRED_FIELDS.filter(
    (f) => body[f as keyof AddItemRequest] === undefined
  );
}

/**
 * Parse line_numbers from request body.
 * Supports both { items: [{ line_number }] } and { line_numbers: [] } formats.
 */
export function parseLineNumbers(
  body: { items?: Array<{ line_number: number }>; line_numbers?: number[] }
): number[] | undefined {
  if (body.line_numbers && Array.isArray(body.line_numbers)) {
    return body.line_numbers;
  }

  if (body.items && Array.isArray(body.items)) {
    return body.items.map((i) => i.line_number);
  }

  return undefined;
}
