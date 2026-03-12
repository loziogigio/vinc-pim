/**
 * Coupon Service
 *
 * Business logic for coupon validation, application, removal, and CRUD.
 * Integrates with the existing order discount infrastructure (ICartDiscount).
 */

import { nanoid } from "nanoid";
import { connectWithModels } from "@/lib/db/connection";
import {
  recalculateOrderTotals,
  type IOrder,
  type ICartDiscount,
} from "@/lib/db/models/order";
import { canModifyOrder, type OrderStatus } from "@/lib/constants/order";
import type { ICoupon } from "@/lib/db/models/coupon";
import type {
  CouponValidationResult,
  ApplyCouponResult,
  CreateCouponRequest,
  UpdateCouponRequest,
  CouponStatus,
} from "@/lib/types/coupon";
import type { ServiceResult } from "./order.service";

// ============================================
// VALIDATION
// ============================================

/**
 * Validate a coupon code against an order.
 * Checks: existence, status, date validity, usage limits,
 * customer eligibility, order amount thresholds.
 * Pure validation — no mutations.
 */
export async function validateCoupon(
  tenantDb: string,
  code: string,
  orderId: string,
  customerId?: string,
  customerEmail?: string
): Promise<CouponValidationResult> {
  const { Coupon, Order } = await connectWithModels(tenantDb);

  // Find coupon by code
  const coupon = (await Coupon.findOne({
    code: code.trim().toUpperCase(),
  }).lean()) as ICoupon | null;

  if (!coupon) {
    return { valid: false, error: "Codice coupon non trovato" };
  }

  // Check status
  if (coupon.status !== "active") {
    return { valid: false, error: "Coupon non attivo" };
  }

  // Check date validity
  const now = new Date();
  if (coupon.start_date && now < new Date(coupon.start_date)) {
    return { valid: false, error: "Coupon non ancora valido" };
  }
  if (coupon.end_date && now > new Date(coupon.end_date)) {
    return { valid: false, error: "Coupon scaduto" };
  }

  // Check total usage
  if (coupon.max_uses && coupon.usage_count >= coupon.max_uses) {
    return { valid: false, error: "Coupon esaurito" };
  }

  // Check per-customer usage
  if (coupon.max_uses_per_customer && customerId) {
    const customerUsageCount = coupon.usage_history.filter(
      (u) => u.customer_id === customerId
    ).length;
    if (customerUsageCount >= coupon.max_uses_per_customer) {
      return {
        valid: false,
        error: "Limite di utilizzo raggiunto per questo cliente",
      };
    }
  }

  // Check customer restriction (by email — supports guests)
  if (coupon.customer_emails && coupon.customer_emails.length > 0) {
    const emailLower = customerEmail?.toLowerCase();
    if (
      !emailLower ||
      !coupon.customer_emails.some((e) => e.toLowerCase() === emailLower)
    ) {
      return {
        valid: false,
        error: "Coupon non valido per questo cliente",
      };
    }
  }

  // Find order
  const order = (await Order.findOne({ order_id: orderId }).lean()) as IOrder | null;
  if (!order) {
    return { valid: false, error: "Ordine non trovato" };
  }

  if (!canModifyOrder(order.status as OrderStatus)) {
    return { valid: false, error: "Ordine non modificabile" };
  }

  // Check if a coupon is already applied
  if (order.coupon_id) {
    return { valid: false, error: "Un coupon è già applicato a questo ordine" };
  }

  // Check order amount thresholds
  const orderSubtotal = order.subtotal_net;
  if (
    coupon.min_order_amount !== undefined &&
    coupon.min_order_amount !== null &&
    orderSubtotal < coupon.min_order_amount
  ) {
    return {
      valid: false,
      error: `Importo minimo ordine: €${coupon.min_order_amount.toFixed(2)}`,
    };
  }
  if (
    coupon.max_order_amount !== undefined &&
    coupon.max_order_amount !== null &&
    orderSubtotal > coupon.max_order_amount
  ) {
    return {
      valid: false,
      error: `Importo massimo ordine: €${coupon.max_order_amount.toFixed(2)}`,
    };
  }

  // Calculate estimated discount
  const estimatedDiscount = calculateDiscount(
    coupon,
    orderSubtotal,
    order.shipping_cost
  );

  return {
    valid: true,
    coupon: {
      coupon_id: coupon.coupon_id,
      code: coupon.code,
      label: coupon.label,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      scope_type: "order",
      estimated_discount: estimatedDiscount,
    },
  };
}

// ============================================
// APPLICATION
// ============================================

/**
 * Apply a validated coupon to an order.
 * Adds an ICartDiscount with reason "coupon".
 * If non-cumulative, removes existing promo/coupon discounts first.
 */
export async function applyCoupon(
  tenantDb: string,
  code: string,
  orderId: string,
  customerId?: string,
  appliedBy?: string
): Promise<ApplyCouponResult> {
  // Resolve customer email for email-based restriction
  const { Order: PreOrder, Customer } = await connectWithModels(tenantDb);
  const preOrder = (await PreOrder.findOne({ order_id: orderId }).lean()) as IOrder | null;
  let customerEmail: string | undefined;
  if (preOrder?.buyer?.email) {
    customerEmail = preOrder.buyer.email;
  } else if (preOrder?.customer_id) {
    const cust = await Customer.findOne({ customer_id: preOrder.customer_id }).lean();
    customerEmail = (cust as any)?.email;
  }

  // Validate first
  const validation = await validateCoupon(tenantDb, code, orderId, customerId, customerEmail);
  if (!validation.valid || !validation.coupon) {
    return {
      success: false,
      error: validation.error,
      discount_applied: 0,
    };
  }

  const { Coupon, Order } = await connectWithModels(tenantDb);

  const order = await Order.findOne({ order_id: orderId });
  if (!order) {
    return { success: false, error: "Ordine non trovato", discount_applied: 0 };
  }

  const coupon = (await Coupon.findOne({
    coupon_id: validation.coupon.coupon_id,
  })) as ICoupon | null;
  if (!coupon) {
    return { success: false, error: "Coupon non trovato", discount_applied: 0 };
  }

  // Non-cumulative: remove existing promo/coupon cart discounts
  if (!coupon.is_cumulative && order.cart_discounts) {
    order.cart_discounts = order.cart_discounts.filter(
      (d: ICartDiscount) =>
        d.reason !== "promo" && d.reason !== "coupon"
    );
  }

  // Calculate the actual discount
  const discountAmount = calculateDiscount(
    coupon,
    order.subtotal_net,
    order.shipping_cost
  );

  // Add cart discount — always as "fixed" with pre-calculated amount
  // This handles both percentage and fixed coupons, and include_shipping logic
  const cartDiscount: ICartDiscount = {
    discount_id: `cpn_${nanoid(8)}`,
    type: "fixed",
    value: discountAmount, // positive value, recalculateOrderTotals uses Math.abs
    reason: "coupon",
    description: coupon.label || `Coupon ${coupon.code}`,
    applied_by: appliedBy,
    applied_at: new Date(),
  };

  order.cart_discounts = order.cart_discounts || [];
  order.cart_discounts.push(cartDiscount);

  // Set coupon reference
  order.coupon_code = coupon.code;
  order.coupon_id = coupon.coupon_id;

  // Recalculate totals
  recalculateOrderTotals(order as IOrder);

  await order.save();

  // Usage tracking (usage_count + usage_history) is deferred until the order
  // transitions out of draft/quotation — see confirmCouponUsage()

  return {
    success: true,
    order: order.toObject() as IOrder,
    discount_applied: discountAmount,
  };
}

/**
 * Remove a coupon from an order.
 */
export async function removeCoupon(
  tenantDb: string,
  orderId: string
): Promise<ServiceResult<IOrder>> {
  const { Coupon, Order } = await connectWithModels(tenantDb);

  const order = await Order.findOne({ order_id: orderId });
  if (!order) {
    return { success: false, error: "Ordine non trovato", status: 404 };
  }

  if (!canModifyOrder(order.status as OrderStatus)) {
    return { success: false, error: "Ordine non modificabile", status: 400 };
  }

  if (!order.coupon_id) {
    return { success: false, error: "Nessun coupon applicato", status: 400 };
  }

  const couponId = order.coupon_id;

  // Remove coupon cart discounts
  if (order.cart_discounts) {
    order.cart_discounts = order.cart_discounts.filter(
      (d: ICartDiscount) => d.reason !== "coupon"
    );
  }

  // Clear coupon reference
  order.coupon_code = undefined;
  order.coupon_id = undefined;

  // Recalculate totals
  recalculateOrderTotals(order as IOrder);

  await order.save();

  // Remove from usage_history
  const wasCounted = !canModifyOrder(order.status as OrderStatus);
  await Coupon.findOneAndUpdate(
    { coupon_id: couponId },
    {
      // Only decrement usage_count if the order was already counted (past draft/quotation)
      ...(wasCounted ? { $inc: { usage_count: -1 } } : {}),
      $pull: { usage_history: { order_id: orderId } },
    }
  );

  // If coupon was depleted and we decremented, reactivate
  if (wasCounted) {
    const coupon = (await Coupon.findOne({
      coupon_id: couponId,
    }).lean()) as ICoupon | null;
    if (
      coupon &&
      coupon.status === "depleted" &&
      coupon.max_uses &&
      coupon.usage_count < coupon.max_uses
    ) {
      await Coupon.findOneAndUpdate(
        { coupon_id: couponId },
        { $set: { status: "active" } }
      );
    }
  }

  return { success: true, data: order.toObject() as IOrder };
}

// ============================================
// COUPON USAGE CONFIRMATION
// ============================================

/**
 * Confirm coupon usage when an order transitions from draft/quotation to a
 * transaction status (pending, confirmed, etc.). This is the point where
 * the coupon usage actually counts toward limits.
 */
export async function confirmCouponUsage(
  tenantDb: string,
  couponId: string,
  orderId: string,
  customerId?: string,
  discountAmount?: number
): Promise<void> {
  const { Coupon } = await connectWithModels(tenantDb);

  const coupon = await Coupon.findOneAndUpdate(
    { coupon_id: couponId },
    {
      $inc: { usage_count: 1 },
      $push: {
        usage_history: {
          order_id: orderId,
          customer_id: customerId,
          used_at: new Date(),
          discount_amount: discountAmount || 0,
        },
      },
    },
    { new: true }
  ).lean() as ICoupon | null;

  // Check if depleted after increment
  if (
    coupon &&
    coupon.max_uses &&
    coupon.usage_count >= coupon.max_uses
  ) {
    await Coupon.findOneAndUpdate(
      { coupon_id: couponId },
      { $set: { status: "depleted" } }
    );
  }
}

// ============================================
// DISCOUNT CALCULATION (internal)
// ============================================

/**
 * Calculate the actual discount amount for a coupon on an order.
 * Handles percentage vs fixed, include_shipping, and max_discount_amount cap.
 */
function calculateDiscount(
  coupon: ICoupon,
  subtotalNet: number,
  shippingCost: number
): number {
  let base = subtotalNet;
  if (coupon.include_shipping) {
    base += shippingCost;
  }

  let discount: number;
  if (coupon.discount_type === "percentage") {
    discount = base * (coupon.discount_value / 100);
  } else {
    discount = coupon.discount_value;
  }

  // Cap at max_discount_amount
  if (coupon.max_discount_amount && discount > coupon.max_discount_amount) {
    discount = coupon.max_discount_amount;
  }

  // Cannot exceed the base
  discount = Math.min(discount, base);

  return Math.round(discount * 100) / 100;
}

// ============================================
// CRUD
// ============================================

export async function createCoupon(
  tenantDb: string,
  data: CreateCouponRequest,
  createdBy?: string
): Promise<ServiceResult<ICoupon>> {
  const { Coupon } = await connectWithModels(tenantDb);

  const code = data.code.trim().toUpperCase();

  // Check for duplicate code
  const existing = await Coupon.findOne({ code }).lean();
  if (existing) {
    return { success: false, error: "Codice coupon già esistente", status: 409 };
  }

  // Validate discount
  if (data.discount_value <= 0) {
    return { success: false, error: "Il valore sconto deve essere positivo", status: 400 };
  }
  if (data.discount_type === "percentage" && data.discount_value > 100) {
    return { success: false, error: "La percentuale non può superare il 100%", status: 400 };
  }

  // Validate channel
  if (!data.channel || typeof data.channel !== "string" || !data.channel.trim()) {
    return { success: false, error: "Il canale è obbligatorio", status: 400 };
  }

  const coupon = await Coupon.create({
    coupon_id: `cpn_${nanoid(10)}`,
    code,
    channel: data.channel.trim().toLowerCase(),
    description: data.description,
    label: data.label,
    status: "active",
    start_date: data.start_date ? new Date(data.start_date) : undefined,
    end_date: data.end_date ? new Date(data.end_date) : undefined,
    max_uses: data.max_uses,
    max_uses_per_customer: data.max_uses_per_customer,
    customer_emails: data.customer_emails || [],
    discount_type: data.discount_type,
    discount_value: data.discount_value,
    scope_type: data.scope_type || "order",
    scope_values: data.scope_values || [],
    include_shipping: data.include_shipping ?? false,
    is_cumulative: data.is_cumulative ?? true,
    min_order_amount: data.min_order_amount,
    max_order_amount: data.max_order_amount,
    max_discount_amount: data.max_discount_amount,
    notes: data.notes,
    created_by: createdBy,
  });

  return { success: true, data: coupon.toObject() as ICoupon };
}

export async function updateCoupon(
  tenantDb: string,
  couponId: string,
  data: UpdateCouponRequest
): Promise<ServiceResult<ICoupon>> {
  const { Coupon } = await connectWithModels(tenantDb);

  const coupon = await Coupon.findOne({ coupon_id: couponId });
  if (!coupon) {
    return { success: false, error: "Coupon non trovato", status: 404 };
  }

  // If code is changing, check uniqueness
  if (data.code !== undefined) {
    const newCode = data.code.trim().toUpperCase();
    if (newCode !== coupon.code) {
      const existing = await Coupon.findOne({ code: newCode }).lean();
      if (existing) {
        return { success: false, error: "Codice coupon già esistente", status: 409 };
      }
      coupon.code = newCode;
    }
  }

  // Validate discount value
  if (data.discount_value !== undefined) {
    if (data.discount_value <= 0) {
      return { success: false, error: "Il valore sconto deve essere positivo", status: 400 };
    }
    const discountType = data.discount_type || coupon.discount_type;
    if (discountType === "percentage" && data.discount_value > 100) {
      return { success: false, error: "La percentuale non può superare il 100%", status: 400 };
    }
  }

  // Apply updates
  const fields: (keyof UpdateCouponRequest)[] = [
    "channel",
    "description",
    "label",
    "status",
    "discount_type",
    "discount_value",
    "scope_type",
    "scope_values",
    "include_shipping",
    "is_cumulative",
    "min_order_amount",
    "max_order_amount",
    "max_discount_amount",
    "max_uses",
    "max_uses_per_customer",
    "customer_emails",
    "notes",
  ];

  for (const field of fields) {
    if (data[field] !== undefined) {
      (coupon as Record<string, unknown>)[field] = data[field];
    }
  }

  // Handle date fields
  if (data.start_date !== undefined) {
    coupon.start_date = data.start_date ? new Date(data.start_date) : undefined;
  }
  if (data.end_date !== undefined) {
    coupon.end_date = data.end_date ? new Date(data.end_date) : undefined;
  }

  await coupon.save();
  return { success: true, data: coupon.toObject() as ICoupon };
}

export async function getCoupon(
  tenantDb: string,
  couponId: string
): Promise<ServiceResult<ICoupon>> {
  const { Coupon } = await connectWithModels(tenantDb);

  const coupon = (await Coupon.findOne({
    coupon_id: couponId,
  }).lean()) as ICoupon | null;
  if (!coupon) {
    return { success: false, error: "Coupon non trovato", status: 404 };
  }

  return { success: true, data: coupon };
}

export async function listCoupons(
  tenantDb: string,
  filters: {
    status?: CouponStatus;
    page?: number;
    limit?: number;
    search?: string;
  }
): Promise<
  ServiceResult<{
    items: ICoupon[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>
> {
  const { Coupon } = await connectWithModels(tenantDb);

  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 20, 100);
  const skip = (page - 1) * limit;

  // Build query
  const query: Record<string, unknown> = {};
  if (filters.status) {
    query.status = filters.status;
  }
  if (filters.search) {
    const searchRegex = new RegExp(filters.search, "i");
    query.$or = [
      { code: searchRegex },
      { description: searchRegex },
      { label: searchRegex },
    ];
  }

  const [items, total] = await Promise.all([
    Coupon.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean() as Promise<ICoupon[]>,
    Coupon.countDocuments(query),
  ]);

  return {
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  };
}

export async function deleteCoupon(
  tenantDb: string,
  couponId: string
): Promise<ServiceResult> {
  const { Coupon, Order } = await connectWithModels(tenantDb);

  const coupon = (await Coupon.findOne({
    coupon_id: couponId,
  }).lean()) as ICoupon | null;
  if (!coupon) {
    return { success: false, error: "Coupon non trovato", status: 404 };
  }

  // Check if any active orders use this coupon
  const activeOrder = await Order.findOne({
    coupon_id: couponId,
    status: { $in: ["draft", "quotation", "pending"] },
  }).lean();
  if (activeOrder) {
    return {
      success: false,
      error: "Coupon in uso su ordini attivi",
      status: 400,
    };
  }

  await Coupon.deleteOne({ coupon_id: couponId });
  return { success: true };
}
