/**
 * Order Lifecycle Service
 *
 * Handles order status transitions, quotation management, discounts/adjustments,
 * payment recording, and order duplication.
 *
 * State Machine:
 *   draft → quotation → confirmed → shipped → delivered
 *                    ↘ pending → confirmed
 *   Any state → cancelled (with role restrictions)
 */

import mongoose from "mongoose";
import { nanoid } from "nanoid";
import type {
  IOrder,
  ICartDiscount,
  ILineAdjustment,
  IQuotationRevision,
  IPaymentRecord,
} from "@/lib/db/models/order";
import {
  recalculateOrderTotals,
  isQuotationExpired,
} from "@/lib/db/models/order";
import {
  canTransition,
  canModifyOrder,
  isTerminalStatus,
} from "@/lib/constants/order";
import type {
  OrderStatus,
  QuotationStatus,
  PaymentStatus,
  UserRole,
  AdjustmentReason,
} from "@/lib/constants/order";
import { getModelRegistry } from "@/lib/db/model-registry";

// ============================================
// TYPES
// ============================================

interface TransitionResult {
  success: boolean;
  order?: IOrder;
  error?: string;
}

interface QuotationOptions {
  daysValid?: number; // Default: 30
  notes?: string;
}

interface RevisionChanges {
  cartDiscountsAdded?: ICartDiscount[];
  lineAdjustmentsAdded?: ILineAdjustment[];
  itemsAdded?: number[];
  itemsRemoved?: number[];
  itemsQtyChanged?: Array<{ line_number: number; old_qty: number; new_qty: number }>;
  notes?: string;
  internalNotes?: string;
}

interface PaymentInput {
  amount: number;
  method: string;
  reference?: string;
  notes?: string;
  confirmed?: boolean;
  recorded_at?: Date;
}

interface DeliveryInput {
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: Date;
  deliveryNotes?: string;
}

interface DuplicateOptions {
  includeDiscounts?: boolean;
  resetQuantities?: boolean;
  clearNotes?: boolean;
}

// ============================================
// STATUS TRANSITIONS
// ============================================

/**
 * Generic status transition with role validation
 */
export async function transitionStatus(
  tenantDb: mongoose.Connection,
  orderId: string,
  toStatus: OrderStatus,
  userId: string,
  userRole: UserRole
): Promise<TransitionResult> {
  const registry = getModelRegistry(tenantDb);
  const Order = registry.Order;

  const order = await Order.findOne({ order_id: orderId });
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  const fromStatus = order.status as OrderStatus;

  // Check if transition is allowed
  if (!canTransition(fromStatus, toStatus, userRole)) {
    return {
      success: false,
      error: `Transition from ${fromStatus} to ${toStatus} not allowed for role ${userRole}`,
    };
  }

  // Set status and timestamp
  order.status = toStatus;
  order.updated_at = new Date();

  // Set lifecycle timestamp
  switch (toStatus) {
    case "pending":
      order.submitted_at = new Date();
      break;
    case "confirmed":
      order.confirmed_at = new Date();
      break;
    case "shipped":
      order.shipped_at = new Date();
      break;
    case "delivered":
      order.delivered_at = new Date();
      break;
    case "cancelled":
      order.cancelled_at = new Date();
      order.cancelled_by = userId;
      break;
  }

  await order.save();
  return { success: true, order };
}

/**
 * Submit order (draft → pending)
 */
export async function submitOrder(
  tenantDb: mongoose.Connection,
  orderId: string,
  userId: string
): Promise<TransitionResult> {
  const registry = getModelRegistry(tenantDb);
  const Order = registry.Order;

  const order = await Order.findOne({ order_id: orderId });
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (order.status !== "draft") {
    return { success: false, error: "Order must be in draft status to submit" };
  }

  if (!order.items || order.items.length === 0) {
    return { success: false, error: "Cannot submit empty order" };
  }

  // Recalculate totals before submitting
  recalculateOrderTotals(order);

  order.status = "pending";
  order.submitted_at = new Date();
  order.is_current = false; // No longer the current cart

  await order.save();
  return { success: true, order };
}

/**
 * Confirm order (pending/quotation.accepted → confirmed)
 */
export async function confirmOrder(
  tenantDb: mongoose.Connection,
  orderId: string,
  userId: string,
  userRole: UserRole
): Promise<TransitionResult> {
  const registry = getModelRegistry(tenantDb);
  const Order = registry.Order;

  const order = await Order.findOne({ order_id: orderId });
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  // Can confirm from pending or from quotation when accepted
  const canConfirm =
    order.status === "pending" ||
    (order.status === "quotation" && order.quotation?.quotation_status === "accepted");

  if (!canConfirm) {
    return {
      success: false,
      error: "Order must be pending or have accepted quotation to confirm",
    };
  }

  if (!canTransition(order.status as OrderStatus, "confirmed", userRole)) {
    return {
      success: false,
      error: `Role ${userRole} cannot confirm orders`,
    };
  }

  // Generate order number if not set
  if (!order.order_number) {
    const lastOrder = await Order.findOne({
      year: order.year,
      order_number: { $exists: true, $ne: null },
    })
      .sort({ order_number: -1 })
      .select("order_number");

    order.order_number = (lastOrder?.order_number || 0) + 1;
  }

  // Initialize payment data
  if (!order.payment) {
    order.payment = {
      payment_status: "awaiting",
      amount_due: order.order_total,
      amount_paid: 0,
      amount_remaining: order.order_total,
      payments: [],
    };
  }

  order.status = "confirmed";
  order.confirmed_at = new Date();
  order.is_current = false;

  await order.save();
  return { success: true, order };
}

/**
 * Ship order (confirmed → shipped)
 */
export async function shipOrder(
  tenantDb: mongoose.Connection,
  orderId: string,
  userId: string,
  userRole: UserRole,
  deliveryData?: DeliveryInput
): Promise<TransitionResult> {
  return await transitionStatusWithDelivery(
    tenantDb,
    orderId,
    "shipped",
    userId,
    userRole,
    deliveryData
  );
}

/**
 * Deliver order (shipped → delivered)
 */
export async function deliverOrder(
  tenantDb: mongoose.Connection,
  orderId: string,
  userId: string,
  userRole: UserRole
): Promise<TransitionResult> {
  const registry = getModelRegistry(tenantDb);
  const Order = registry.Order;

  const order = await Order.findOne({ order_id: orderId });
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (!canTransition(order.status as OrderStatus, "delivered", userRole)) {
    return {
      success: false,
      error: `Cannot transition from ${order.status} to delivered`,
    };
  }

  order.status = "delivered";
  order.delivered_at = new Date();
  if (order.delivery) {
    order.delivery.delivered_at = new Date();
  }

  await order.save();
  return { success: true, order };
}

/**
 * Cancel order (any → cancelled with restrictions)
 */
export async function cancelOrder(
  tenantDb: mongoose.Connection,
  orderId: string,
  userId: string,
  userRole: UserRole,
  reason?: string
): Promise<TransitionResult> {
  const registry = getModelRegistry(tenantDb);
  const Order = registry.Order;

  const order = await Order.findOne({ order_id: orderId });
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (isTerminalStatus(order.status as OrderStatus)) {
    return { success: false, error: "Cannot cancel order in terminal status" };
  }

  if (!canTransition(order.status as OrderStatus, "cancelled", userRole)) {
    return {
      success: false,
      error: `Role ${userRole} cannot cancel orders in ${order.status} status`,
    };
  }

  order.status = "cancelled";
  order.cancelled_at = new Date();
  order.cancelled_by = userId;
  order.cancellation_reason = reason;
  order.is_current = false;

  await order.save();
  return { success: true, order };
}

// ============================================
// QUOTATION MANAGEMENT
// ============================================

/**
 * Convert cart to quotation (draft → quotation)
 */
export async function convertToQuotation(
  tenantDb: mongoose.Connection,
  orderId: string,
  userId: string,
  options: QuotationOptions = {}
): Promise<TransitionResult> {
  const registry = getModelRegistry(tenantDb);
  const Order = registry.Order;

  const order = await Order.findOne({ order_id: orderId });
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (order.status !== "draft") {
    return { success: false, error: "Only draft orders can be converted to quotations" };
  }

  if (!order.items || order.items.length === 0) {
    return { success: false, error: "Cannot create quotation from empty cart" };
  }

  const daysValid = options.daysValid || 30;
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + daysValid);

  // Generate quotation number
  const year = new Date().getFullYear();
  const lastQuotation = await Order.findOne({
    "quotation.quotation_number": { $exists: true },
  })
    .sort({ "quotation.quotation_number": -1 })
    .select("quotation.quotation_number");

  let nextNum = 1;
  if (lastQuotation?.quotation?.quotation_number) {
    const match = lastQuotation.quotation.quotation_number.match(/Q-\d{4}-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  const quotationNumber = `Q-${year}-${String(nextNum).padStart(5, "0")}`;

  // Initialize quotation data
  order.quotation = {
    quotation_number: quotationNumber,
    quotation_status: "draft",
    valid_until: validUntil,
    days_valid: daysValid,
    current_revision: 0,
    revisions: [],
    total_rounds: 0,
    last_actor: "sales",
    last_activity_at: new Date(),
  };

  order.status = "quotation";
  order.is_current = false;

  // Create initial revision
  const initialRevision: IQuotationRevision = {
    revision_number: 0,
    created_at: new Date(),
    created_by: userId,
    actor_type: "sales",
    subtotal_net: order.subtotal_net,
    total_discount: order.total_discount,
    order_total: order.order_total,
    cart_discounts_added: [],
    line_adjustments_added: [],
    items_added: order.items.map((i) => i.line_number),
    items_removed: [],
    items_qty_changed: [],
    notes: options.notes,
  };
  order.quotation.revisions.push(initialRevision);

  await order.save();
  return { success: true, order };
}

/**
 * Send quotation to customer
 */
export async function sendQuotation(
  tenantDb: mongoose.Connection,
  orderId: string,
  userId: string,
  message?: string
): Promise<TransitionResult> {
  const registry = getModelRegistry(tenantDb);
  const Order = registry.Order;

  const order = await Order.findOne({ order_id: orderId });
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (order.status !== "quotation") {
    return { success: false, error: "Order is not a quotation" };
  }

  if (!order.quotation) {
    return { success: false, error: "Missing quotation data" };
  }

  order.quotation.quotation_status = "sent";
  order.quotation.sent_at = new Date();
  order.quotation.last_activity_at = new Date();
  order.quotation.last_actor = "sales";

  await order.save();
  return { success: true, order };
}

/**
 * Create a new revision (for changes during negotiation)
 */
export async function createRevision(
  tenantDb: mongoose.Connection,
  orderId: string,
  userId: string,
  userName: string,
  actorType: "sales" | "customer",
  changes: RevisionChanges
): Promise<TransitionResult> {
  const registry = getModelRegistry(tenantDb);
  const Order = registry.Order;

  const order = await Order.findOne({ order_id: orderId });
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (order.status !== "quotation") {
    return { success: false, error: "Can only revise quotations" };
  }

  if (!order.quotation) {
    return { success: false, error: "Missing quotation data" };
  }

  // Check if expired
  if (isQuotationExpired(order)) {
    order.quotation.quotation_status = "expired";
    order.quotation.expired_at = new Date();
    await order.save();
    return { success: false, error: "Quotation has expired" };
  }

  const newRevisionNumber = order.quotation.current_revision + 1;

  // Apply cart discounts
  if (changes.cartDiscountsAdded) {
    for (const discount of changes.cartDiscountsAdded) {
      discount.revision = newRevisionNumber;
      order.cart_discounts = order.cart_discounts || [];
      order.cart_discounts.push(discount);
    }
  }

  // Apply line adjustments
  if (changes.lineAdjustmentsAdded) {
    for (const adjustment of changes.lineAdjustmentsAdded) {
      adjustment.revision = newRevisionNumber;
      order.line_adjustments = order.line_adjustments || [];
      order.line_adjustments.push(adjustment);
    }
  }

  // Recalculate totals
  recalculateOrderTotals(order);

  // Create revision record
  const revision: IQuotationRevision = {
    revision_number: newRevisionNumber,
    created_at: new Date(),
    created_by: userId,
    created_by_name: userName,
    actor_type: actorType,
    subtotal_net: order.subtotal_net,
    total_discount: order.total_discount,
    order_total: order.order_total,
    cart_discounts_added: changes.cartDiscountsAdded || [],
    line_adjustments_added: changes.lineAdjustmentsAdded || [],
    items_added: changes.itemsAdded || [],
    items_removed: changes.itemsRemoved || [],
    items_qty_changed: changes.itemsQtyChanged || [],
    notes: changes.notes,
    internal_notes: changes.internalNotes,
  };

  order.quotation.revisions.push(revision);
  order.quotation.current_revision = newRevisionNumber;
  order.quotation.total_rounds += 1;
  order.quotation.last_actor = actorType;
  order.quotation.last_activity_at = new Date();
  order.quotation.quotation_status =
    actorType === "sales" ? "revised" : "counter_offer";

  await order.save();
  return { success: true, order };
}

/**
 * Accept quotation (customer accepts → can be confirmed)
 */
export async function acceptQuotation(
  tenantDb: mongoose.Connection,
  orderId: string,
  userId: string
): Promise<TransitionResult> {
  const registry = getModelRegistry(tenantDb);
  const Order = registry.Order;

  const order = await Order.findOne({ order_id: orderId });
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (order.status !== "quotation") {
    return { success: false, error: "Order is not a quotation" };
  }

  if (!order.quotation) {
    return { success: false, error: "Missing quotation data" };
  }

  // Check if expired
  if (isQuotationExpired(order)) {
    order.quotation.quotation_status = "expired";
    order.quotation.expired_at = new Date();
    await order.save();
    return { success: false, error: "Quotation has expired" };
  }

  order.quotation.quotation_status = "accepted";
  order.quotation.accepted_at = new Date();
  order.quotation.last_activity_at = new Date();
  order.quotation.last_actor = "customer";

  await order.save();
  return { success: true, order };
}

/**
 * Reject quotation
 */
export async function rejectQuotation(
  tenantDb: mongoose.Connection,
  orderId: string,
  userId: string,
  reason?: string
): Promise<TransitionResult> {
  const registry = getModelRegistry(tenantDb);
  const Order = registry.Order;

  const order = await Order.findOne({ order_id: orderId });
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (order.status !== "quotation") {
    return { success: false, error: "Order is not a quotation" };
  }

  if (!order.quotation) {
    return { success: false, error: "Missing quotation data" };
  }

  order.quotation.quotation_status = "rejected";
  order.quotation.rejected_at = new Date();
  order.quotation.last_activity_at = new Date();
  order.quotation.last_actor = "customer";

  // Add rejection reason as internal note on last revision
  if (reason && order.quotation.revisions.length > 0) {
    const lastRevision = order.quotation.revisions[order.quotation.revisions.length - 1];
    lastRevision.internal_notes = `Rejected: ${reason}`;
  }

  await order.save();
  return { success: true, order };
}

// ============================================
// DISCOUNTS & ADJUSTMENTS
// ============================================

/**
 * Add cart-level discount
 */
export async function addCartDiscount(
  tenantDb: mongoose.Connection,
  orderId: string,
  userId: string,
  discount: {
    type: "percentage" | "fixed";
    value: number;
    reason: AdjustmentReason;
    description?: string;
  }
): Promise<TransitionResult> {
  const registry = getModelRegistry(tenantDb);
  const Order = registry.Order;

  const order = await Order.findOne({ order_id: orderId });
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (!canModifyOrder(order.status as OrderStatus)) {
    return { success: false, error: "Cannot modify order in current status" };
  }

  const cartDiscount: ICartDiscount = {
    discount_id: nanoid(8),
    type: discount.type,
    value: discount.value,
    reason: discount.reason,
    description: discount.description,
    applied_by: userId,
    applied_at: new Date(),
  };

  order.cart_discounts = order.cart_discounts || [];
  order.cart_discounts.push(cartDiscount);

  // Recalculate totals
  recalculateOrderTotals(order);

  await order.save();
  return { success: true, order };
}

/**
 * Remove cart-level discount
 */
export async function removeCartDiscount(
  tenantDb: mongoose.Connection,
  orderId: string,
  discountId: string
): Promise<TransitionResult> {
  const registry = getModelRegistry(tenantDb);
  const Order = registry.Order;

  const order = await Order.findOne({ order_id: orderId });
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (!canModifyOrder(order.status as OrderStatus)) {
    return { success: false, error: "Cannot modify order in current status" };
  }

  if (!order.cart_discounts) {
    return { success: false, error: "No cart discounts found" };
  }

  const index = order.cart_discounts.findIndex((d) => d.discount_id === discountId);
  if (index === -1) {
    return { success: false, error: "Discount not found" };
  }

  order.cart_discounts.splice(index, 1);
  recalculateOrderTotals(order);

  await order.save();
  return { success: true, order };
}

/**
 * Add line-level adjustment
 */
export async function addLineAdjustment(
  tenantDb: mongoose.Connection,
  orderId: string,
  lineNumber: number,
  userId: string,
  adjustment: {
    type: "price_override" | "discount_percentage" | "discount_fixed";
    newValue: number;
    reason: AdjustmentReason;
    description?: string;
  }
): Promise<TransitionResult> {
  const registry = getModelRegistry(tenantDb);
  const Order = registry.Order;

  const order = await Order.findOne({ order_id: orderId });
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (!canModifyOrder(order.status as OrderStatus)) {
    return { success: false, error: "Cannot modify order in current status" };
  }

  const lineItem = order.items.find((i) => i.line_number === lineNumber);
  if (!lineItem) {
    return { success: false, error: "Line item not found" };
  }

  const lineAdjustment: ILineAdjustment = {
    adjustment_id: nanoid(8),
    line_number: lineNumber,
    type: adjustment.type,
    original_value: lineItem.unit_price,
    new_value: adjustment.newValue,
    reason: adjustment.reason,
    description: adjustment.description,
    applied_by: userId,
    applied_at: new Date(),
  };

  order.line_adjustments = order.line_adjustments || [];
  order.line_adjustments.push(lineAdjustment);

  recalculateOrderTotals(order);

  await order.save();
  return { success: true, order };
}

/**
 * Remove line-level adjustment
 */
export async function removeLineAdjustment(
  tenantDb: mongoose.Connection,
  orderId: string,
  adjustmentId: string
): Promise<TransitionResult> {
  const registry = getModelRegistry(tenantDb);
  const Order = registry.Order;

  const order = await Order.findOne({ order_id: orderId });
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (!canModifyOrder(order.status as OrderStatus)) {
    return { success: false, error: "Cannot modify order in current status" };
  }

  if (!order.line_adjustments) {
    return { success: false, error: "No line adjustments found" };
  }

  const index = order.line_adjustments.findIndex((a) => a.adjustment_id === adjustmentId);
  if (index === -1) {
    return { success: false, error: "Adjustment not found" };
  }

  order.line_adjustments.splice(index, 1);
  recalculateOrderTotals(order);

  await order.save();
  return { success: true, order };
}

// ============================================
// PAYMENT
// ============================================

/**
 * Record a payment
 */
export async function recordPayment(
  tenantDb: mongoose.Connection,
  orderId: string,
  userId: string,
  payment: PaymentInput
): Promise<TransitionResult> {
  const registry = getModelRegistry(tenantDb);
  const Order = registry.Order;

  const order = await Order.findOne({ order_id: orderId });
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  // Allow payment recording for confirmed, shipped, and delivered orders
  const paymentAllowedStatuses = ["confirmed", "shipped", "delivered"];
  if (!paymentAllowedStatuses.includes(order.status)) {
    return { success: false, error: "Can only record payments for confirmed, shipped, or delivered orders" };
  }

  // Initialize payment data if not present
  if (!order.payment) {
    order.payment = {
      payment_status: "awaiting",
      amount_due: order.order_total,
      amount_paid: 0,
      amount_remaining: order.order_total,
      payments: [],
    };
  }

  const paymentRecord: IPaymentRecord = {
    payment_id: nanoid(8),
    amount: payment.amount,
    method: payment.method,
    reference: payment.reference,
    recorded_at: payment.recorded_at ?? new Date(),
    recorded_by: userId,
    notes: payment.notes,
    confirmed: payment.confirmed ?? false,
  };

  order.payment.payments.push(paymentRecord);
  order.payment.amount_paid += payment.amount;
  order.payment.amount_remaining = Math.max(
    0,
    order.payment.amount_due - order.payment.amount_paid
  );

  // Update payment status
  if (order.payment.amount_remaining <= 0) {
    order.payment.payment_status = "paid";
    order.payment.payment_date = new Date();
  } else if (order.payment.amount_paid > 0) {
    order.payment.payment_status = "partial";
  }

  await order.save();
  return { success: true, order };
}

/**
 * Update payment status manually
 */
export async function updatePaymentStatus(
  tenantDb: mongoose.Connection,
  orderId: string,
  status: PaymentStatus
): Promise<TransitionResult> {
  const registry = getModelRegistry(tenantDb);
  const Order = registry.Order;

  const order = await Order.findOne({ order_id: orderId });
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (!order.payment) {
    order.payment = {
      payment_status: status,
      amount_due: order.order_total,
      amount_paid: 0,
      amount_remaining: order.order_total,
      payments: [],
    };
  } else {
    order.payment.payment_status = status;
  }

  if (status === "paid") {
    order.payment.payment_date = new Date();
  }

  await order.save();
  return { success: true, order };
}

/**
 * Delete a payment record by payment_id
 */
export async function deletePayment(
  tenantDb: mongoose.Connection,
  orderId: string,
  paymentId: string
): Promise<TransitionResult> {
  const registry = getModelRegistry(tenantDb);
  const Order = registry.Order;

  const order = await Order.findOne({ order_id: orderId });
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (!order.payment || !order.payment.payments) {
    return { success: false, error: "No payments found" };
  }

  const paymentIndex = order.payment.payments.findIndex(
    (p: IPaymentRecord) => p.payment_id === paymentId
  );

  if (paymentIndex === -1) {
    return { success: false, error: "Payment not found" };
  }

  // Get the amount being removed
  const removedAmount = order.payment.payments[paymentIndex].amount;

  // Remove the payment
  order.payment.payments.splice(paymentIndex, 1);

  // Recalculate totals
  order.payment.amount_paid = order.payment.payments.reduce(
    (sum: number, p: IPaymentRecord) => sum + p.amount,
    0
  );
  order.payment.amount_remaining = Math.max(
    0,
    order.payment.amount_due - order.payment.amount_paid
  );

  // Update payment status
  if (order.payment.amount_paid <= 0) {
    order.payment.payment_status = "awaiting";
    order.payment.payment_date = undefined;
  } else if (order.payment.amount_remaining <= 0) {
    order.payment.payment_status = "paid";
  } else {
    order.payment.payment_status = "partial";
  }

  await order.save();
  return { success: true, order };
}

/**
 * Edit a payment record by payment_id
 */
export async function editPayment(
  tenantDb: mongoose.Connection,
  orderId: string,
  paymentId: string,
  updates: {
    amount?: number;
    method?: string;
    reference?: string;
    notes?: string;
    recorded_at?: Date;
    confirmed?: boolean;
  }
): Promise<TransitionResult> {
  const registry = getModelRegistry(tenantDb);
  const Order = registry.Order;

  const order = await Order.findOne({ order_id: orderId });
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (!order.payment || !order.payment.payments) {
    return { success: false, error: "No payments found" };
  }

  const payment = order.payment.payments.find(
    (p: IPaymentRecord) => p.payment_id === paymentId
  );

  if (!payment) {
    return { success: false, error: "Payment not found" };
  }

  // Get old amount for recalculation
  const oldAmount = payment.amount;

  // Apply updates
  if (updates.amount !== undefined) {
    payment.amount = updates.amount;
  }
  if (updates.method !== undefined) {
    payment.method = updates.method;
  }
  if (updates.reference !== undefined) {
    payment.reference = updates.reference;
  }
  if (updates.notes !== undefined) {
    payment.notes = updates.notes;
  }
  if (updates.recorded_at !== undefined) {
    payment.recorded_at = updates.recorded_at;
  }
  if (updates.confirmed !== undefined) {
    payment.confirmed = updates.confirmed;
  }

  // Recalculate totals if amount changed
  if (updates.amount !== undefined && updates.amount !== oldAmount) {
    order.payment.amount_paid = order.payment.payments.reduce(
      (sum: number, p: IPaymentRecord) => sum + p.amount,
      0
    );
    order.payment.amount_remaining = Math.max(
      0,
      order.payment.amount_due - order.payment.amount_paid
    );

    // Update payment status
    if (order.payment.amount_paid <= 0) {
      order.payment.payment_status = "awaiting";
      order.payment.payment_date = undefined;
    } else if (order.payment.amount_remaining <= 0) {
      order.payment.payment_status = "paid";
      if (!order.payment.payment_date) {
        order.payment.payment_date = new Date();
      }
    } else {
      order.payment.payment_status = "partial";
    }
  }

  await order.save();
  return { success: true, order };
}

// ============================================
// DUPLICATION
// ============================================

/**
 * Duplicate an order as a new draft
 */
export async function duplicateOrder(
  tenantDb: mongoose.Connection,
  sourceOrderId: string,
  userId: string,
  options: DuplicateOptions = {}
): Promise<TransitionResult> {
  const registry = getModelRegistry(tenantDb);
  const Order = registry.Order;

  const sourceOrder = await Order.findOne({ order_id: sourceOrderId });
  if (!sourceOrder) {
    return { success: false, error: "Source order not found" };
  }

  const year = new Date().getFullYear();
  const newOrderId = nanoid(12);

  // Generate new cart number
  const lastCart = await Order.findOne({
    year,
    cart_number: { $exists: true, $ne: null },
  })
    .sort({ cart_number: -1 })
    .select("cart_number");

  const cartNumber = (lastCart?.cart_number || 0) + 1;

  // Copy items, optionally reset quantities
  const newItems = sourceOrder.items.map((item) => ({
    ...item,
    quantity: options.resetQuantities ? 1 : item.quantity,
    added_at: new Date(),
    updated_at: new Date(),
  }));

  // Create new draft order
  const newOrder = new Order({
    order_id: newOrderId,
    cart_number: cartNumber,
    year,
    status: "draft",
    is_current: true,

    tenant_id: sourceOrder.tenant_id,
    customer_id: sourceOrder.customer_id,
    customer_code: sourceOrder.customer_code,
    shipping_address_id: sourceOrder.shipping_address_id,
    shipping_address_code: sourceOrder.shipping_address_code,
    billing_address_id: sourceOrder.billing_address_id,

    requested_delivery_date: undefined,
    delivery_slot: sourceOrder.delivery_slot,
    delivery_route: sourceOrder.delivery_route,
    shipping_method: sourceOrder.shipping_method,

    price_list_id: sourceOrder.price_list_id,
    price_list_type: sourceOrder.price_list_type,
    order_type: sourceOrder.order_type,
    currency: sourceOrder.currency,
    pricelist_type: sourceOrder.pricelist_type,
    pricelist_code: sourceOrder.pricelist_code,

    subtotal_gross: 0,
    subtotal_net: 0,
    total_discount: 0,
    total_vat: 0,
    shipping_cost: sourceOrder.shipping_cost,
    order_total: 0,

    po_reference: undefined,
    cost_center: sourceOrder.cost_center,
    notes: options.clearNotes ? undefined : sourceOrder.notes,

    session_id: nanoid(12),
    flow_id: nanoid(8),
    source: sourceOrder.source,

    items: newItems,

    // Include discounts if requested
    cart_discounts: options.includeDiscounts ? sourceOrder.cart_discounts : [],
    line_adjustments: options.includeDiscounts ? sourceOrder.line_adjustments : [],

    // Track duplication
    duplicated_from: sourceOrderId,
    duplicated_at: new Date(),
  });

  // Recalculate totals
  recalculateOrderTotals(newOrder);

  // Clear is_current from any existing drafts for this customer+address
  await Order.updateMany(
    {
      customer_id: sourceOrder.customer_id,
      shipping_address_id: sourceOrder.shipping_address_id,
      status: "draft",
      is_current: true,
    },
    { is_current: false }
  );

  await newOrder.save();

  // Track duplication on source
  sourceOrder.duplications = sourceOrder.duplications || [];
  sourceOrder.duplications.push(newOrderId);
  await sourceOrder.save();

  return { success: true, order: newOrder };
}

// ============================================
// UTILITY
// ============================================

/**
 * Mark expired quotations (for scheduled job)
 */
export async function markExpiredQuotations(
  tenantDb: mongoose.Connection
): Promise<{ count: number }> {
  const registry = getModelRegistry(tenantDb);
  const Order = registry.Order;

  const now = new Date();

  const result = await Order.updateMany(
    {
      status: "quotation",
      "quotation.quotation_status": { $nin: ["accepted", "rejected", "expired"] },
      "quotation.valid_until": { $lt: now },
    },
    {
      $set: {
        "quotation.quotation_status": "expired",
        "quotation.expired_at": now,
      },
    }
  );

  return { count: result.modifiedCount };
}

/**
 * Get order with validation
 */
export async function getOrder(
  tenantDb: mongoose.Connection,
  orderId: string
): Promise<IOrder | null> {
  const registry = getModelRegistry(tenantDb);
  const Order = registry.Order;

  return await Order.findOne({ order_id: orderId });
}

// ============================================
// INTERNAL HELPERS
// ============================================

async function transitionStatusWithDelivery(
  tenantDb: mongoose.Connection,
  orderId: string,
  toStatus: OrderStatus,
  userId: string,
  userRole: UserRole,
  deliveryData?: DeliveryInput
): Promise<TransitionResult> {
  const registry = getModelRegistry(tenantDb);
  const Order = registry.Order;

  const order = await Order.findOne({ order_id: orderId });
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (!canTransition(order.status as OrderStatus, toStatus, userRole)) {
    return {
      success: false,
      error: `Cannot transition from ${order.status} to ${toStatus}`,
    };
  }

  order.status = toStatus;

  if (toStatus === "shipped") {
    order.shipped_at = new Date();

    // Initialize or update delivery data
    if (!order.delivery) {
      order.delivery = {};
    }
    order.delivery.shipped_at = new Date();

    if (deliveryData) {
      order.delivery.carrier = deliveryData.carrier;
      order.delivery.tracking_number = deliveryData.trackingNumber;
      order.delivery.tracking_url = deliveryData.trackingUrl;
      order.delivery.estimated_delivery = deliveryData.estimatedDelivery;
      order.delivery.delivery_notes = deliveryData.deliveryNotes;
    }
  }

  await order.save();
  return { success: true, order };
}
