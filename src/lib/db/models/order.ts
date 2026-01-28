import mongoose, { Schema, Document } from "mongoose";
import type { DiscountStep } from "@/lib/types/pim";

/**
 * Order Model
 *
 * Unified order document where status: "draft" represents a cart.
 * Same document evolves: draft → pending → confirmed → shipped
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
  reason?: "customer_group" | "quantity" | "promo" | "manual";
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

export interface IOrder extends Document {
  // Identity
  order_id: string;
  order_number?: number;
  cart_number?: number; // Sequential cart number per year (assigned on cart creation)
  year: number;
  status: "draft" | "pending" | "confirmed" | "shipped" | "cancelled";
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

  // Pricing Context
  price_list_id: string;
  price_list_type: "retail" | "wholesale" | "promo";
  order_type: "b2b" | "b2c" | "quote" | "sample";
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
  source?: "web" | "mobile" | "api" | "import";

  // Items
  items: ILineItem[];
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
      enum: ["customer_group", "quantity", "promo", "manual"],
    },
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
      enum: ["draft", "pending", "confirmed", "shipped", "cancelled"],
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

    // Pricing Context
    price_list_id: { type: String, required: true, default: "default" },
    price_list_type: {
      type: String,
      required: true,
      enum: ["retail", "wholesale", "promo"],
      default: "wholesale",
    },
    order_type: {
      type: String,
      required: true,
      enum: ["b2b", "b2c", "quote", "sample"],
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
      enum: ["web", "mobile", "api", "import"],
      default: "web",
    },

    // Items
    items: { type: [LineItemSchema], default: [] },
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

// ============================================
// HELPER METHODS
// ============================================

/**
 * Recalculate all order totals based on line items
 */
OrderSchema.methods.recalculateTotals = function (): void {
  const items = this.items as ILineItem[];

  this.subtotal_gross = items.reduce((sum, i) => sum + i.line_gross, 0);
  this.subtotal_net = items.reduce((sum, i) => sum + i.line_net, 0);
  this.total_vat = items.reduce((sum, i) => sum + i.line_vat, 0);
  this.total_discount = this.subtotal_gross - this.subtotal_net;
  this.order_total = this.subtotal_net + this.total_vat + this.shipping_cost;

  // Round to 2 decimal places
  this.subtotal_gross = Math.round(this.subtotal_gross * 100) / 100;
  this.subtotal_net = Math.round(this.subtotal_net * 100) / 100;
  this.total_vat = Math.round(this.total_vat * 100) / 100;
  this.total_discount = Math.round(this.total_discount * 100) / 100;
  this.order_total = Math.round(this.order_total * 100) / 100;
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
 */
export function recalculateOrderTotals(order: IOrder): void {
  const items = order.items;

  order.subtotal_gross = items.reduce((sum, i) => sum + i.line_gross, 0);
  order.subtotal_net = items.reduce((sum, i) => sum + i.line_net, 0);
  order.total_vat = items.reduce((sum, i) => sum + i.line_vat, 0);
  order.total_discount = order.subtotal_gross - order.subtotal_net;
  order.order_total = order.subtotal_net + order.total_vat + order.shipping_cost;

  // Round to 2 decimal places
  order.subtotal_gross = Math.round(order.subtotal_gross * 100) / 100;
  order.subtotal_net = Math.round(order.subtotal_net * 100) / 100;
  order.total_vat = Math.round(order.total_vat * 100) / 100;
  order.total_discount = Math.round(order.total_discount * 100) / 100;
  order.order_total = Math.round(order.order_total * 100) / 100;
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
