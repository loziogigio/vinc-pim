/**
 * Order Constants
 *
 * Single source of truth for order-related enumerations and status transitions.
 * Following CLAUDE.md guidelines for constants management.
 */

// ============================================
// ORDER STATUS
// ============================================

export const ORDER_STATUSES = [
  "draft", // Working cart
  "quotation", // Under negotiation
  "pending", // Submitted, awaiting confirmation
  "confirmed", // Sales Order - locked
  "shipped", // In delivery
  "delivered", // Completed
  "cancelled", // Cancelled at any stage
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Bozza",
  quotation: "Preventivo",
  pending: "In Attesa",
  confirmed: "Confermato",
  shipped: "Spedito",
  delivered: "Consegnato",
  cancelled: "Annullato",
};

// ============================================
// QUOTATION SUB-STATUS
// ============================================

export const QUOTATION_STATUSES = [
  "draft", // Initial quotation creation
  "sent", // Sent to customer
  "counter_offer", // Customer made counter-offer
  "revised", // Sales team revised
  "accepted", // Customer accepted
  "rejected", // Customer rejected
  "expired", // Quotation expired
] as const;

export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: "Bozza Preventivo",
  sent: "Inviato al Cliente",
  counter_offer: "Controproposta",
  revised: "Revisionato",
  accepted: "Accettato",
  rejected: "Rifiutato",
  expired: "Scaduto",
};

// ============================================
// PAYMENT STATUS
// ============================================

export const PAYMENT_STATUSES = [
  "not_required", // For samples, internal orders
  "awaiting", // Waiting for payment
  "partial", // Partial payment received
  "paid", // Fully paid
  "failed", // Payment failed
  "refunded", // Order refunded
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  not_required: "Non Richiesto",
  awaiting: "In Attesa di Pagamento",
  partial: "Pagamento Parziale",
  paid: "Pagato",
  failed: "Pagamento Fallito",
  refunded: "Rimborsato",
};

// ============================================
// ORDER TYPES
// ============================================

export const ORDER_TYPES = ["b2b", "b2c", "quote", "sample"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

// ============================================
// PRICE LIST TYPES
// ============================================

export const PRICE_LIST_TYPES = ["retail", "wholesale", "promo"] as const;
export type PriceListType = (typeof PRICE_LIST_TYPES)[number];

// ============================================
// ORDER SOURCES (legacy — kept for backwards compat)
// ============================================

export const ORDER_SOURCES = ["web", "mobile", "api", "import"] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

// ============================================
// ORDER CHANNELS
// ============================================

// ============================================
// DISCOUNT TYPES & REASONS
// ============================================

export const DISCOUNT_TYPES = ["percentage", "fixed", "override"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const ADJUSTMENT_REASONS = [
  "customer_group",
  "quantity",
  "promo",
  "manual",
  "negotiation", // Negotiated during quotation
  "loyalty", // Loyalty discount
  "clearance", // End of line
] as const;

export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

// ============================================
// USER ROLES (for transitions)
// ============================================

export const USER_ROLES = [
  "customer",
  "sales",
  "admin",
  "warehouse",
  "api",
  "system",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

// ============================================
// STATUS TRANSITIONS
// ============================================

/**
 * Defines allowed status transitions and required roles.
 * Format: { [fromStatus]: { [toStatus]: allowedRoles[] } }
 */
export const STATUS_TRANSITIONS: Record<
  OrderStatus,
  Partial<Record<OrderStatus, UserRole[]>>
> = {
  draft: {
    quotation: ["sales", "admin"], // Convert cart to quotation
    pending: ["customer", "sales", "admin", "api"], // Submit order directly
    cancelled: ["customer", "sales", "admin"],
  },
  quotation: {
    draft: ["sales", "admin"], // Revert to cart for major changes
    confirmed: ["sales", "admin"], // Accept quotation → Sales Order
    cancelled: ["customer", "sales", "admin"],
  },
  pending: {
    confirmed: ["sales", "admin"], // Confirm order
    cancelled: ["sales", "admin"],
  },
  confirmed: {
    shipped: ["warehouse", "admin"], // Mark as shipped
    cancelled: ["admin"], // Only admin can cancel confirmed
  },
  shipped: {
    delivered: ["warehouse", "admin", "system"],
    cancelled: ["admin"], // Exceptional cancellation
  },
  delivered: {
    // Terminal state - no transitions (except via duplication)
  },
  cancelled: {
    draft: ["admin"], // Reactivate as draft (exceptional)
  },
};

/**
 * Check if a status transition is allowed for a given role.
 */
export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  userRole: UserRole
): boolean {
  const allowed = STATUS_TRANSITIONS[from]?.[to];
  if (!allowed) return false;
  return allowed.includes(userRole) || allowed.includes("admin");
}

/**
 * Get allowed transitions for a given status and role.
 */
export function getAllowedTransitions(
  from: OrderStatus,
  userRole: UserRole
): OrderStatus[] {
  const transitions = STATUS_TRANSITIONS[from];
  if (!transitions) return [];

  return Object.entries(transitions)
    .filter(([_, roles]) => roles?.includes(userRole) || roles?.includes("admin"))
    .map(([status]) => status as OrderStatus);
}

/**
 * Check if an order can be modified (items added/removed/updated).
 */
export function canModifyOrder(status: OrderStatus): boolean {
  return status === "draft" || status === "quotation";
}

/**
 * Check if an order is in a terminal state.
 */
export function isTerminalStatus(status: OrderStatus): boolean {
  return status === "delivered" || status === "cancelled";
}
