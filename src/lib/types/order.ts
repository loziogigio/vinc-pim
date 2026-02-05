/**
 * Order/Cart Type Definitions
 *
 * Unified order document - cart is status: "draft"
 * Same document evolves: draft → quotation → pending → confirmed → shipped → delivered
 */

import type { DiscountStep } from "./pim";

// Re-export from constants for backwards compatibility
export type {
  OrderStatus,
  QuotationStatus,
  PaymentStatus,
  OrderType,
  PriceListType,
  OrderSource,
  AdjustmentReason,
  UserRole,
} from "@/lib/constants/order";

export {
  ORDER_STATUSES,
  QUOTATION_STATUSES,
  PAYMENT_STATUSES,
  ORDER_TYPES,
  PRICE_LIST_TYPES,
  ORDER_SOURCES,
  ADJUSTMENT_REASONS,
  STATUS_TRANSITIONS,
  canTransition,
  getAllowedTransitions,
  canModifyOrder,
  isTerminalStatus,
} from "@/lib/constants/order";

// ============================================
// DISCOUNT TYPES (kept here for backwards compat)
// ============================================

export type DiscountType = "percentage" | "fixed" | "override";

export type DiscountReason =
  | "customer_group"
  | "quantity"
  | "promo"
  | "manual"
  | "negotiation"
  | "loyalty"
  | "clearance";

// ============================================
// DISCOUNT TIER
// ============================================

export interface DiscountTier {
  tier: number; // 1-6, order of application
  type: DiscountType;
  value: number; // -50 = 50% off for percentage
  reason?: DiscountReason;
}

// ============================================
// LINE ITEM
// ============================================

export interface LineItem {
  // Identity
  line_number: number; // Sequence (10, 20, 30...)
  entity_code: string; // Required - Product identifier
  sku: string; // Required - Stock keeping unit
  product_source?: "pim" | "external" | "manual"; // Where the product comes from
  external_ref?: string; // External system reference (ERP code, etc.)

  // Quantity & Packaging
  quantity: number;
  quantity_unit?: string; // pcs, kg, box
  min_order_quantity?: number;
  pack_size?: number;
  packaging_code?: string; // e.g., "PZ", "BOX", "CF"
  packaging_label?: string; // e.g., "Scatola da 6"

  // Pricing
  list_price: number; // Wholesale price
  retail_price?: number; // MSRP (manufacturer's suggested retail price)
  unit_price: number; // Price after all discounts (what customer pays)
  promo_price?: number; // Special promo price if active
  vat_rate: number; // VAT percentage (22, 10, 4, 0)

  // Line Totals (calculated)
  line_gross: number; // quantity × list_price
  line_net: number; // quantity × unit_price
  line_vat: number; // line_net × vat_rate%
  line_total: number; // line_net + line_vat

  // Discounts
  discounts: DiscountTier[];
  total_discount_percent: number; // Combined discount %

  // Promotion
  promo_id?: string;
  is_gift_line: boolean;
  gift_with_purchase?: string; // Linked to which SKU

  // Product Snapshot
  name: string; // Product name at order time
  image_url?: string;
  brand?: string;
  category?: string;

  // Tracking
  added_at: Date;
  updated_at: Date;
  added_from?: string; // pdp, plp, search, quick_order
  added_via?: string; // main_cta, row_action, carousel

  // Promo tracking
  promo_code?: string; // External promo code (e.g., "017")
  promo_row?: number; // External promo row (e.g., 67)
  promo_label?: string; // Promotion description (e.g., "Sconto quantità")
  promo_discount_pct?: number; // Promotion discount percentage (e.g., -10)
  promo_discount_amt?: number; // Promotion discount amount (e.g., -5.00)
  discount_chain?: DiscountStep[]; // Full discount chain with type, value, source, order

  // Raw source payload (auto-captured from request body)
  raw_data?: Record<string, unknown>;
}

// ============================================
// CART-LEVEL DISCOUNT (for quotation negotiation)
// ============================================

export interface CartDiscount {
  discount_id: string; // nanoid(8)
  type: "percentage" | "fixed";
  value: number; // -10 = 10% off, -50 = €50 off
  reason: DiscountReason;
  description?: string; // "Volume discount", "Loyalty bonus"
  applied_by?: string; // User ID who applied
  applied_at: Date;
  revision?: number; // Which revision this was added in
}

// ============================================
// LINE-LEVEL ADJUSTMENT (price overrides during quotation)
// ============================================

export interface LineAdjustment {
  adjustment_id: string; // nanoid(8)
  line_number: number; // Reference to line item
  type: "price_override" | "discount_percentage" | "discount_fixed";
  original_value: number; // Original unit_price or 0
  new_value: number; // New price or discount amount
  reason: DiscountReason;
  description?: string;
  applied_by?: string;
  applied_at: Date;
  revision?: number;
}

// ============================================
// QUOTATION REVISION (history tracking)
// ============================================

export interface QuotationRevision {
  revision_number: number; // 1, 2, 3...
  created_at: Date;
  created_by: string; // User ID
  created_by_name?: string; // Cached user name
  actor_type: "sales" | "customer";

  // Snapshot of totals at this revision
  subtotal_net: number;
  total_discount: number;
  order_total: number;

  // Changes in this revision
  cart_discounts_added: CartDiscount[];
  line_adjustments_added: LineAdjustment[];
  items_added: number[]; // line_numbers
  items_removed: number[]; // line_numbers
  items_qty_changed: Array<{
    line_number: number;
    old_qty: number;
    new_qty: number;
  }>;

  // Notes for this revision
  notes?: string;
  internal_notes?: string;
}

// ============================================
// QUOTATION DATA
// ============================================

export interface QuotationData {
  quotation_number?: string; // Q-2025-00001 format
  quotation_status: QuotationStatus;

  // Validity
  valid_until?: Date;
  days_valid: number; // Default: 30

  // Revisions
  current_revision: number;
  revisions: QuotationRevision[];

  // Negotiation summary
  total_rounds: number;
  last_actor: "sales" | "customer";
  last_activity_at: Date;

  // Timestamps
  sent_at?: Date;
  accepted_at?: Date;
  rejected_at?: Date;
  expired_at?: Date;
}

// ============================================
// PAYMENT DATA
// ============================================

export interface PaymentRecord {
  payment_id: string; // nanoid(8)
  amount: number;
  method: string; // "bank_transfer", "credit_card", etc.
  reference?: string; // External payment ID
  recorded_at: Date;
  recorded_by?: string;
  notes?: string;
  confirmed: boolean; // Whether payment has been verified/confirmed
}

export interface PaymentData {
  payment_status: PaymentStatus;
  payment_method?: string;
  payment_terms?: string; // "NET30", "NET60", "COD"

  // Amounts
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;

  // Tracking
  payment_reference?: string;
  payment_date?: Date;
  due_date?: Date;

  // For partial payments
  payments: PaymentRecord[];
}

// ============================================
// DELIVERY DATA
// ============================================

export interface DeliveryData {
  carrier?: string;
  tracking_number?: string;
  tracking_url?: string;
  shipped_at?: Date;
  estimated_delivery?: Date;
  delivered_at?: Date;
  delivery_proof?: string; // URL to signed delivery receipt
  delivery_notes?: string;
}

// ============================================
// ORDER
// ============================================

export interface Order {
  // Identity
  order_id: string; // nanoid(12) - globally unique
  order_number?: number; // Sequential per year (assigned on confirm)
  year: number; // Order year (2025)
  status: OrderStatus;
  is_current: boolean; // Only ONE draft per customer+address can be current

  // Tenant (multi-tenant support)
  tenant_id: string; // e.g., "hidros-it"

  // Customer
  customer_id: string;
  customer_code?: string; // Customer ERP code (external code for lookup)
  shipping_address_id?: string; // Internal address ID
  shipping_address_code?: string; // Address ERP code (external code for lookup)
  billing_address_id?: string;

  // Delivery
  requested_delivery_date?: Date;
  delivery_slot?: string; // morning, afternoon
  delivery_route?: string;
  shipping_method?: string; // courier, pickup
  requires_delivery: boolean; // false for service orders

  // Pricing Context
  price_list_id: string;
  price_list_type: PriceListType;
  order_type: OrderType;
  currency: string; // EUR, USD
  pricelist_type?: string; // External pricelist type (e.g., "VEND")
  pricelist_code?: string; // External pricelist code (e.g., "02")

  // Totals
  subtotal_gross: number; // Sum of line gross
  subtotal_net: number; // Sum of line net
  total_discount: number; // Total discount amount
  total_vat: number;
  shipping_cost: number;
  order_total: number; // net + VAT + shipping

  // B2B Fields
  po_reference?: string;
  cost_center?: string;
  notes?: string;
  internal_notes?: string;

  // Timestamps
  created_at: Date;
  updated_at: Date;
  confirmed_at?: Date;

  // Tracking
  session_id: string;
  flow_id: string;
  source?: OrderSource;

  // Items
  items: LineItem[];

  // ============================================
  // NEW: Quotation Data (when status = "quotation")
  // ============================================
  quotation?: QuotationData;

  // Cart-level discounts (applicable in any status)
  cart_discounts?: CartDiscount[];

  // Line-level negotiation adjustments
  line_adjustments?: LineAdjustment[];

  // ============================================
  // NEW: Payment Tracking
  // ============================================
  payment?: PaymentData;

  // ============================================
  // NEW: Delivery Tracking
  // ============================================
  delivery?: DeliveryData;

  // ============================================
  // NEW: Duplication Tracking
  // ============================================
  duplicated_from?: string; // Original order_id
  duplicated_at?: Date;
  duplications?: string[]; // order_ids of copies

  // ============================================
  // NEW: Lifecycle Timestamps
  // ============================================
  submitted_at?: Date; // When customer submitted
  shipped_at?: Date;
  delivered_at?: Date;
  cancelled_at?: Date;
  cancelled_by?: string;
  cancellation_reason?: string;

  // Cart-specific fields
  cart_number?: number; // Sequential per year, assigned on cart creation
}

// ============================================
// API REQUEST TYPES
// ============================================

/** Customer input for lookup or create */
export interface CustomerInput {
  external_code?: string;
  email?: string;
  customer_type?: "business" | "private" | "reseller";
  is_guest?: boolean;
  phone?: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  legal_info?: {
    vat_number?: string;
    fiscal_code?: string;
    pec_email?: string;
    sdi_code?: string;
  };
  addresses?: AddressInput[];
}

/** Address input for lookup or create */
export interface AddressInput {
  external_code?: string;
  address_type?: "delivery" | "billing" | "both";
  label?: string;
  is_default?: boolean;
  recipient_name: string;
  street_address: string;
  street_address_2?: string;
  city: string;
  province: string;
  postal_code: string;
  country?: string;
  phone?: string;
  delivery_notes?: string;
}

export interface CreateOrderRequest {
  // Customer lookup options (priority order):
  customer_id?: string; // 1st: Internal ID
  customer_code?: string; // 2nd: External code (ERP)
  customer?: CustomerInput; // 3rd: Lookup or create with this data

  // Address lookup options:
  shipping_address_id?: string; // 1st: Internal ID
  shipping_address?: AddressInput; // 2nd: Lookup or create
  billing_address_id?: string;

  // Order fields
  order_type?: OrderType;
  price_list_id?: string;
  price_list_type?: PriceListType;
  currency?: string;
  pricelist_type?: string; // External pricelist type (e.g., "VEND")
  pricelist_code?: string; // External pricelist code (e.g., "02")
  requested_delivery_date?: string; // ISO date
  delivery_slot?: string;
  delivery_route?: string;
  shipping_method?: string;
  requires_delivery?: boolean; // false for service orders
  po_reference?: string;
  cost_center?: string;
  notes?: string;
}

export interface AddItemRequest {
  // Required
  entity_code: string;
  sku: string;
  quantity: number;
  list_price: number;
  unit_price: number;
  vat_rate: number;
  name: string;

  // Optional pricing
  retail_price?: number; // MSRP

  // Product source
  product_source?: "pim" | "external" | "manual"; // Default: "pim"
  external_ref?: string; // External system reference (ERP code, etc.)

  // Packaging information
  packaging_code?: string;        // e.g., "PZ", "BOX", "CF"
  packaging_label?: string;       // e.g., "Scatola da 6"
  pack_size?: number;             // e.g., 6
  quantity_unit?: string;         // e.g., "PZ"
  min_order_quantity?: number;

  // Optional pricing
  promo_price?: number;
  discounts?: DiscountTier[];

  // Optional promotion
  promo_id?: string;
  is_gift_line?: boolean;
  gift_with_purchase?: string;

  // Optional product snapshot
  image_url?: string;
  brand?: string;
  category?: string;

  // Optional tracking
  added_from?: string;
  added_via?: string;

  // Promo fields
  promo_code?: string;
  promo_row?: number;
  promo_label?: string;
  promo_discount_pct?: number;
  promo_discount_amt?: number;
  discount_chain?: DiscountStep[]; // Full discount chain with type, value, source, order
}

export interface UpdateItemRequest {
  quantity: number;
  notes?: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface OrderResponse {
  success: true;
  order: Order;
}

export interface OrderWithItemResponse {
  success: true;
  order: Order;
  item: LineItem;
}

export interface OrderListResponse {
  success: true;
  orders: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface OrderErrorResponse {
  error: string;
  details?: string;
}

// ============================================
// HELPER FUNCTIONS (pure, no side effects)
// ============================================

/**
 * Calculate line item totals
 */
export function calculateLineTotals(
  quantity: number,
  list_price: number,
  unit_price: number,
  vat_rate: number
): { line_gross: number; line_net: number; line_vat: number; line_total: number } {
  const line_gross = quantity * list_price;
  const line_net = quantity * unit_price;
  const line_vat = line_net * (vat_rate / 100);
  const line_total = line_net + line_vat;

  return {
    line_gross: Math.round(line_gross * 100) / 100,
    line_net: Math.round(line_net * 100) / 100,
    line_vat: Math.round(line_vat * 100) / 100,
    line_total: Math.round(line_total * 100) / 100,
  };
}

/**
 * Calculate total discount percentage from discount tiers
 */
export function calculateTotalDiscountPercent(discounts: DiscountTier[]): number {
  if (!discounts || discounts.length === 0) return 0;

  // For cascading percentage discounts, apply in order
  let remaining = 100;
  for (const d of discounts.sort((a, b) => a.tier - b.tier)) {
    if (d.type === "percentage") {
      remaining = remaining * (1 + d.value / 100);
    }
  }
  return Math.round((100 - remaining) * 100) / 100;
}

/**
 * Validate quantity against MOQ and pack size
 */
export function validateQuantity(
  qty: number,
  min?: number,
  pack?: number
): string | null {
  if (qty <= 0) {
    return "Quantity must be greater than 0";
  }
  if (min && qty < min) {
    return `Minimum order quantity is ${min}`;
  }
  if (pack && qty % pack !== 0) {
    return `Quantity must be a multiple of ${pack}`;
  }
  return null; // valid
}

/**
 * Get next line number (increment by 10)
 */
export function getNextLineNumber(items: LineItem[]): number {
  if (!items || items.length === 0) return 10;
  const maxLine = Math.max(...items.map((i) => i.line_number));
  return maxLine + 10;
}
