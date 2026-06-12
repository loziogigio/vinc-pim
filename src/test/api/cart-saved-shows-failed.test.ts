/**
 * Regression: a parked/depromoted draft cart must appear in the saved-carts
 * list even if its last submit attempt failed (processing_status: "failed").
 * Previously the query excluded processing_status in ["processing","failed"],
 * which hid recoverable failed carts from the user (double blind spot with the
 * is_current depromotion bug).
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
  createRequest,
} from "../conftest";

const TEST_TENANT_ID = "test-tenant";
const TEST_DB_NAME = `vinc-${TEST_TENANT_ID}`;

vi.mock("@/lib/auth/tenant-auth", () => ({
  requireTenantAuth: vi.fn(() =>
    Promise.resolve({
      success: true,
      tenantId: TEST_TENANT_ID,
      tenantDb: TEST_DB_NAME,
      userId: "test-user",
      response: undefined,
    })
  ),
}));

vi.mock("@/lib/db/connection", async () => {
  const { OrderModel } = await import("@/lib/db/models/order");
  return {
    connectWithModels: vi.fn(() => Promise.resolve({ Order: OrderModel })),
  };
});

import { GET as savedCarts } from "@/app/api/b2b/cart/saved/route";
import { OrderModel } from "@/lib/db/models/order";
import { nanoid } from "nanoid";

const CUST = "C-900";
const ADDR = "1";

async function makeCart(overrides: Record<string, unknown>) {
  return OrderModel.create({
    order_id: nanoid(12),
    cart_number: Math.floor(Math.random() * 1e6),
    year: 2026,
    status: "draft",
    is_current: false,
    tenant_id: TEST_TENANT_ID,
    customer_id: "cust-900",
    customer_code: CUST,
    shipping_address_code: ADDR,
    session_id: nanoid(12),
    flow_id: nanoid(8),
    source: "web",
    items: [],
    currency: "EUR",
    ...overrides,
  });
}

function savedReq() {
  return createRequest(
    "GET",
    undefined,
    `http://localhost:3000/api/b2b/cart/saved?customer_code=${CUST}&address_code=${ADDR}`
  );
}

describe("cart/saved includes failed (recoverable) parked carts", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  }, 30_000);
  afterAll(async () => {
    await teardownTestDatabase();
  });
  beforeEach(async () => {
    await clearDatabase();
    vi.clearAllMocks();
  });

  it("returns a parked draft cart whose last submit failed", async () => {
    const failed = await makeCart({ processing_status: "failed", processing_errors: ["10 anomalie trovate"], cart_name: "Recoverable" });
    await makeCart({ cart_name: "Clean parked" }); // a normal saved cart too

    const res = await savedCarts(savedReq());
    const data = await res.json();

    expect(data.success).toBe(true);
    const ids = data.saved_carts.map((c: any) => c.order_id);
    expect(ids).toContain(failed.order_id); // failed cart must be visible/recoverable
    expect(data.saved_carts).toHaveLength(2);
  });
});
