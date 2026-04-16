/**
 * POST /api/b2b/cart/import
 *
 * Bulk-imports carts from an external source (legacy ERP, data migration,
 * another commerce platform) as VINC draft orders. The cart header and
 * items are baked into a single OrderModel.create(...) per cart so the
 * caller doesn't need to make separate /cart/active + /items calls.
 *
 * ## Why a dedicated endpoint
 *
 * Unlike POST /cart/active, this endpoint DOES NOT fire the cart.create
 * Windmill hook. For tenants that wire cart.create/on to allocate a fresh
 * ERP cart (e.g. DFL's on_cart_create.ts which calls GetNewIdCarrello),
 * going through /cart/active for a migration would mint a phantom empty
 * ERP cart for every imported row. /cart/import sidesteps that entirely:
 * the caller already knows the external cart id (e.g. the legacy
 * id_carrello) and wants VINC to adopt it as-is.
 *
 * ## Request
 *
 * ```
 * {
 *   source_id: "bms-sync-dfl",
 *   batch_id?: "legacy-carts-2026-04-14-part1",
 *   merge_mode?: "skip" | "error",   // default "skip"
 *   carts: CartImportItem[]
 * }
 * ```
 *
 * See the `CartImportItem` interface below for the per-cart shape.
 *
 * ## Semantics
 *
 * - Customer lookup: `customer_code` → `Customer.external_code`. Missing → orphan.
 * - Address lookup: exact `address_code` match on the customer's embedded
 *   addresses[]. Fallback to the customer's default delivery address if no
 *   exact match. Missing → orphan.
 * - Idempotency: keyed on `erp_cart_id === external_cart_id`. Re-imports
 *   return `{ status: "skipped", reason: "already_exists" }` under
 *   merge_mode=skip.
 * - Cart parking: when `park_existing_current !== false` AND the imported
 *   cart is marked `is_current: true` (default) AND there's already an
 *   is_current=true draft for the same (customer_code, shipping_address_code)
 *   pair, that existing draft is parked (is_current=false + cart_name =
 *   "Legacy <prev_erp_cart_id> (<YYYY-MM-DD>)"). This lets the caller
 *   import a user's full cart history — newest becomes current, older
 *   ones become parked.
 * - Zero hook dispatch: no cart.create, no item.add, no runAfterHook.
 *   Submit-time hooks (order.submit/before, etc.) fire normally when the
 *   user eventually submits the imported cart.
 */

import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { getNextCartNumber } from "@/lib/db/models/counter";
import { calculateLineItemTotals } from "@/lib/db/models/order";
import { DEFAULT_CHANNEL } from "@/lib/constants/channel";
import { resolveEffectiveTags } from "@/lib/services/tag-pricing.service";
import { saveOrder } from "@/lib/services/order.service";

// ─────────────────────────────────────────────────────────────────────
// Request / response types
// ─────────────────────────────────────────────────────────────────────

interface CartImportItemLine {
  entity_code: string;
  sku: string;
  name: string;
  quantity: number;
  list_price: number;
  unit_price: number;
  vat_rate: number;
  vat_included?: boolean;
  product_source?: "pim" | "external" | "manual";
  image_url?: string;
  brand?: string;
  quantity_unit?: string;
  min_order_quantity?: number;
  // Packaging (from PIM packaging_options) — carrying these through prevents
  // pack_size enforcement from being dropped at submit time
  pkg_id?: string;
  packaging_code?: string;
  packaging_label?: string;
  pack_size?: number;
  promo_price?: number;
  promo_code?: string;
  promo_row?: number;
  // Promo goal projection — used by recalculatePromoProgress to aggregate
  // cart-level progress (promo_progress[]). The caller should resolve the
  // goal from the authoritative promo source (e.g. DFL's GetPrezzaturaMultipla)
  // and pass the translated values here.
  promo_goal_type?: "value" | "quantity" | "line_count";
  promo_goal_value?: number;
  promo_goal_label?: string;
  promo_start_date?: string;
  promo_end_date?: string;
  promo_reward_type?: "extra_discount" | "fixed_price" | "gift";
  promo_reward_gift_code?: string;
  promo_reward_gift_quantity?: number;
  discounts?: Array<{ tier: number; type: "percentage"; value: number }>;
  // Persisted verbatim as line_item.raw_data — read by vinc-b2b's
  // cart-adapter to render the UM/MV/CF packaging grid and hydrate other
  // ERP-adjacent display data. Safe to pass whatever the caller needs.
  raw_data?: Record<string, unknown>;
}

interface CartImportItem {
  external_cart_id: string | number;
  customer_code: string;
  address_code: string;
  pricelist_type?: string;
  pricelist_code?: string;
  price_decimals?: number;
  channel?: string;
  notes?: string;
  requested_delivery_date?: string;
  delivery_slot?: string;
  delivery_route?: string;
  created_at?: string;
  items: CartImportItemLine[];
  park_existing_current?: boolean;
  parked_cart_name?: string;
  is_current?: boolean;
  cart_name?: string;
  legacy_source?: string;
  // Pre-fetched ERP delivery metadata (shipping_cost, codice_giro_consegna,
  // codice_punto_vendita, first_deliverable_day, days_no_delivery, etc.).
  // The caller is responsible for fetching this from the ERP (or any
  // other authoritative source) so the import endpoint doesn't need to
  // fire a cart.create Windmill hook at insert time. Stored verbatim in
  // `erp_data.delivery_info`.
  delivery_info?: Record<string, unknown>;
}

interface CartImportRequest {
  source_id: string;
  batch_id?: string;
  merge_mode?: "skip" | "error";
  carts: CartImportItem[];
}

type CartImportStatus =
  | "imported"
  | "skipped"
  | "orphan"
  | "failed";

interface CartImportResult {
  external_cart_id: string | number;
  status: CartImportStatus;
  order_id?: string;
  parked_cart_id?: string;
  reason?: string;
}

const MAX_BATCH_SIZE = 500;

// ─────────────────────────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;
    const { tenantId, tenantDb } = auth;

    const body = (await req.json()) as CartImportRequest;

    if (!body?.source_id) {
      return NextResponse.json(
        { error: "source_id is required" },
        { status: 400 },
      );
    }
    if (!Array.isArray(body.carts) || body.carts.length === 0) {
      return NextResponse.json(
        { error: "carts must be a non-empty array" },
        { status: 400 },
      );
    }
    if (body.carts.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        {
          error: `Batch too large: ${body.carts.length} > max ${MAX_BATCH_SIZE}`,
        },
        { status: 400 },
      );
    }

    const mergeMode = body.merge_mode ?? "skip";
    const { Order: OrderModel, Customer: CustomerModel } =
      await connectWithModels(tenantDb);

    const results: CartImportResult[] = [];
    let imported = 0;
    let skippedIdempotent = 0;
    let orphans = 0;
    let failed = 0;

    for (const cart of body.carts) {
      try {
        const result = await importSingleCart(
          cart,
          body,
          mergeMode,
          tenantId,
          tenantDb,
          OrderModel,
          CustomerModel,
        );
        results.push(result);
        if (result.status === "imported") imported++;
        else if (result.status === "skipped") skippedIdempotent++;
        else if (result.status === "orphan") orphans++;
        else if (result.status === "failed") failed++;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        console.error(
          `[cart/import] cart ${cart.external_cart_id} failed:`,
          err,
        );
        results.push({
          external_cart_id: cart.external_cart_id,
          status: "failed",
          reason: message,
        });
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      source_id: body.source_id,
      batch_id: body.batch_id,
      summary: {
        total: body.carts.length,
        imported,
        skipped_idempotent: skippedIdempotent,
        orphans,
        failed,
      },
      results,
    });
  } catch (error) {
    console.error("[cart/import] fatal error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// Per-cart importer
// ─────────────────────────────────────────────────────────────────────

async function importSingleCart(
  cart: CartImportItem,
  batch: CartImportRequest,
  mergeMode: "skip" | "error",
  tenantId: string,
  tenantDb: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  OrderModel: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CustomerModel: any,
): Promise<CartImportResult> {
  // Validation
  if (!cart.external_cart_id && cart.external_cart_id !== 0) {
    return {
      external_cart_id: cart.external_cart_id,
      status: "failed",
      reason: "external_cart_id is required",
    };
  }
  if (!cart.customer_code) {
    return {
      external_cart_id: cart.external_cart_id,
      status: "failed",
      reason: "customer_code is required",
    };
  }
  if (!cart.address_code) {
    return {
      external_cart_id: cart.external_cart_id,
      status: "failed",
      reason: "address_code is required",
    };
  }
  if (!Array.isArray(cart.items) || cart.items.length === 0) {
    return {
      external_cart_id: cart.external_cart_id,
      status: "failed",
      reason: "items must be a non-empty array",
    };
  }

  // 1. Idempotency check on erp_cart_id
  const existingByErp = await OrderModel.findOne({
    tenant_id: tenantId,
    erp_cart_id: cart.external_cart_id,
  }).lean();

  if (existingByErp) {
    if (mergeMode === "skip") {
      return {
        external_cart_id: cart.external_cart_id,
        status: "skipped",
        order_id: existingByErp.order_id,
        reason: "already_exists",
      };
    }
    // merge_mode === "error"
    return {
      external_cart_id: cart.external_cart_id,
      status: "failed",
      reason: `cart with erp_cart_id=${cart.external_cart_id} already exists`,
    };
  }

  // 2. Resolve customer + address
  const customer = await CustomerModel.findOne({
    tenant_id: tenantId,
    external_code: cart.customer_code,
  });
  if (!customer) {
    return {
      external_cart_id: cart.external_cart_id,
      status: "orphan",
      reason: "customer_not_found",
    };
  }

  const addresses = customer.addresses ?? [];
  let address = addresses.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (a: any) => a.external_code === cart.address_code,
  );
  if (!address) {
    // Soft fallback: default delivery or first delivery address
    address =
      addresses.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (a: any) =>
          a.is_default &&
          (a.address_type === "delivery" || a.address_type === "both"),
      ) ??
      addresses.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (a: any) =>
          a.address_type === "delivery" || a.address_type === "both",
      );
  }
  if (!address) {
    return {
      external_cart_id: cart.external_cart_id,
      status: "orphan",
      reason: "address_not_found",
    };
  }

  // 3. Optionally park the existing is_current cart for this pair
  const isCurrent = cart.is_current !== false;
  const parkExisting = cart.park_existing_current !== false;
  let parkedCartId: string | undefined;

  if (isCurrent && parkExisting) {
    const existingCurrent = await OrderModel.findOne({
      tenant_id: tenantId,
      customer_code: cart.customer_code,
      shipping_address_code: address.external_code,
      status: "draft",
      is_current: true,
    });
    if (existingCurrent) {
      const dateStr = new Date().toISOString().slice(0, 10);
      const parkName =
        cart.parked_cart_name ??
        `Legacy ${existingCurrent.erp_cart_id ?? existingCurrent.order_id} (${dateStr})`;
      existingCurrent.is_current = false;
      existingCurrent.cart_name = parkName;
      await existingCurrent.save();
      parkedCartId = existingCurrent.order_id;
    }
  }

  // 4. Build line items with computed totals
  const priceDecimals = cart.price_decimals ?? 2;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineItems: any[] = [];
  let lineNumber = 10;
  let subtotalGross = 0;
  let subtotalNet = 0;
  let totalVat = 0;
  let orderTotal = 0;

  for (const raw of cart.items) {
    const totals = calculateLineItemTotals(
      raw.quantity,
      raw.list_price,
      raw.unit_price,
      raw.vat_rate,
      raw.vat_included ?? false,
      priceDecimals,
    );
    subtotalGross += totals.line_gross;
    subtotalNet += totals.line_net;
    totalVat += totals.line_vat;
    orderTotal += totals.line_total;

    // Compound the discount chain into a single total_discount_percent —
    // mirrors the logic in order.service.ts:createLineItem. e.g. tiers
    // [-50, -20] → remaining = 100 * 0.5 * 0.8 = 40 → total = 60%.
    let totalDiscountPercent = 0;
    const discounts = raw.discounts ?? [];
    if (discounts.length > 0) {
      let remaining = 100;
      for (const d of [...discounts].sort((a, b) => a.tier - b.tier)) {
        if (d.type === "percentage") {
          remaining = remaining * (1 + d.value / 100);
        }
      }
      totalDiscountPercent = Math.round((100 - remaining) * 100) / 100;
    }

    lineItems.push({
      line_number: lineNumber,
      entity_code: raw.entity_code,
      sku: raw.sku,
      name: raw.name,
      quantity: raw.quantity,
      list_price: raw.list_price,
      unit_price: raw.unit_price,
      vat_rate: raw.vat_rate,
      vat_included: raw.vat_included ?? false,
      product_source: raw.product_source ?? "pim",
      image_url: raw.image_url,
      brand: raw.brand,
      quantity_unit: raw.quantity_unit,
      min_order_quantity: raw.min_order_quantity,
      pkg_id: raw.pkg_id,
      packaging_code: raw.packaging_code,
      packaging_label: raw.packaging_label,
      pack_size: raw.pack_size,
      promo_price: raw.promo_price,
      promo_code: raw.promo_code,
      promo_row: raw.promo_row,
      promo_goal_type: raw.promo_goal_type,
      promo_goal_value: raw.promo_goal_value,
      promo_goal_label: raw.promo_goal_label,
      promo_start_date: raw.promo_start_date,
      promo_end_date: raw.promo_end_date,
      promo_reward_type: raw.promo_reward_type,
      promo_reward_gift_code: raw.promo_reward_gift_code,
      promo_reward_gift_quantity: raw.promo_reward_gift_quantity,
      discounts,
      total_discount_percent: totalDiscountPercent,
      line_gross: totals.line_gross,
      line_net: totals.line_net,
      line_vat: totals.line_vat,
      line_total: totals.line_total,
      raw_data: raw.raw_data,
      added_at: new Date(),
      updated_at: new Date(),
    });
    lineNumber += 10;
  }

  // 5. Build the Order document and insert
  const order_id = nanoid(12);
  const year = new Date().getFullYear();
  const cart_number = await getNextCartNumber(tenantDb, year);
  const effectiveTags = resolveEffectiveTags(customer, address);

  const channel =
    cart.channel ||
    (customer as { channel?: string }).channel ||
    DEFAULT_CHANNEL;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: Record<string, any> = {
    order_id,
    cart_number,
    year,
    status: "draft",
    is_current: isCurrent,
    tenant_id: tenantId,
    customer_id: customer.customer_id,
    customer_code: cart.customer_code,
    shipping_address_id: address.address_id,
    shipping_address_code: address.external_code,
    effective_tags: effectiveTags,
    price_list_id: "default",
    price_list_type: "wholesale",
    order_type: "b2b",
    currency: "EUR",
    pricelist_type: cart.pricelist_type,
    pricelist_code: cart.pricelist_code,
    price_decimals: priceDecimals,
    subtotal_gross: round2(subtotalGross),
    subtotal_net: round2(subtotalNet),
    total_discount: 0,
    total_vat: round2(totalVat),
    shipping_cost: 0,
    order_total: round2(orderTotal),
    session_id: `sess_${nanoid(16)}`,
    flow_id: `flow_${nanoid(16)}`,
    source: "import",
    channel,
    items: lineItems,
    // Legacy traceability
    erp_cart_id: cart.external_cart_id,
    erp_data: {
      erp_cart_id: cart.external_cart_id,
      legacy_source: cart.legacy_source ?? batch.source_id,
      legacy_batch_id: batch.batch_id,
      legacy_imported_at: new Date().toISOString(),
      legacy_created_at: cart.created_at,
      // Pre-fetched by the caller (e.g. time-to-pim sync) via direct
      // ERP WCF calls — written verbatim so the storefront/cart-adapter
      // has shipping_cost, first_deliverable_day, days_no_delivery, etc.
      // without needing to fire cart.create at import time.
      ...(cart.delivery_info ? { delivery_info: cart.delivery_info } : {}),
    },
  };

  if (cart.notes) doc.notes = cart.notes;
  if (cart.requested_delivery_date) {
    doc.requested_delivery_date = new Date(cart.requested_delivery_date);
  }
  if (cart.delivery_slot) doc.delivery_slot = cart.delivery_slot;
  if (cart.delivery_route) doc.delivery_route = cart.delivery_route;
  if (!isCurrent && cart.cart_name) doc.cart_name = cart.cart_name;

  let newOrder;
  try {
    newOrder = await OrderModel.create(doc);
    // Run the full saveOrder pipeline so the imported cart lands in the
    // same state a normal cart reaches after the first edit:
    //   1. recalculateOrderTotals — rolls up line totals (no-op here since
    //      the per-line values were already computed above; only matters
    //      when enforcePromoGifts adds a gift row which we need totals for).
    //   2. recalculatePromoProgress — aggregates per-line promo_goal_* into
    //      cart-level promo_progress[] so ProductPromoAction.vue's progress
    //      widgets render immediately.
    //   3. enforcePromoGifts — for any reached promo with reward_type=gift,
    //      adds a matching omaggio line. Without this, the gift only
    //      materializes after the user edits one line in the cart UI.
    try {
      await saveOrder(newOrder);
    } catch (progressErr) {
      console.error(
        "[cart/import] saveOrder (post-create) failed for",
        cart.external_cart_id,
        progressErr,
      );
    }
  } catch (createErr) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((createErr as any).code === 11000) {
      // Duplicate key — a concurrent import already created this cart.
      // Re-check by erp_cart_id and return the winner as skipped.
      const winner = await OrderModel.findOne({
        tenant_id: tenantId,
        erp_cart_id: cart.external_cart_id,
      }).lean();
      if (winner) {
        return {
          external_cart_id: cart.external_cart_id,
          status: "skipped",
          order_id: winner.order_id,
          parked_cart_id: parkedCartId,
          reason: "duplicate_key",
        };
      }
    }
    throw createErr;
  }

  return {
    external_cart_id: cart.external_cart_id,
    status: "imported",
    order_id: newOrder.order_id,
    parked_cart_id: parkedCartId,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
