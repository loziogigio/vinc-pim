import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { getNextCartNumber } from "@/lib/db/models/counter";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";
import { nanoid } from "nanoid";
import {
  findOrCreateCustomer,
  findOrCreateAddress,
  CustomerInput,
  AddressInput,
} from "@/lib/services/customer.service";
import { DEFAULT_CHANNEL } from "@/lib/constants/channel";
import { resolveEffectiveTags } from "@/lib/services/tag-pricing.service";
import { buildHookCtxFromOrder, runOnHook, runAfterHook, mergeOrderErpData } from "@/lib/services/windmill-proxy.service";

/**
 * Authenticate and get tenant ID
 * Returns tenant-specific models from connection pool
 */
async function authenticateRequest(req: NextRequest): Promise<{
  authenticated: boolean;
  tenantId?: string;
  tenantDb?: string;
  models?: Awaited<ReturnType<typeof connectWithModels>>;
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

  // Get tenant-specific models from connection pool
  const models = await connectWithModels(tenantDb);

  return { authenticated: true, tenantId, tenantDb, models };
}

/**
 * POST /api/b2b/cart/active
 *
 * API KEY or SESSION authentication required.
 * Designed for ERP/external system integration via API keys.
 *
 * Find current cart by external codes (customer_code + address_code), or create new one.
 * Supports lookup-or-create for customer and address if details are provided.
 *
 * Cart Identification:
 * - status: "draft" = cart (lifecycle stage)
 * - is_current: true = the current working cart (only ONE per customer+address)
 * - Multiple draft carts allowed, but only one with is_current: true
 *
 * Request Body:
 * - customer_code: REQUIRED - External customer code for cart lookup
 * - address_code: REQUIRED - External address code for cart lookup
 * - customer?: Optional customer details for create if not found
 * - address?: Optional address details for create if not found
 * - pricelist_type?: External pricelist type (e.g., "VEND")
 * - pricelist_code?: External pricelist code (e.g., "02")
 */

interface CartActiveRequest {
  // REQUIRED: External codes for cart lookup
  customer_code: string;
  address_code: string;

  // Optional: customer details for create if not found
  customer?: CustomerInput;

  // Optional: address details for create if not found
  address?: AddressInput;

  // Optional: pricelist context
  pricelist_type?: string;
  pricelist_code?: string;

  // Optional: price rounding precision (default 2)
  price_decimals?: number;

  // Optional: sales channel override (e.g., "b2b")
  channel?: string;
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate and get tenant
    const auth = await authenticateRequest(req);
    if (!auth.authenticated || !auth.models) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode });
    }
    const tenant_id = auth.tenantId!;
    const { Order: OrderModel } = auth.models;

    const body: CartActiveRequest = await req.json();

    // Validate required fields
    if (!body.customer_code) {
      return NextResponse.json(
        { error: "customer_code is required" },
        { status: 400 }
      );
    }
    if (!body.address_code) {
      return NextResponse.json(
        { error: "address_code is required" },
        { status: 400 }
      );
    }

    // 1. Try to find existing current cart by external codes (with tenant filter)
    // Use findOneAndUpdate to atomically mark it as "found" to prevent race conditions
    const existingCart = await OrderModel.findOneAndUpdate(
      {
        tenant_id,
        customer_code: body.customer_code,
        shipping_address_code: body.address_code,
        status: "draft",
        is_current: true,
      },
      { $set: { last_accessed_at: new Date() } },
      { new: true },
    );

    if (existingCart) {
      // Return existing current cart
      return NextResponse.json({
        success: true,
        cart_id: existingCart.order_id,
        order_id: existingCart.order_id,
        cart_number: existingCart.cart_number,
        year: existingCart.year,
        is_new: false,
        customer: {
          customer_id: existingCart.customer_id,
          customer_code: existingCart.customer_code,
          public_code: existingCart.public_code,
          is_new: false,
        },
        address: {
          address_id: existingCart.shipping_address_id,
          address_code: existingCart.shipping_address_code,
          is_new: false,
        },
        order: existingCart,
      });
    }

    // 2. No current cart found - need to lookup/create customer and address

    // 2a. Find or create customer
    let customer;
    let customerIsNew = false;
    try {
      // First try to find by customer_code
      const result = await findOrCreateCustomer(tenant_id, {
        customer_code: body.customer_code,
        customer: body.customer
          ? {
              ...body.customer,
              external_code: body.customer_code, // Ensure external_code matches
            }
          : undefined,
      });
      customer = result.customer;
      customerIsNew = result.isNew;
    } catch (err) {
      // Customer not found or creation failed
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        {
          error: `Customer error for ${body.customer_code}: ${message}`,
        },
        { status: 400 }
      );
    }

    // 2b. Find or create address
    let address;
    let addressIsNew = false;
    try {
      // Try to find address by external_code
      address = customer.addresses.find(
        (a) => a.external_code === body.address_code
      );

      if (!address) {
        // Address not found, try to create if details provided
        if (body.address) {
          address = await findOrCreateAddress(customer, {
            address: {
              ...body.address,
              external_code: body.address_code, // Ensure external_code matches
            },
          }, tenant_id);
          addressIsNew = true;
        } else {
          // No address details - return error
          return NextResponse.json(
            {
              error: `Address not found and no details provided to create: ${body.address_code}`,
            },
            { status: 400 }
          );
        }
      }
    } catch {
      return NextResponse.json(
        {
          error: `Failed to find or create address: ${body.address_code}`,
        },
        { status: 400 }
      );
    }

    // 3. Resolve effective tags for customer + delivery address
    const effectiveTags = resolveEffectiveTags(customer, address);

    // 4. Create new current cart
    const order_id = nanoid(12);
    const session_id = `sess_${nanoid(16)}`;
    const flow_id = `flow_${nanoid(16)}`;
    const year = new Date().getFullYear();
    const cart_number = await getNextCartNumber(auth.tenantDb!, year);

    // Race condition guard: re-check before creating (another request may have created one)
    const raceCheck = await OrderModel.findOne({
      tenant_id,
      customer_code: body.customer_code,
      shipping_address_code: body.address_code,
      status: "draft",
      is_current: true,
    });
    if (raceCheck) {
      return NextResponse.json({
        success: true,
        cart_id: raceCheck.order_id,
        order_id: raceCheck.order_id,
        cart_number: raceCheck.cart_number,
        year: raceCheck.year,
        is_new: false,
        customer: {
          customer_id: customer.customer_id,
          customer_code: body.customer_code,
          public_code: customer.public_code,
          is_new: false,
        },
        address: {
          address_id: address.address_id,
          address_code: body.address_code,
          is_new: false,
        },
        order: raceCheck,
      });
    }

    let newCart;
    try {
    newCart = await OrderModel.create({
      order_id,
      cart_number, // Sequential cart number per year
      year,
      status: "draft", // Cart is a draft order
      is_current: true, // This is the current working cart

      // Tenant
      tenant_id,

      // Customer (internal + external codes)
      customer_id: customer.customer_id,
      customer_code: body.customer_code,
      shipping_address_id: address.address_id,
      shipping_address_code: body.address_code,

      // Customer tags (resolved for this customer + delivery address)
      effective_tags: effectiveTags,

      // Pricing Context
      price_list_id: "default",
      price_list_type: "wholesale",
      order_type: "b2b",
      currency: "EUR",
      pricelist_type: body.pricelist_type,
      pricelist_code: body.pricelist_code,
      price_decimals: body.price_decimals ?? 2,

      // Totals (all 0 initially)
      subtotal_gross: 0,
      subtotal_net: 0,
      total_discount: 0,
      total_vat: 0,
      shipping_cost: 0,
      order_total: 0,

      // Tracking
      session_id,
      flow_id,
      source: "web",
      channel: body.channel || (customer as { channel?: string }).channel || DEFAULT_CHANNEL,

      // Items (empty)
      items: [],
    });
    } catch (createErr: any) {
      // Duplicate key = race condition — another request created the cart first
      if (createErr.code === 11000) {
        const winner = await OrderModel.findOne({
          tenant_id,
          customer_code: body.customer_code,
          shipping_address_code: body.address_code,
          status: "draft",
          is_current: true,
        });
        if (winner) {
          return NextResponse.json({
            success: true,
            cart_id: winner.order_id,
            order_id: winner.order_id,
            cart_number: winner.cart_number,
            year: winner.year,
            is_new: false,
            customer: {
              customer_id: customer.customer_id,
              customer_code: body.customer_code,
              public_code: customer.public_code,
              is_new: false,
            },
            address: {
              address_id: address.address_id,
              address_code: body.address_code,
              is_new: false,
            },
            order: winner,
          });
        }
      }
      throw createErr;
    }

    // ── HOOK: cart.create on-hook (ERP cart creation + delivery info) ──
    // Try sync with a short timeout (3s). If Windmill responds in time,
    // delivery info is included in the response. If it times out,
    // return the cart immediately — frontend falls back to legacy wrapper.
    const hookCtx = buildHookCtxFromOrder(auth.tenantDb!, tenant_id, "cart.create", newCart, {
      customerCode: body.customer_code,
      addressCode: body.address_code,
      requestData: body as Record<string, unknown>,
    });

    let enrichedCart = null;
    const CART_HOOK_TIMEOUT = 3000; // 3s — normal run is ~0.4s

    // Start hook — we'll race it against a timeout
    const hookPromise = runOnHook(hookCtx).catch((err) => {
      console.error("[cart/active] cart.create hook error:", err);
      return null;
    });

    try {
      const on = await Promise.race([
        hookPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), CART_HOOK_TIMEOUT)),
      ]);
      if (on && on.hooked && on.success && on.response?.data) {
        await mergeOrderErpData(OrderModel, newCart._id, on.response);
        enrichedCart = await OrderModel.findOne({ order_id }).lean();
        runAfterHook(hookCtx);
      } else {
        // Hook didn't finish in time — let it complete in background and merge later
        // This ensures erp_cart_id is saved even if the response already went out
        void hookPromise.then(async (bgOn) => {
          if (bgOn && bgOn.hooked && bgOn.success && bgOn.response?.data) {
            await mergeOrderErpData(OrderModel, newCart._id, bgOn.response);
          }
          runAfterHook(hookCtx);
        });
      }
    } catch (err) {
      console.error("[cart/active] cart.create hook race error:", err);
    }

    return NextResponse.json(
      {
        success: true,
        cart_id: newCart.order_id,
        order_id: newCart.order_id,
        cart_number: newCart.cart_number,
        year: newCart.year,
        is_new: true,
        customer: {
          customer_id: customer.customer_id,
          customer_code: body.customer_code,
          public_code: customer.public_code,
          is_new: customerIsNew,
        },
        address: {
          address_id: address.address_id,
          address_code: body.address_code,
          is_new: addressIsNew,
        },
        order: enrichedCart || newCart,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in cart/active:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
