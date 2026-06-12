/**
 * Regression: a cart must only be depromoted (is_current → false) when it
 * successfully leaves draft via submitOrder(). Any path that keeps the order
 * in `status: "draft"` (async ERP validation in flight, validation rejected,
 * resubmit-with-autofix) must NOT depromote the cart — otherwise a failed sync
 * orphans the user's active cart (see order 9bqN9vj-EZpt, "12 anomalie trovate").
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
  createRequest,
  createParams,
} from "../conftest";

const TEST_TENANT_ID = "test-tenant";
const TEST_DB_NAME = `vinc-${TEST_TENANT_ID}`;

vi.mock("@/lib/notifications/trigger-dispatch", () => ({
  dispatchTrigger: vi.fn(),
}));

vi.mock("@/lib/auth/tenant-auth", () => ({
  requireTenantAuth: vi.fn(() =>
    Promise.resolve({
      success: true,
      tenantId: TEST_TENANT_ID,
      tenantDb: TEST_DB_NAME,
      userId: "test-user",
      isAdmin: true,
      response: undefined,
    })
  ),
}));

vi.mock("@/lib/db/connection", async () => {
  const mongoose = await import("mongoose");
  const { OrderModel } = await import("@/lib/db/models/order");
  return {
    connectToDatabase: vi.fn(),
    connectWithModels: vi.fn(() => Promise.resolve({ Order: OrderModel })),
    getPooledConnection: vi.fn(() => Promise.resolve(mongoose.default.connection)),
  };
});

// before-hook goes async by default; individual tests override per case
const mockBeforeHook = vi.fn();
const mockOnHook = vi.fn();
const mockGetProxySettings = vi.fn();

vi.mock("@/lib/services/windmill-proxy.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/windmill-proxy.service")>();
  return {
    ...actual,
    runBeforeHookWithAsyncFallback: (...a: unknown[]) => mockBeforeHook(...a),
    runOnHookAuto: (...a: unknown[]) => mockOnHook(...a),
    getProxySettings: (...a: unknown[]) => mockGetProxySettings(...a),
    mergeOrderErpData: vi.fn().mockResolvedValue(undefined),
    pushWindmillJobRef: vi.fn().mockResolvedValue(undefined),
    updateWindmillJobStatus: vi.fn().mockResolvedValue(undefined),
  };
});

const mockWindmillGetJobResult = vi.fn();
vi.mock("@/lib/services/windmill-client", () => ({
  windmillGetJobResult: (...a: unknown[]) => mockWindmillGetJobResult(...a),
}));

vi.mock("@/lib/auth/portal-user-token", () => ({
  getPortalUserFromRequest: vi.fn(() => Promise.resolve(null)),
  getAccessibleCustomerIds: vi.fn(() => Promise.resolve(null)),
  hasCustomerAccess: vi.fn(() => true),
}));

import { POST as submitRoute } from "@/app/api/b2b/orders/[id]/submit/route";
import { POST as resubmitRoute } from "@/app/api/b2b/orders/[id]/resubmit/route";
import { GET as processingStatusRoute } from "@/app/api/b2b/orders/[id]/processing-status/route";
import { OrderModel } from "@/lib/db/models/order";
import { nanoid } from "nanoid";

let custSeq = 0;
async function createCart(overrides?: Record<string, unknown>) {
  const orderId = nanoid(12);
  custSeq += 1;
  return OrderModel.create({
    order_id: orderId,
    cart_number: custSeq,
    year: 2026,
    status: "draft",
    is_current: true,
    tenant_id: TEST_TENANT_ID,
    customer_id: `cust-${custSeq}`,
    customer_code: `C-${custSeq}`,
    shipping_address_code: "1",
    session_id: nanoid(12),
    flow_id: nanoid(8),
    source: "web",
    items: [
      {
        line_number: 10,
        entity_code: "PROD-A",
        sku: "SKU-A",
        name: "Widget Alpha",
        quantity: 5,
        unit_price: 20,
        list_price: 25,
        vat_rate: 22,
        line_gross: 125,
        line_net: 100,
        line_vat: 22,
        line_total: 122,
      },
    ],
    subtotal_gross: 125,
    subtotal_net: 100,
    total_discount: 25,
    total_vat: 22,
    shipping_cost: 0,
    order_total: 122,
    currency: "EUR",
    ...overrides,
  });
}

describe("is_current preserved on failed/in-flight sync (still-draft cart)", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  }, 30_000);

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    vi.clearAllMocks();
    mockGetProxySettings.mockResolvedValue(null);
  });

  it("submit: async before-hook fallback must NOT depromote the cart", async () => {
    const cart = await createCart();
    mockBeforeHook.mockResolvedValue({ async: true, jobId: "job-async-1", hooked: true });

    const req = createRequest("POST", undefined, `http://localhost:3000/api/b2b/orders/${cart.order_id}/submit`);
    const res = await submitRoute(req, createParams({ id: cart.order_id }));
    expect(res.status).toBe(202);

    const after = await OrderModel.findOne({ order_id: cart.order_id }).lean();
    expect(after?.status).toBe("draft");
    expect(after?.processing_status).toBe("processing");
    expect(after?.is_current).toBe(true); // cart stays active while ERP validates
  });

  it("processing-status: before-hook REJECTED must NOT depromote the still-draft cart", async () => {
    const cart = await createCart({
      processing_status: "processing",
      processing_phase: "before",
      processing_job_id: "job-reject-1",
      processing_started_at: new Date(),
    });
    mockWindmillGetJobResult.mockResolvedValue({
      completed: true,
      result: { allowed: false, message: "12 anomalie trovate" },
    });

    const req = createRequest("GET", undefined, `http://localhost:3000/api/b2b/orders/${cart.order_id}/processing-status`);
    const res = await processingStatusRoute(req, createParams({ id: cart.order_id }));
    const data = await res.json();
    expect(data.processing_status).toBe("failed");
    expect(data.status).toBe("draft");

    const after = await OrderModel.findOne({ order_id: cart.order_id }).lean();
    expect(after?.status).toBe("draft");
    expect(after?.processing_status).toBe("failed");
    expect(after?.is_current).toBe(true); // rejected validation keeps cart active for retry
  });

  it("resubmit: claim + async before-hook must NOT depromote the still-draft cart", async () => {
    const cart = await createCart({
      processing_status: "failed",
      processing_errors: ["12 anomalie trovate"],
      is_current: true,
    });
    mockBeforeHook.mockResolvedValue({ async: true, jobId: "job-async-2", hooked: true });

    const req = createRequest("POST", undefined, `http://localhost:3000/api/b2b/orders/${cart.order_id}/resubmit`);
    const res = await resubmitRoute(req, createParams({ id: cart.order_id }));
    expect(res.status).toBe(202);

    const after = await OrderModel.findOne({ order_id: cart.order_id }).lean();
    expect(after?.status).toBe("draft");
    expect(after?.is_current).toBe(true); // resubmitting a failed cart keeps it active
  });
});
