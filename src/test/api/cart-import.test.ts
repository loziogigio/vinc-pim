/**
 * POST /api/b2b/cart/import — merge_mode tests
 *
 * Covers the in-place update modes added for the legacy-cart resync
 * (`14-sync-legacy-carts.ts --refresh-existing` → merge_mode=merge):
 * - replace: existing draft becomes the rebuilt payload (items + totals);
 *   no-op (skipped/unchanged) when already equal; upserts when absent
 * - merge (rule A): the rebuilt ERP cart is folded into the existing draft —
 *   ERP wins for SKUs in both, VINC-only lines kept, ERP-only lines added,
 *   promo gift lines regenerated; idempotent (no-op when nothing changed);
 *   upserts when absent
 * - both preserve order_id / _id / cart_number / created_at
 * - default merge_mode (skip) still short-circuits on an existing cart
 *
 * Uses in-memory MongoDB with direct route-handler invocation, mirroring
 * src/test/api/orders.test.ts.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
} from "../conftest";
import { buildAuthedRequest } from "../helpers/auth";

// ============================================
// MOCKS (module level, before route import)
// ============================================

const TENANT_ID = "test-tenant";
const TENANT_DB = "vinc-test-tenant";

vi.mock("@/lib/auth/tenant-auth", () => ({
  requireTenantAuth: vi.fn(() =>
    Promise.resolve({
      success: true,
      tenantId: TENANT_ID,
      tenantDb: TENANT_DB,
      userId: "test-user",
    })
  ),
}));

vi.mock("@/lib/db/connection", async () => {
  const { CustomerModel } = await import("@/lib/db/models/customer");
  const { OrderModel } = await import("@/lib/db/models/order");
  const mongoose = await import("mongoose");
  return {
    connectToDatabase: vi.fn(() => Promise.resolve()),
    connectWithModels: vi.fn(() =>
      Promise.resolve({ Customer: CustomerModel, Order: OrderModel })
    ),
    getPooledConnection: vi.fn(() =>
      Promise.resolve(mongoose.default.connection)
    ),
  };
});

// Counter collection lives on a separate pooled connection in prod — mock it
// so cart_number allocation doesn't need that plumbing under the in-memory DB.
let cartNumberSeq = 0;
vi.mock("@/lib/db/models/counter", () => ({
  getNextCartNumber: vi.fn(async () => ++cartNumberSeq),
  getNextOrderNumber: vi.fn(async () => ++cartNumberSeq),
}));

// ============================================
// IMPORTS (after mocks)
// ============================================

import { POST as importCart } from "@/app/api/b2b/cart/import/route";
import { CustomerModel } from "@/lib/db/models/customer";
import { OrderModel } from "@/lib/db/models/order";

// ============================================
// HELPERS
// ============================================

const EXTERNAL_CART_ID = 765195;

async function seedCustomer(): Promise<void> {
  await CustomerModel.create({
    customer_id: "cust-1",
    tenant_id: TENANT_ID,
    external_code: "C001",
    customer_type: "business",
    email: "c1@example.com",
    company_name: "Acme SRL",
    addresses: [
      {
        address_id: "addr-1",
        external_code: "A1",
        address_type: "delivery",
        recipient_name: "Acme SRL",
        street_address: "Via Test 1",
        city: "Milano",
        province: "MI",
        postal_code: "20100",
        country: "IT",
        is_default: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ],
    default_shipping_address_id: "addr-1",
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function line(entity_code: string, quantity: number, price = 10): any {
  return {
    entity_code,
    sku: entity_code,
    name: `Item ${entity_code}`,
    quantity,
    list_price: price,
    unit_price: price,
    vat_rate: 22,
    vat_included: false,
    product_source: "external",
  };
}

function cartPayload(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  overrides: Record<string, any> = {}
) {
  return {
    external_cart_id: EXTERNAL_CART_ID,
    customer_code: "C001",
    address_code: "A1",
    price_decimals: 2,
    items,
    ...overrides,
  };
}

function body(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  carts: any[],
  mergeMode?: "skip" | "error" | "replace"
) {
  return {
    source_id: "test-sync",
    batch_id: "test-batch-1",
    ...(mergeMode ? { merge_mode: mergeMode } : {}),
    carts,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function call(reqBody: any) {
  const req = buildAuthedRequest(
    "POST",
    "/api/b2b/cart/import",
    TENANT_ID,
    reqBody
  );
  const res = await importCart(req);
  return res.json();
}

async function findCart() {
  return OrderModel.findOne({
    tenant_id: TENANT_ID,
    erp_cart_id: EXTERNAL_CART_ID,
  });
}

// ============================================
// TESTS
// ============================================

describe("integration: POST /api/b2b/cart/import — merge_mode replace + merge", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    vi.clearAllMocks();
    cartNumberSeq = 0;
    await seedCustomer();
  });

  it("creates a cart, then replace patches it in place (same doc, refreshed items)", async () => {
    const created = await call(
      body([cartPayload([line("AAA", 2), line("BBB", 1)])])
    );
    expect(created.summary.imported).toBe(1);
    const orderId = created.results[0].order_id as string;
    expect(orderId).toBeTruthy();

    const before = await findCart();
    expect(before).toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(before.items.map((i: any) => i.entity_code).sort()).toEqual([
      "AAA",
      "BBB",
    ]);
    const beforeId = before._id.toString();
    const beforeCreatedAt = before.created_at.getTime();

    const replaced = await call(
      body([cartPayload([line("CCC", 5), line("DDD", 3), line("EEE", 1)])], "replace")
    );
    expect(replaced.summary.updated).toBe(1);
    expect(replaced.summary.imported).toBe(0);
    expect(replaced.results[0].status).toBe("updated");
    expect(replaced.results[0].order_id).toBe(orderId);

    const after = await findCart();
    expect(after.order_id).toBe(orderId);
    expect(after._id.toString()).toBe(beforeId); // truly the same document
    expect(after.created_at.getTime()).toBe(beforeCreatedAt); // created_at preserved
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(after.items.map((i: any) => i.entity_code).sort()).toEqual([
      "CCC",
      "DDD",
      "EEE",
    ]);
    // 9 units * 10 = 90 net; +22% VAT = 109.8 total
    expect(after.subtotal_net).toBeCloseTo(90, 2);
    expect(after.order_total).toBeCloseTo(109.8, 2);
    // legacy traceability refreshed
    expect(after.erp_data.legacy_batch_id).toBe("test-batch-1");
    expect(after.erp_data.legacy_imported_at).toBeTruthy();
  });

  it("replace is a no-op (skipped/unchanged, __v not bumped) when contents match", async () => {
    const created = await call(
      body([cartPayload([line("AAA", 2), line("BBB", 1)])])
    );
    const orderId = created.results[0].order_id as string;
    const v1 = (await findCart()).__v;

    // same SKUs/qtys/prices, different order in the array
    const again = await call(
      body([cartPayload([line("BBB", 1), line("AAA", 2)])], "replace")
    );
    expect(again.results[0].status).toBe("skipped");
    expect(again.results[0].reason).toBe("unchanged");
    expect(again.results[0].order_id).toBe(orderId);
    expect(again.summary.updated).toBe(0);
    expect(again.summary.skipped_idempotent).toBe(1);

    const after = await findCart();
    expect(after.__v).toBe(v1); // not re-saved → no churn
  });

  it("replace upserts: creates the cart when none exists yet", async () => {
    const res = await call(body([cartPayload([line("AAA", 1)])], "replace"));
    expect(res.summary.imported).toBe(1);
    expect(res.summary.updated).toBe(0);
    expect(res.results[0].status).toBe("imported");
    expect(await findCart()).toBeTruthy();
  });

  it("default merge_mode (skip) still short-circuits on an existing cart", async () => {
    await call(body([cartPayload([line("AAA", 2)])]));
    const skipped = await call(body([cartPayload([line("ZZZ", 9)])])); // no merge_mode
    expect(skipped.results[0].status).toBe("skipped");
    expect(skipped.results[0].reason).toBe("already_exists");
    expect(skipped.summary.skipped_idempotent).toBe(1);

    const after = await findCart();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(after.items.map((i: any) => i.entity_code)).toEqual(["AAA"]); // untouched
  });

  // ── merge_mode=merge (rule A: ERP wins shared SKUs, VINC-only lines kept) ──

  it("merge folds the ERP cart into the active cart — ERP wins shared, VINC-only kept, ERP-only added", async () => {
    const created = await call(
      body([cartPayload([line("AAA", 2, 10), line("BBB", 1, 10), line("CCC", 3, 10)])])
    );
    const orderId = created.results[0].order_id as string;
    const beforeId = (await findCart())._id.toString();

    // Incoming ERP cart: AAA at a different qty/price (shared) + DDD (new).
    const merged = await call(
      body([cartPayload([line("AAA", 5, 12), line("DDD", 1, 10)])], "merge")
    );
    expect(merged.summary.updated).toBe(1);
    expect(merged.summary.imported).toBe(0);
    expect(merged.results[0].status).toBe("updated");
    expect(merged.results[0].order_id).toBe(orderId);

    const after = await findCart();
    expect(after._id.toString()).toBe(beforeId); // same document
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(after.items.map((i: any) => i.entity_code).sort()).toEqual([
      "AAA",
      "BBB",
      "CCC",
      "DDD",
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aaa = after.items.find((i: any) => i.entity_code === "AAA");
    expect(aaa.quantity).toBe(5); // ERP line won
    expect(aaa.unit_price).toBe(12);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bbb = after.items.find((i: any) => i.entity_code === "BBB");
    expect(bbb.quantity).toBe(1); // VINC-only line kept untouched
    // line_number renumbered contiguously
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(after.items.map((i: any) => i.line_number)).toEqual([10, 20, 30, 40]);
    // totals rolled up over the merged set: 5*12 + 1*10 + 1*10 + 3*10 = 110 net
    expect(after.subtotal_net).toBeCloseTo(110, 2);
    expect(after.order_total).toBeCloseTo(134.2, 2);
  });

  it("merge is idempotent — re-running with the same/contained ERP cart is a no-op", async () => {
    const created = await call(
      body([cartPayload([line("AAA", 2, 10), line("BBB", 1, 10)])])
    );
    const orderId = created.results[0].order_id as string;
    const v1 = (await findCart()).__v;

    // Incoming ERP cart is a subset that already matches → merged === existing.
    const first = await call(body([cartPayload([line("AAA", 2, 10)])], "merge"));
    expect(first.results[0].status).toBe("skipped");
    expect(first.results[0].reason).toBe("unchanged");
    expect(first.results[0].order_id).toBe(orderId);
    expect(first.summary.updated).toBe(0);
    expect((await findCart()).__v).toBe(v1); // not re-saved

    // And again — still a no-op.
    const second = await call(body([cartPayload([line("AAA", 2, 10)])], "merge"));
    expect(second.results[0].status).toBe("skipped");
    expect(second.results[0].reason).toBe("unchanged");
    expect((await findCart()).__v).toBe(v1);
  });

  it("merge upserts: creates the cart when none exists yet", async () => {
    const res = await call(body([cartPayload([line("AAA", 1)])], "merge"));
    expect(res.summary.imported).toBe(1);
    expect(res.summary.updated).toBe(0);
    expect(res.results[0].status).toBe("imported");
    expect(await findCart()).toBeTruthy();
  });
});
