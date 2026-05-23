/**
 * Resource Quotation Service
 *
 * Generalises VCS quotation creation from cruise-only to resource-agnostic.
 * A quotation is always an Order document with status="quotation".
 *
 * Two line modes:
 *   - "external": OC API call for cruise availability snapshot (no capacity held)
 *   - "bookable": VCS Departure/Booking hold (capacity decremented atomically)
 *
 * Design goal — "never lose the lead":
 *   OC failure → source_status="oc_unavailable", quotation still created.
 *   Hold failure → source_status="no_capacity", quotation still created.
 */

import mongoose from "mongoose";
import { nanoid } from "nanoid";
import { getModelRegistry } from "@/lib/db/model-registry";
import { convertToQuotation } from "@/lib/services/order-lifecycle.service";
import { holdBooking, cancelBooking } from "@/lib/services/booking.service";
import { getOCApiForTenant } from "@/lib/oc-api/client";

// ============================================
// INPUT TYPES
// ============================================

export interface CustomerInput {
  /** Full name — split into first_name / last_name on the order buyer */
  name: string;
  email: string;
  phone?: string;
}

interface ExternalLineInput {
  mode: "external";
  source: string;
  resource_type: string;
  label: string;
  /** Cruise-specific params for OC availability call */
  cruise: {
    oc_cruise_id: number;
    category: string;
    adults: number;
    children: number;
  };
  quantity?: number;
}

interface BookableLineInput {
  mode: "bookable";
  departure_id: string;
  resource_id: string;
  quantity: number;
  label: string;
}

export type ResourceLineInput = ExternalLineInput | BookableLineInput;

export interface CreateResourceQuotationInput {
  customer: CustomerInput;
  lines: ResourceLineInput[];
  /** Tenants days until quotation expires (default 30) */
  days_valid?: number;
  notes?: string;
}

// ============================================
// RESULT TYPES
// ============================================

export interface QuotationResult {
  order_id: string;
  quotation_number: string;
  public_token: string;
}

export interface ServiceResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

// ============================================
// HELPERS
// ============================================

/**
 * Split "Mario Rossi Bianchi" → first="Mario" last="Rossi Bianchi".
 * Single-word names: first=name, last="".
 */
function splitName(full: string): { first: string; last: string } {
  const idx = full.indexOf(" ");
  if (idx === -1) return { first: full, last: "" };
  return { first: full.slice(0, idx), last: full.slice(idx + 1) };
}

/** Coerce an OC monetary value (number or decimal string) to a number. */
function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Number.parseFloat(v);
  }
  return 0;
}

// ============================================
// CREATE RESOURCE QUOTATION
// ============================================

/**
 * Create a resource quotation order.
 *
 * @param tenantDb  Mongoose connection for the tenant database
 * @param tenantId  Tenant identifier string (e.g. "demo")
 * @param input     Quotation request payload
 */
export async function createResourceQuotation(
  tenantDb: mongoose.Connection,
  tenantId: string,
  input: CreateResourceQuotationInput
): Promise<ServiceResult<QuotationResult>> {
  const registry = getModelRegistry(tenantDb);
  const Order = registry.Order;

  const { first: firstName, last: lastName } = splitName(input.customer.name);
  const orderId = nanoid(12);
  const year = new Date().getFullYear();

  // Build line items — attempt OC/hold per line, degrade on failure
  const heldBookingIds: string[] = [];

  const items = await Promise.all(
    input.lines.map(async (line, idx) => {
      const qty = "quantity" in line ? (line.quantity ?? 1) : 1;
      const baseItem = {
        line_number: idx + 1,
        // Required schema fields — resource lines use label as name,
        // entity_code/sku are not applicable so we use a placeholder.
        entity_code: "resource_line",
        sku: "resource_line",
        name: line.label,
        quantity: qty,
        list_price: 0,
        unit_price: 0,
        vat_rate: 0,
        vat_included: false,
        line_gross: 0,
        line_net: 0,
        line_vat: 0,
        line_total: 0,
        is_gift_line: false,
        discounts: [],
        total_discount_percent: 0,
        product_source: "external" as const,
        added_at: new Date(),
        updated_at: new Date(),
      };

      if (line.mode === "external") {
        // Attempt OC availability snapshot. Persist a CUSTOMER-SAFE shape:
        // a structured price (NO commission) + an availability summary, with
        // operator-only fields (commission, fare price_code) under `operator`
        // so the customer projection strips them. Never persist the raw OC payload.
        try {
          const oc = getOCApiForTenant(tenantId);
          const avail = await oc.getCruiseAvailability({
            oc_cruise_id: line.cruise.oc_cruise_id,
            category: line.cruise.category,
            adults: line.cruise.adults,
            children: line.cruise.children,
          });

          const rawPrice = (avail.price ?? {}) as Record<string, unknown>;
          const perPax = Array.isArray(rawPrice.per_pax)
            ? (rawPrice.per_pax as Record<string, unknown>[]).map((p) => ({
                pax_no: p.pax_no,
                type: p.type,
                amount: toNum(p.amount),
              }))
            : [];
          const totalGross = toNum(rawPrice.total_gross);

          return {
            ...baseItem,
            resource_type: line.resource_type,
            source: line.source,
            unit_price: totalGross,
            line_gross: totalGross,
            line_net: totalGross,
            line_total: totalGross,
            quote_snapshot: {
              price: {
                currency: rawPrice.currency ?? "EUR",
                per_pax: perPax,
                total_gross: totalGross,
                taxes: toNum(rawPrice.taxes),
              },
              availability: {
                available: avail.available ?? null,
                cabins_available: avail.cabins_available ?? null,
                guarantees_available: avail.guarantees_available ?? null,
                checked_at: new Date().toISOString(),
                source_status: "ok",
              },
              // operator-only — stripped from the customer-safe projection
              operator: {
                commission: toNum(rawPrice.commission),
                price_code: avail.price_code ?? null,
              },
            },
          };
        } catch {
          // Degrade — never lose the lead
          return {
            ...baseItem,
            resource_type: line.resource_type,
            source: line.source,
            quote_snapshot: {
              availability: {
                source_status: "oc_unavailable",
                checked_at: new Date().toISOString(),
              },
            },
          };
        }
      }

      // Bookable mode — attempt departure hold
      // Use orderId as the customer_id placeholder for guest quotations
      // (no registered customer at quotation time)
      const holdResult = await holdBooking(tenantDb.name, tenantId, {
        departure_id: line.departure_id,
        resource_id: line.resource_id,
        customer_id: `guest:${orderId}`,
        quantity: line.quantity,
        order_id: orderId,
      });

      if (!holdResult.success || !holdResult.data) {
        // Degrade — no capacity
        return {
          ...baseItem,
          departure_id: line.departure_id,
          resource_id: line.resource_id,
          quote_snapshot: {
            availability: {
              source_status: "no_capacity",
            },
          },
        };
      }

      heldBookingIds.push(holdResult.data.booking_id);

      return {
        ...baseItem,
        departure_id: line.departure_id,
        resource_id: line.resource_id,
        booking_id: holdResult.data.booking_id,
        quote_snapshot: {
          availability: {
            source_status: "ok",
          },
        },
      };
    })
  );

  // Persist the draft order, then convert to quotation
  try {
    await Order.create({
      order_id: orderId,
      year,
      tenant_id: tenantId,
      status: "draft",
      is_current: true,
      order_type: "quote",
      currency: "EUR",
      price_decimals: 2,
      subtotal_gross: 0,
      subtotal_net: 0,
      total_discount: 0,
      total_vat: 0,
      order_total: 0,
      session_id: nanoid(12),
      flow_id: nanoid(8),
      buyer: {
        first_name: firstName,
        last_name: lastName,
        email: input.customer.email,
        phone: input.customer.phone ?? null,
        customer_type: "private",
        is_guest: true,
      },
      notes: input.notes,
      items,
    });

    const qResult = await convertToQuotation(tenantDb, orderId, "system", {
      daysValid: input.days_valid ?? 30,
      notes: input.notes,
    });

    if (!qResult.success || !qResult.order) {
      // Roll back holds
      if (heldBookingIds.length > 0) {
        await Promise.all(
          heldBookingIds.map((bId) => cancelBooking(tenantDb.name, tenantId, bId, "system", "quotation_creation_failed"))
        );
      }
      return { success: false, error: qResult.error ?? "Failed to convert to quotation", status: 500 };
    }

    // Assign public_token
    const publicToken = nanoid(20);
    await Order.updateOne({ order_id: orderId }, { $set: { public_token: publicToken } });

    const quotationNumber = qResult.order.quotation?.quotation_number ?? "";

    return {
      success: true,
      data: {
        order_id: orderId,
        quotation_number: quotationNumber,
        public_token: publicToken,
      },
    };
  } catch (err) {
    // Roll back holds on unexpected error
    if (heldBookingIds.length > 0) {
      await Promise.all(
        heldBookingIds.map((bId) => cancelBooking(tenantDb.name, tenantId, bId, "system", "quotation_creation_error"))
      );
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error",
      status: 500,
    };
  }
}

// ============================================
// GET BY TOKEN (customer-safe projection)
// ============================================

/**
 * Retrieve a quotation by its public_token and return a customer-safe view.
 * Strips all internal/commercial fields.
 */
export async function getResourceQuotationByToken(
  tenantDb: mongoose.Connection,
  token: string
): Promise<ServiceResult<Record<string, unknown>>> {
  const registry = getModelRegistry(tenantDb);
  const Order = registry.Order;

  const order = await Order.findOne({ public_token: token }).lean<Record<string, unknown>>();
  if (!order) {
    return { success: false, error: "Quotation not found", status: 404 };
  }

  return { success: true, data: toCustomerSafeQuotation(order) };
}

// ============================================
// CUSTOMER-SAFE PROJECTION
// ============================================

const SENSITIVE_ROOT_FIELDS = new Set([
  "commission",
  "internal_notes",
  "raw_data",
  "erp_data",
  "customer_id",
  "payment",
  "cost",
  "net",
  "list_price",
]);

const SENSITIVE_LINE_FIELDS = new Set([
  "commission",
  "raw_data",
  "erp_data",
  "list_price",
  "cost",
  "net",
  "internal_notes",
]);

/**
 * Strip all internal/commercial fields from an Order document.
 * Returns a plain object safe to return to unauthenticated customers.
 *
 * Flattens quotation sub-doc fields (quotation_number, quotation_status,
 * valid_until) to the top level for convenience.
 */
export function toCustomerSafeQuotation(
  order: Record<string, unknown>
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(order)) {
    if (SENSITIVE_ROOT_FIELDS.has(k)) continue;
    if (k === "items") {
      safe["lines"] = Array.isArray(v) ? v.map(sanitizeLine) : [];
      continue;
    }
    if (k === "quotation" && typeof v === "object" && v !== null) {
      // Flatten customer-visible quotation fields to root level
      const q = v as Record<string, unknown>;
      safe["quotation_number"] = q.quotation_number;
      safe["quotation_status"] = q.quotation_status;
      safe["valid_until"] = q.valid_until;
      // Keep the full quotation object too for completeness
      safe[k] = v;
      continue;
    }
    safe[k] = v;
  }

  return safe;
}

function sanitizeLine(line: unknown): Record<string, unknown> {
  if (typeof line !== "object" || line === null) return {};

  const safeItem: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(line as Record<string, unknown>)) {
    if (SENSITIVE_LINE_FIELDS.has(k)) continue;
    if (k === "quote_snapshot") {
      safeItem[k] = sanitizeQuoteSnapshot(v);
      continue;
    }
    safeItem[k] = v;
  }
  return safeItem;
}

function sanitizeQuoteSnapshot(snap: unknown): unknown {
  if (typeof snap !== "object" || snap === null) return snap;

  const s = snap as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) {
    // Drop operator-only fields (commission, fare price_code) and any raw
    // upstream payload — never expose these to customers.
    if (k === "operator" || k === "raw") continue;
    out[k] = v;
  }

  // Defensively strip commercial fields from the price block.
  if (typeof out.price === "object" && out.price !== null) {
    const price = { ...(out.price as Record<string, unknown>) };
    delete price.commission;
    delete price.net;
    delete price.cost;
    out.price = price;
  }

  return out;
}
