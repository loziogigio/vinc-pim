import mongoose, { Schema, Document } from "mongoose";
import type { DiscountStep } from "@/lib/types/pim";
import {
  ORDER_STATUSES,
  QUOTATION_STATUSES,
  PAYMENT_STATUSES,
  ORDER_TYPES,
  PRICE_LIST_TYPES,
  ORDER_SOURCES,
  ADJUSTMENT_REASONS,
} from "@/lib/constants/order";
import type {
  OrderStatus,
  QuotationStatus,
  PaymentStatus,
  OrderType,
  PriceListType,
  OrderSource,
  AdjustmentReason,
} from "@/lib/constants/order";

/**
 * Order Model
 *
 * Unified order document where status: "draft" represents a cart.
 * Same document evolves: draft → quotation → pending → confirmed → shipped → delivered
 *
 * Collection: orders (lowercase, pluralized per CLAUDE.md)
 */

// ============================================
// INTERFACES
// ============================================

export interface IDiscountTier {
  tier: number; // 1-6, order of application
  type: "percentage" | "fixed" | "override";
  value: number; // -50 = 50% off for percentage
  reason?: AdjustmentReason;
}

export interface ILineItem {
  // Identity
  line_number: number;
  entity_code: string;
  sku: string;
  product_source?: "pim" | "external" | "manual"; // Where the product comes from
  external_ref?: string; // External system reference (ERP code, etc.)

  // Quantity & Packaging
  quantity: number;
  quantity_unit?: string;
  min_order_quantity?: number;
  pack_size?: number;
  pkg_id?: string;
  packaging_code?: string;
  packaging_label?: string;

  // Pricing
  list_price: number;
  retail_price?: number; // MSRP (manufacturer's suggested retail price)
  unit_price: number;
  promo_price?: number;
  vat_rate: number;

  // Line Totals
  line_gross: number;
  line_net: number;
  line_vat: number;
  line_total: number;

  // Discounts
  discounts: IDiscountTier[];
  total_discount_percent: number;

  // Promotion
  promo_id?: string;
  is_gift_line: boolean;
  gift_with_purchase?: string;

  // Product Snapshot
  name: string;
  image_url?: string;
  brand?: string;
  category?: string;

  // Tracking
  added_at: Date;
  updated_at: Date;
  added_from?: string;
  added_via?: string;

  // Promo tracking
  promo_code?: string;
  promo_row?: number;
  promo_label?: string;
  promo_discount_pct?: number;
  promo_discount_amt?: number;
  discount_chain?: DiscountStep[]; // Full discount chain with type, value, source, order

  // Raw source payload (auto-captured from request body)
  raw_data?: Record<string, unknown>;
}

// ============================================
// CART DISCOUNT (for quotation negotiation)
// ============================================

export interface ICartDiscount {
  discount_id: string; // nanoid(8)
  type: "percentage" | "fixed";
  value: number; // -10 = 10% off, -50 = €50 off
  reason: AdjustmentReason;
  description?: string; // "Volume discount", "Loyalty bonus"
  applied_by?: string; // User ID who applied
  applied_at: Date;
  revision?: number; // Which revision this was added in
}

// ============================================
// LINE ADJUSTMENT (price overrides during quotation)
// ============================================

export interface ILineAdjustment {
  adjustment_id: string; // nanoid(8)
  line_number: number; // Reference to line item
  type: "price_override" | "discount_percentage" | "discount_fixed";
  original_value: number; // Original unit_price or 0
  new_value: number; // New price or discount amount
  reason: AdjustmentReason;
  description?: string;
  applied_by?: string;
  applied_at: Date;
  revision?: number;
}

// ============================================
// QUOTATION REVISION (history tracking)
// ============================================

export interface IQuotationRevision {
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
  cart_discounts_added: ICartDiscount[];
  line_adjustments_added: ILineAdjustment[];
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

export interface IQuotationData {
  quotation_number?: string; // Q-2025-00001 format
  quotation_status: QuotationStatus;

  // Validity
  valid_until?: Date;
  days_valid: number; // Default: 30

  // Revisions
  current_revision: number;
  revisions: IQuotationRevision[];

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
// PAYMENT RECORD
// ============================================

export interface IPaymentRecord {
  payment_id: string; // nanoid(8)
  amount: number;
  method: string; // "bank_transfer", "credit_card", etc.
  reference?: string; // External payment ID
  recorded_at: Date;
  recorded_by?: string;
  notes?: string;
  confirmed?: boolean;
  // Provider integration (optional, backwards-compatible)
  provider?: string; // "stripe" | "nexi" | "axerve" | "mangopay" | "paypal" | "manual"
  provider_data?: {
    provider_payment_id?: string;
    provider_contract_id?: string;
    payment_type?: "onclick" | "moto" | "recurrent";
    three_ds_status?: string;
  };
}

// ============================================
// PAYMENT DATA
// ============================================

export interface IPaymentData {
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
  payments: IPaymentRecord[];
}

// ============================================
// DELIVERY DATA
// ============================================

export interface IDeliveryData {
  carrier?: string;
  tracking_number?: string;
  tracking_url?: string;
  shipped_at?: Date;
  estimated_delivery?: Date;
  delivered_at?: Date;
  delivery_proof?: string; // URL to signed delivery receipt
  delivery_notes?: string;
}

export interface IOrder extends Document {
  // Identity
  order_id: string;
  order_number?: number;
  cart_number?: number; // Sequential cart number per year (assigned on cart creation)
  year: number;
  status: OrderStatus;
  is_current: boolean; // Only ONE draft per customer+address can be current

  // Tenant (multi-tenant support)
  tenant_id: string;

  // Customer
  customer_id: string;
  customer_code?: string;
  shipping_address_id?: string;
  shipping_address_code?: string; // External address code for cart lookup
  billing_address_id?: string;

  // Delivery
  requested_delivery_date?: Date;
  delivery_slot?: string;
  delivery_route?: string;
  shipping_method?: string;
  requires_delivery?: boolean;

  // Pricing Context
  price_list_id: string;
  price_list_type: PriceListType;
  order_type: OrderType;
  currency: string;
  pricelist_type?: string; // External pricelist type (e.g., "VEND")
  pricelist_code?: string; // External pricelist code (e.g., "02")

  // Totals
  subtotal_gross: number;
  subtotal_net: number;
  total_discount: number;
  total_vat: number;
  shipping_cost: number;
  order_total: number;

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
  items: ILineItem[];

  // ============================================
  // Quotation Data (when status = "quotation")
  // ============================================
  quotation?: IQuotationData;

  // Cart-level discounts (applicable in any status)
  cart_discounts?: ICartDiscount[];

  // Line-level negotiation adjustments
  line_adjustments?: ILineAdjustment[];

  // ============================================
  // Payment Tracking
  // ============================================
  payment?: IPaymentData;

  // ============================================
  // Delivery Tracking
  // ============================================
  delivery?: IDeliveryData;

  // ============================================
  // Customer Tags (resolved at cart creation)
  // ============================================
  effective_tags?: string[]; // e.g., ["categoria-di-sconto:sconto-45", "categoria-clienti:idraulico"]

  // ============================================
  // Duplication Tracking
  // ============================================
  duplicated_from?: string; // Original order_id
  duplicated_at?: Date;
  duplications?: string[]; // order_ids of copies

  // ============================================
  // Lifecycle Timestamps
  // ============================================
  submitted_at?: Date; // When customer submitted
  shipped_at?: Date;
  delivered_at?: Date;
  cancelled_at?: Date;
  cancelled_by?: string;
  cancellation_reason?: string;
}

// ============================================
// SCHEMAS
// ============================================

const DiscountTierSchema = new Schema<IDiscountTier>(
  {
    tier: { type: Number, required: true, min: 1, max: 6 },
    type: {
      type: String,
      required: true,
      enum: ["percentage", "fixed", "override"],
    },
    value: { type: Number, required: true },
    reason: {
      type: String,
      enum: ADJUSTMENT_REASONS,
    },
  },
  { _id: false }
);

// ============================================
// CART DISCOUNT SCHEMA
// ============================================

const CartDiscountSchema = new Schema<ICartDiscount>(
  {
    discount_id: { type: String, required: true },
    type: { type: String, required: true, enum: ["percentage", "fixed"] },
    value: { type: Number, required: true },
    reason: { type: String, required: true, enum: ADJUSTMENT_REASONS },
    description: { type: String },
    applied_by: { type: String },
    applied_at: { type: Date, default: Date.now },
    revision: { type: Number },
  },
  { _id: false }
);

// ============================================
// LINE ADJUSTMENT SCHEMA
// ============================================

const LineAdjustmentSchema = new Schema<ILineAdjustment>(
  {
    adjustment_id: { type: String, required: true },
    line_number: { type: Number, required: true },
    type: {
      type: String,
      required: true,
      enum: ["price_override", "discount_percentage", "discount_fixed"],
    },
    original_value: { type: Number, required: true },
    new_value: { type: Number, required: true },
    reason: { type: String, required: true, enum: ADJUSTMENT_REASONS },
    description: { type: String },
    applied_by: { type: String },
    applied_at: { type: Date, default: Date.now },
    revision: { type: Number },
  },
  { _id: false }
);

// ============================================
// QUOTATION REVISION SCHEMA
// ============================================

const QtyChangeSchema = new Schema(
  {
    line_number: { type: Number, required: true },
    old_qty: { type: Number, required: true },
    new_qty: { type: Number, required: true },
  },
  { _id: false }
);

const QuotationRevisionSchema = new Schema<IQuotationRevision>(
  {
    revision_number: { type: Number, required: true },
    created_at: { type: Date, default: Date.now },
    created_by: { type: String, required: true },
    created_by_name: { type: String },
    actor_type: { type: String, required: true, enum: ["sales", "customer"] },

    // Snapshot
    subtotal_net: { type: Number, required: true },
    total_discount: { type: Number, required: true },
    order_total: { type: Number, required: true },

    // Changes
    cart_discounts_added: { type: [CartDiscountSchema], default: [] },
    line_adjustments_added: { type: [LineAdjustmentSchema], default: [] },
    items_added: { type: [Number], default: [] },
    items_removed: { type: [Number], default: [] },
    items_qty_changed: { type: [QtyChangeSchema], default: [] },

    // Notes
    notes: { type: String },
    internal_notes: { type: String },
  },
  { _id: false }
);

// ============================================
// QUOTATION DATA SCHEMA
// ============================================

const QuotationDataSchema = new Schema<IQuotationData>(
  {
    quotation_number: { type: String },
    quotation_status: {
      type: String,
      required: true,
      enum: QUOTATION_STATUSES,
      default: "draft",
    },

    // Validity
    valid_until: { type: Date },
    days_valid: { type: Number, default: 30 },

    // Revisions
    current_revision: { type: Number, default: 0 },
    revisions: { type: [QuotationRevisionSchema], default: [] },

    // Negotiation
    total_rounds: { type: Number, default: 0 },
    last_actor: { type: String, enum: ["sales", "customer"] },
    last_activity_at: { type: Date },

    // Timestamps
    sent_at: { type: Date },
    accepted_at: { type: Date },
    rejected_at: { type: Date },
    expired_at: { type: Date },
  },
  { _id: false }
);

// ============================================
// PAYMENT RECORD SCHEMA
// ============================================

const ProviderDataSchema = new Schema(
  {
    provider_payment_id: { type: String },
    provider_contract_id: { type: String },
    payment_type: { type: String, enum: ["onclick", "moto", "recurrent"] },
    three_ds_status: { type: String },
  },
  { _id: false }
);

const PaymentRecordSchema = new Schema<IPaymentRecord>(
  {
    payment_id: { type: String, required: true },
    amount: { type: Number, required: true },
    method: { type: String, required: true },
    reference: { type: String },
    recorded_at: { type: Date, default: Date.now },
    recorded_by: { type: String },
    notes: { type: String },
    confirmed: { type: Boolean, default: false },
    provider: { type: String },
    provider_data: { type: ProviderDataSchema },
  },
  { _id: false }
);

// ============================================
// PAYMENT DATA SCHEMA
// ============================================

const PaymentDataSchema = new Schema<IPaymentData>(
  {
    payment_status: {
      type: String,
      required: true,
      enum: PAYMENT_STATUSES,
      default: "awaiting",
    },
    payment_method: { type: String },
    payment_terms: { type: String },

    // Amounts
    amount_due: { type: Number, required: true, default: 0 },
    amount_paid: { type: Number, required: true, default: 0 },
    amount_remaining: { type: Number, required: true, default: 0 },

    // Tracking
    payment_reference: { type: String },
    payment_date: { type: Date },
    due_date: { type: Date },

    // Payments
    payments: { type: [PaymentRecordSchema], default: [] },
  },
  { _id: false }
);

// ============================================
// DELIVERY DATA SCHEMA
// ============================================

const DeliveryDataSchema = new Schema<IDeliveryData>(
  {
    carrier: { type: String },
    tracking_number: { type: String },
    tracking_url: { type: String },
    shipped_at: { type: Date },
    estimated_delivery: { type: Date },
    delivered_at: { type: Date },
    delivery_proof: { type: String },
    delivery_notes: { type: String },
  },
  { _id: false }
);

const LineItemSchema = new Schema<ILineItem>(
  {
    // Identity
    line_number: { type: Number, required: true },
    entity_code: { type: String, required: true },
    sku: { type: String, required: true },
    product_source: { type: String, enum: ["pim", "external", "manual"], default: "pim" },
    external_ref: { type: String },

    // Quantity & Packaging
    quantity: { type: Number, required: true, min: 0 },
    quantity_unit: { type: String },
    min_order_quantity: { type: Number },
    pack_size: { type: Number },
    pkg_id: { type: String },
    packaging_code: { type: String },
    packaging_label: { type: String },

    // Pricing
    list_price: { type: Number, required: true },
    retail_price: { type: Number },
    unit_price: { type: Number, required: true },
    promo_price: { type: Number },
    vat_rate: { type: Number, required: true },

    // Line Totals
    line_gross: { type: Number, required: true, default: 0 },
    line_net: { type: Number, required: true, default: 0 },
    line_vat: { type: Number, required: true, default: 0 },
    line_total: { type: Number, required: true, default: 0 },

    // Discounts
    discounts: { type: [DiscountTierSchema], default: [] },
    total_discount_percent: { type: Number, default: 0 },

    // Promotion
    promo_id: { type: String },
    is_gift_line: { type: Boolean, default: false },
    gift_with_purchase: { type: String },

    // Product Snapshot
    name: { type: String, required: true },
    image_url: { type: String },
    brand: { type: String },
    category: { type: String },

    // Tracking
    added_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
    added_from: { type: String },
    added_via: { type: String },

    // Promo tracking
    promo_code: { type: String },
    promo_row: { type: Number },
    promo_label: { type: String },
    promo_discount_pct: { type: Number },
    promo_discount_amt: { type: Number },
    discount_chain: [{
      type: { type: String, enum: ["percentage", "amount", "net"] },
      value: { type: Number },
      source: { type: String, enum: ["price_list", "price_list_sale", "promo"] },
      order: { type: Number },
    }],

    // Raw source payload (auto-captured from request body)
    raw_data: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    // Identity
    order_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    order_number: { type: Number },
    cart_number: { type: Number }, // Sequential cart number per year
    year: { type: Number, required: true },
    status: {
      type: String,
      required: true,
      enum: ORDER_STATUSES,
      default: "draft",
      index: true,
    },
    is_current: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Tenant (multi-tenant support)
    tenant_id: { type: String, required: true, index: true },

    // Customer
    customer_id: { type: String, required: true, index: true },
    customer_code: { type: String },
    shipping_address_id: { type: String },
    shipping_address_code: { type: String }, // External address code for cart lookup
    billing_address_id: { type: String },

    // Delivery
    requested_delivery_date: { type: Date },
    delivery_slot: { type: String },
    delivery_route: { type: String },
    shipping_method: { type: String },
    requires_delivery: { type: Boolean, default: true },

    // Pricing Context
    price_list_id: { type: String, required: true, default: "default" },
    price_list_type: {
      type: String,
      required: true,
      enum: PRICE_LIST_TYPES,
      default: "wholesale",
    },
    order_type: {
      type: String,
      required: true,
      enum: ORDER_TYPES,
      default: "b2b",
    },
    currency: { type: String, required: true, default: "EUR" },
    pricelist_type: { type: String }, // External pricelist type (e.g., "VEND")
    pricelist_code: { type: String }, // External pricelist code (e.g., "02")

    // Totals
    subtotal_gross: { type: Number, required: true, default: 0 },
    subtotal_net: { type: Number, required: true, default: 0 },
    total_discount: { type: Number, required: true, default: 0 },
    total_vat: { type: Number, required: true, default: 0 },
    shipping_cost: { type: Number, required: true, default: 0 },
    order_total: { type: Number, required: true, default: 0 },

    // B2B Fields
    po_reference: { type: String },
    cost_center: { type: String },
    notes: { type: String },
    internal_notes: { type: String },

    // Timestamps (handled by mongoose)
    confirmed_at: { type: Date },

    // Tracking
    session_id: { type: String, required: true },
    flow_id: { type: String, required: true },
    source: {
      type: String,
      enum: ORDER_SOURCES,
      default: "web",
    },

    // Items
    items: { type: [LineItemSchema], default: [] },

    // ============================================
    // Quotation Data
    // ============================================
    quotation: { type: QuotationDataSchema },

    // Cart-level discounts
    cart_discounts: { type: [CartDiscountSchema], default: [] },

    // Line-level adjustments
    line_adjustments: { type: [LineAdjustmentSchema], default: [] },

    // ============================================
    // Payment Tracking
    // ============================================
    payment: { type: PaymentDataSchema },

    // ============================================
    // Delivery Tracking
    // ============================================
    delivery: { type: DeliveryDataSchema },

    // ============================================
    // Customer Tags (resolved at cart creation for audit/pricing)
    // ============================================
    effective_tags: { type: [String], default: [] },

    // ============================================
    // Duplication Tracking
    // ============================================
    duplicated_from: { type: String },
    duplicated_at: { type: Date },
    duplications: { type: [String], default: [] },

    // ============================================
    // Lifecycle Timestamps
    // ============================================
    submitted_at: { type: Date },
    shipped_at: { type: Date },
    delivered_at: { type: Date },
    cancelled_at: { type: Date },
    cancelled_by: { type: String },
    cancellation_reason: { type: String },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// ============================================
// INDEXES
// ============================================

// Find active cart for customer
OrderSchema.index({ customer_id: 1, status: 1 });

// Cart per address (for multi-address support)
OrderSchema.index({ customer_id: 1, shipping_address_id: 1, status: 1 });

// Cart lookup by external codes (for cart/active endpoint)
OrderSchema.index({ customer_code: 1, shipping_address_code: 1, is_current: 1 });

// Unique order number per year (only when assigned)
OrderSchema.index(
  { order_number: 1, year: 1 },
  {
    unique: true,
    partialFilterExpression: { order_number: { $exists: true, $ne: null } },
  }
);

// Unique cart number per year (assigned on cart creation)
OrderSchema.index(
  { cart_number: 1, year: 1 },
  {
    unique: true,
    partialFilterExpression: { cart_number: { $exists: true, $ne: null } },
  }
);

// List by status with date sorting
OrderSchema.index({ status: 1, created_at: -1 });

// Find orders containing specific product
OrderSchema.index({ "items.entity_code": 1 });

// Quotation indexes
OrderSchema.index(
  { "quotation.quotation_number": 1 },
  {
    unique: true,
    partialFilterExpression: { "quotation.quotation_number": { $exists: true, $ne: null } },
  }
);
OrderSchema.index({ "quotation.quotation_status": 1 });
OrderSchema.index({ "quotation.valid_until": 1 }); // For expiration checks

// Find duplications
OrderSchema.index({ duplicated_from: 1 });

// Lifecycle date indexes
OrderSchema.index({ submitted_at: -1 });
OrderSchema.index({ shipped_at: -1 });
OrderSchema.index({ delivered_at: -1 });
OrderSchema.index({ cancelled_at: -1 });

// ============================================
// HELPER METHODS
// ============================================

/**
 * Recalculate all order totals based on line items, cart discounts, and line adjustments
 */
OrderSchema.methods.recalculateTotals = function (): void {
  const items = this.items as ILineItem[];
  const cartDiscounts = (this.cart_discounts || []) as ICartDiscount[];
  const lineAdjustments = (this.line_adjustments || []) as ILineAdjustment[];

  // Calculate base totals from line items
  let subtotalGross = items.reduce((sum, i) => sum + i.line_gross, 0);
  let subtotalNet = items.reduce((sum, i) => sum + i.line_net, 0);
  let totalVat = items.reduce((sum, i) => sum + i.line_vat, 0);

  // Apply line-level adjustments
  for (const adj of lineAdjustments) {
    const item = items.find((i) => i.line_number === adj.line_number);
    if (!item) continue;

    if (adj.type === "price_override") {
      // Price override: recalculate line with new price
      const priceDiff = (item.unit_price - adj.new_value) * item.quantity;
      subtotalNet -= priceDiff;
      totalVat -= priceDiff * (item.vat_rate / 100);
    } else if (adj.type === "discount_percentage") {
      // Percentage discount on line
      const lineDiscount = item.line_net * Math.abs(adj.new_value) / 100;
      subtotalNet -= lineDiscount;
      totalVat -= lineDiscount * (item.vat_rate / 100);
    } else if (adj.type === "discount_fixed") {
      // Fixed discount on line
      subtotalNet -= Math.abs(adj.new_value);
      totalVat -= Math.abs(adj.new_value) * (item.vat_rate / 100);
    }
  }

  // Apply cart-level discounts
  let cartDiscountTotal = 0;
  for (const discount of cartDiscounts) {
    if (discount.type === "percentage") {
      const discountAmount = subtotalNet * Math.abs(discount.value) / 100;
      cartDiscountTotal += discountAmount;
    } else if (discount.type === "fixed") {
      cartDiscountTotal += Math.abs(discount.value);
    }
  }

  // Apply cart discount proportionally to VAT
  if (cartDiscountTotal > 0 && subtotalNet > 0) {
    const avgVatRate = totalVat / subtotalNet;
    totalVat -= cartDiscountTotal * avgVatRate;
  }
  subtotalNet -= cartDiscountTotal;

  // Ensure non-negative values
  subtotalNet = Math.max(0, subtotalNet);
  totalVat = Math.max(0, totalVat);

  // Set final values
  this.subtotal_gross = Math.round(subtotalGross * 100) / 100;
  this.subtotal_net = Math.round(subtotalNet * 100) / 100;
  this.total_vat = Math.round(totalVat * 100) / 100;
  this.total_discount = Math.round((subtotalGross - subtotalNet) * 100) / 100;
  this.order_total = Math.round((subtotalNet + totalVat + this.shipping_cost) * 100) / 100;
};

// ============================================
// EXPORT
// ============================================

export { OrderSchema };

export const OrderModel =
  mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema);

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Recalculate order totals (standalone function for use outside model)
 * Accounts for cart discounts and line adjustments
 */
export function recalculateOrderTotals(order: IOrder): void {
  const items = order.items;
  const cartDiscounts = order.cart_discounts || [];
  const lineAdjustments = order.line_adjustments || [];

  // Calculate base totals from line items
  let subtotalGross = items.reduce((sum, i) => sum + i.line_gross, 0);
  let subtotalNet = items.reduce((sum, i) => sum + i.line_net, 0);
  let totalVat = items.reduce((sum, i) => sum + i.line_vat, 0);

  // Apply line-level adjustments
  for (const adj of lineAdjustments) {
    const item = items.find((i) => i.line_number === adj.line_number);
    if (!item) continue;

    if (adj.type === "price_override") {
      const priceDiff = (item.unit_price - adj.new_value) * item.quantity;
      subtotalNet -= priceDiff;
      totalVat -= priceDiff * (item.vat_rate / 100);
    } else if (adj.type === "discount_percentage") {
      const lineDiscount = item.line_net * Math.abs(adj.new_value) / 100;
      subtotalNet -= lineDiscount;
      totalVat -= lineDiscount * (item.vat_rate / 100);
    } else if (adj.type === "discount_fixed") {
      subtotalNet -= Math.abs(adj.new_value);
      totalVat -= Math.abs(adj.new_value) * (item.vat_rate / 100);
    }
  }

  // Apply cart-level discounts
  let cartDiscountTotal = 0;
  for (const discount of cartDiscounts) {
    if (discount.type === "percentage") {
      cartDiscountTotal += subtotalNet * Math.abs(discount.value) / 100;
    } else if (discount.type === "fixed") {
      cartDiscountTotal += Math.abs(discount.value);
    }
  }

  // Apply cart discount proportionally to VAT
  if (cartDiscountTotal > 0 && subtotalNet > 0) {
    const avgVatRate = totalVat / subtotalNet;
    totalVat -= cartDiscountTotal * avgVatRate;
  }
  subtotalNet -= cartDiscountTotal;

  // Ensure non-negative values
  subtotalNet = Math.max(0, subtotalNet);
  totalVat = Math.max(0, totalVat);

  // Set final values
  order.subtotal_gross = Math.round(subtotalGross * 100) / 100;
  order.subtotal_net = Math.round(subtotalNet * 100) / 100;
  order.total_vat = Math.round(totalVat * 100) / 100;
  order.total_discount = Math.round((subtotalGross - subtotalNet) * 100) / 100;
  order.order_total = Math.round((subtotalNet + totalVat + order.shipping_cost) * 100) / 100;
}

/**
 * Calculate line item totals
 */
export function calculateLineItemTotals(
  quantity: number,
  list_price: number,
  unit_price: number,
  vat_rate: number
): Pick<ILineItem, "line_gross" | "line_net" | "line_vat" | "line_total"> {
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
 * Get next line number (increment by 10)
 */
export function getNextLineNumber(items: ILineItem[]): number {
  if (!items || items.length === 0) return 10;
  const maxLine = Math.max(...items.map((i) => i.line_number));
  return maxLine + 10;
}

/**
 * Calculate total cart discount amount
 */
export function calculateCartDiscountTotal(
  subtotalNet: number,
  cartDiscounts: ICartDiscount[]
): number {
  let total = 0;
  for (const discount of cartDiscounts) {
    if (discount.type === "percentage") {
      total += subtotalNet * Math.abs(discount.value) / 100;
    } else if (discount.type === "fixed") {
      total += Math.abs(discount.value);
    }
  }
  return Math.round(total * 100) / 100;
}

/**
 * Check if quotation is expired
 */
export function isQuotationExpired(order: IOrder): boolean {
  if (!order.quotation?.valid_until) return false;
  return new Date() > new Date(order.quotation.valid_until);
}

/**
 * Get the effective unit price for a line item after adjustments
 */
export function getEffectiveUnitPrice(
  item: ILineItem,
  lineAdjustments: ILineAdjustment[]
): number {
  const adjustment = lineAdjustments.find(
    (adj) => adj.line_number === item.line_number
  );
  if (!adjustment) return item.unit_price;

  if (adjustment.type === "price_override") {
    return adjustment.new_value;
  } else if (adjustment.type === "discount_percentage") {
    return item.unit_price * (1 - Math.abs(adjustment.new_value) / 100);
  } else if (adjustment.type === "discount_fixed") {
    return item.unit_price - Math.abs(adjustment.new_value) / item.quantity;
  }
  return item.unit_price;
}

// ============================================
// SCHEMA EXPORTS (for composition)
// ============================================

export {
  CartDiscountSchema,
  LineAdjustmentSchema,
  QuotationRevisionSchema,
  QuotationDataSchema,
  PaymentRecordSchema,
  PaymentDataSchema,
  DeliveryDataSchema,
  DiscountTierSchema,
  LineItemSchema,
};
