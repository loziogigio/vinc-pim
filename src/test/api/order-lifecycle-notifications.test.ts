/**
 * Integration Tests: Order Lifecycle Notification Triggers
 *
 * Tests that order lifecycle transitions (submit, confirm, ship, deliver,
 * cancel, payment) correctly dispatch notification triggers.
 *
 * Uses MongoMemoryServer + route handler imports to test the full
 * API → lifecycle service → notification dispatch chain.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
  createRequest,
  createParams,
} from "../conftest";

// ============================================
// MOCKS
// ============================================

const TEST_USER_ID = "lifecycle-test-user";
const TEST_TENANT_ID = "test-tenant";
const TEST_DB_NAME = `vinc-${TEST_TENANT_ID}`;

// Track dispatchTrigger calls
const mockDispatchTrigger = vi.fn();

vi.mock("@/lib/notifications/trigger-dispatch", () => ({
  dispatchTrigger: (...args: unknown[]) => mockDispatchTrigger(...args),
}));

// Mock tenant auth
vi.mock("@/lib/auth/tenant-auth", () => ({
  requireTenantAuth: vi.fn(() =>
    Promise.resolve({
      success: true,
      tenantId: TEST_TENANT_ID,
      tenantDb: TEST_DB_NAME,
      userId: TEST_USER_ID,
      isAdmin: true,
      response: undefined,
    })
  ),
}));

// Mock DB connection to use in-memory mongoose
vi.mock("@/lib/db/connection", async () => {
  const mongoose = await import("mongoose");
  const { OrderModel } = await import("@/lib/db/models/order");
  return {
    connectToDatabase: vi.fn(),
    connectWithModels: vi.fn(() => Promise.resolve({ Order: OrderModel })),
    getPooledConnection: vi.fn(() => Promise.resolve(mongoose.default.connection)),
  };
});

// Mock windmill-proxy.service (used by order routes for ERP hooks)
vi.mock("@/lib/services/windmill-proxy.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/windmill-proxy.service")>();
  return {
    ...actual,
    runBeforeHook: vi.fn().mockResolvedValue({ hooked: false, allowed: true }),
    runBeforeHookWithAsyncFallback: vi.fn().mockResolvedValue({ async: false, hooked: false, allowed: true }),
    runOnHook: vi.fn().mockResolvedValue({ hooked: false, success: false }),
    runOnHookWithAsyncFallback: vi.fn().mockResolvedValue({ async: false, hooked: false, success: false }),
    runAfterHook: vi.fn().mockResolvedValue(undefined),
    mergeOrderErpData: vi.fn(),
    pushWindmillJobRef: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock portal user token
vi.mock("@/lib/auth/portal-user-token", () => ({
  getPortalUserFromRequest: vi.fn(() => Promise.resolve(null)),
  getAccessibleCustomerIds: vi.fn(() => Promise.resolve(null)),
  hasCustomerAccess: vi.fn(() => true),
}));

// Mock counter for order numbers (preserve CounterSchema used by model-registry)
vi.mock("@/lib/db/models/counter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/models/counter")>();
  return {
    ...actual,
    getNextOrderNumber: vi.fn(() => Promise.resolve(1001)),
  };
});

// ============================================
// IMPORTS (after mocks)
// ============================================

import { POST as submitOrder } from "@/app/api/b2b/orders/[id]/submit/route";
import { POST as confirmOrder } from "@/app/api/b2b/orders/[id]/confirm/route";
import { POST as shipOrder } from "@/app/api/b2b/orders/[id]/ship/route";
import { POST as deliverOrder } from "@/app/api/b2b/orders/[id]/deliver/route";
import { POST as cancelOrder } from "@/app/api/b2b/orders/[id]/cancel/route";
import { POST as recordPayment } from "@/app/api/b2b/orders/[id]/payment/route";
import { OrderModel } from "@/lib/db/models/order";
import { nanoid } from "nanoid";

// ============================================
// HELPERS
// ============================================

async function createDraftOrder(overrides?: Record<string, unknown>) {
  const orderId = nanoid(12);
  const order = await OrderModel.create({
    order_id: orderId,
    cart_number: 1,
    year: 2026,
    status: "draft",
    is_current: true,
    tenant_id: TEST_TENANT_ID,
    customer_id: "cust-001",
    customer_code: "C-001",
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
  return order;
}

async function createOrderInStatus(status: string, extra?: Record<string, unknown>) {
  const order = await createDraftOrder({
    status,
    order_number: 1001,
    is_current: false,
    ...(status !== "draft" ? { submitted_at: new Date() } : {}),
    ...(status === "confirmed" || status === "shipped" || status === "delivered"
      ? { confirmed_at: new Date() }
      : {}),
    ...(status === "shipped" || status === "delivered"
      ? { shipped_at: new Date(), delivery: { shipped_at: new Date() } }
      : {}),
    ...(status === "delivered" ? { delivered_at: new Date() } : {}),
    ...extra,
  });
  return order;
}

// ============================================
// TESTS
// ============================================

describe("integration: Order Lifecycle Notification Triggers", () => {
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

  // ==========================================
  // SUBMIT (draft → pending)
  // ==========================================

  describe("POST /api/b2b/orders/[id]/submit", () => {
    it("should dispatch order_confirmation trigger on successful submit", async () => {
      const order = await createDraftOrder({
        payment: { payment_method: "bank_transfer", payment_status: "awaiting", amount_due: 122, amount_paid: 0, amount_remaining: 122, payments: [] },
      });
      const req = createRequest("POST", undefined, `http://localhost:3000/api/b2b/orders/${order.order_id}/submit`);

      const res = await submitOrder(req, createParams({ id: order.order_id }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      // Deferred payment orders are auto-confirmed on submit (draft → confirmed)
      expect(data.order.status).toBe("confirmed");

      // Verify notification was dispatched
      expect(mockDispatchTrigger).toHaveBeenCalledOnce();
      expect(mockDispatchTrigger).toHaveBeenCalledWith(
        TEST_DB_NAME,
        "order_confirmation",
        expect.objectContaining({
          type: "order",
          portalUserId: TEST_USER_ID,
        })
      );
      // The order in the dispatch call should have status "confirmed" (auto-confirmed)
      const dispatchedOrder = mockDispatchTrigger.mock.calls[0][2].order;
      expect(dispatchedOrder.status).toBe("confirmed");
    });

    it("should NOT dispatch trigger when submit fails (empty order)", async () => {
      const order = await createDraftOrder({ items: [] });
      const req = createRequest("POST", undefined, `http://localhost:3000/api/b2b/orders/${order.order_id}/submit`);

      const res = await submitOrder(req, createParams({ id: order.order_id }));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("empty");
      expect(mockDispatchTrigger).not.toHaveBeenCalled();
    });

    it("should NOT dispatch trigger when order not found", async () => {
      const req = createRequest("POST", undefined, "http://localhost:3000/api/b2b/orders/nonexistent/submit");

      const res = await submitOrder(req, createParams({ id: "nonexistent" }));
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(mockDispatchTrigger).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // CONFIRM (pending → confirmed)
  // ==========================================

  describe("POST /api/b2b/orders/[id]/confirm", () => {
    it("should dispatch order_confirmation trigger on successful confirm", async () => {
      const order = await createOrderInStatus("pending");
      const req = createRequest("POST", undefined, `http://localhost:3000/api/b2b/orders/${order.order_id}/confirm`);

      const res = await confirmOrder(req, createParams({ id: order.order_id }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);

      expect(mockDispatchTrigger).toHaveBeenCalledOnce();
      expect(mockDispatchTrigger).toHaveBeenCalledWith(
        TEST_DB_NAME,
        "order_confirmation",
        expect.objectContaining({ type: "order" })
      );
    });

    it("should NOT dispatch trigger when confirm fails (wrong status)", async () => {
      const order = await createOrderInStatus("draft");
      const req = createRequest("POST", undefined, `http://localhost:3000/api/b2b/orders/${order.order_id}/confirm`);

      const res = await confirmOrder(req, createParams({ id: order.order_id }));

      expect(res.status).toBe(400);
      expect(mockDispatchTrigger).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // SHIP (confirmed → shipped)
  // ==========================================

  describe("POST /api/b2b/orders/[id]/ship", () => {
    it("should dispatch order_shipped trigger on successful ship", async () => {
      const order = await createOrderInStatus("confirmed");
      const req = createRequest(
        "POST",
        { carrier: "BRT", tracking_number: "BRT123" },
        `http://localhost:3000/api/b2b/orders/${order.order_id}/ship`
      );

      const res = await shipOrder(req, createParams({ id: order.order_id }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.order.status).toBe("shipped");

      expect(mockDispatchTrigger).toHaveBeenCalledOnce();
      expect(mockDispatchTrigger).toHaveBeenCalledWith(
        TEST_DB_NAME,
        "order_shipped",
        expect.objectContaining({ type: "order" })
      );

      // Verify delivery data is on the dispatched order
      const dispatchedOrder = mockDispatchTrigger.mock.calls[0][2].order;
      expect(dispatchedOrder.delivery?.carrier).toBe("BRT");
      expect(dispatchedOrder.delivery?.tracking_number).toBe("BRT123");
    });

    it("should NOT dispatch trigger when ship fails (wrong status)", async () => {
      const order = await createOrderInStatus("pending");
      const req = createRequest("POST", {}, `http://localhost:3000/api/b2b/orders/${order.order_id}/ship`);

      const res = await shipOrder(req, createParams({ id: order.order_id }));

      expect(res.status).toBe(400);
      expect(mockDispatchTrigger).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // DELIVER (shipped → delivered)
  // ==========================================

  describe("POST /api/b2b/orders/[id]/deliver", () => {
    it("should dispatch order_delivered trigger on successful deliver", async () => {
      const order = await createOrderInStatus("shipped");
      const req = createRequest("POST", undefined, `http://localhost:3000/api/b2b/orders/${order.order_id}/deliver`);

      const res = await deliverOrder(req, createParams({ id: order.order_id }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.order.status).toBe("delivered");

      expect(mockDispatchTrigger).toHaveBeenCalledOnce();
      expect(mockDispatchTrigger).toHaveBeenCalledWith(
        TEST_DB_NAME,
        "order_delivered",
        expect.objectContaining({ type: "order" })
      );
    });

    it("should NOT dispatch trigger when deliver fails (wrong status)", async () => {
      const order = await createOrderInStatus("confirmed");
      const req = createRequest("POST", undefined, `http://localhost:3000/api/b2b/orders/${order.order_id}/deliver`);

      const res = await deliverOrder(req, createParams({ id: order.order_id }));

      expect(res.status).toBe(400);
      expect(mockDispatchTrigger).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // CANCEL (any → cancelled)
  // ==========================================

  describe("POST /api/b2b/orders/[id]/cancel", () => {
    it("should dispatch order_cancelled trigger on successful cancel", async () => {
      const order = await createOrderInStatus("pending");
      const req = createRequest(
        "POST",
        { reason: "Customer request" },
        `http://localhost:3000/api/b2b/orders/${order.order_id}/cancel`
      );

      const res = await cancelOrder(req, createParams({ id: order.order_id }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.order.status).toBe("cancelled");

      expect(mockDispatchTrigger).toHaveBeenCalledOnce();
      expect(mockDispatchTrigger).toHaveBeenCalledWith(
        TEST_DB_NAME,
        "order_cancelled",
        expect.objectContaining({ type: "order" })
      );
    });

    it("should NOT dispatch trigger when cancel fails (terminal status)", async () => {
      const order = await createOrderInStatus("delivered");
      const req = createRequest("POST", {}, `http://localhost:3000/api/b2b/orders/${order.order_id}/cancel`);

      const res = await cancelOrder(req, createParams({ id: order.order_id }));

      expect(res.status).toBe(400);
      expect(mockDispatchTrigger).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // PAYMENT (record payment)
  // ==========================================

  describe("POST /api/b2b/orders/[id]/payment", () => {
    it("should dispatch payment_received trigger on successful payment", async () => {
      const order = await createOrderInStatus("confirmed", {
        payment: {
          payment_status: "awaiting",
          amount_due: 122,
          amount_paid: 0,
          amount_remaining: 122,
          payments: [],
        },
      });
      const req = createRequest(
        "POST",
        { amount: 122, method: "bank_transfer", reference: "TX-001" },
        `http://localhost:3000/api/b2b/orders/${order.order_id}/payment`
      );

      const res = await recordPayment(req, createParams({ id: order.order_id }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.payment.payment_status).toBe("paid");

      expect(mockDispatchTrigger).toHaveBeenCalledOnce();
      expect(mockDispatchTrigger).toHaveBeenCalledWith(
        TEST_DB_NAME,
        "payment_received",
        expect.objectContaining({
          type: "payment",
          paymentAmount: 122,
          paymentMethod: "bank_transfer",
        })
      );
    });

    it("should NOT dispatch trigger when payment fails (wrong status)", async () => {
      const order = await createOrderInStatus("draft");
      const req = createRequest(
        "POST",
        { amount: 100, method: "cash" },
        `http://localhost:3000/api/b2b/orders/${order.order_id}/payment`
      );

      const res = await recordPayment(req, createParams({ id: order.order_id }));

      expect(res.status).toBe(400);
      expect(mockDispatchTrigger).not.toHaveBeenCalled();
    });

    it("should NOT dispatch trigger when validation fails (missing amount)", async () => {
      const order = await createOrderInStatus("confirmed");
      const req = createRequest(
        "POST",
        { method: "cash" },
        `http://localhost:3000/api/b2b/orders/${order.order_id}/payment`
      );

      const res = await recordPayment(req, createParams({ id: order.order_id }));

      expect(res.status).toBe(400);
      expect(mockDispatchTrigger).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // FULL LIFECYCLE
  // ==========================================

  describe("Full order lifecycle", () => {
    it("should dispatch correct triggers through complete lifecycle", async () => {
      // 1. Create draft order with deferred payment (auto-confirms on submit)
      const order = await createDraftOrder({
        payment: { payment_method: "bank_transfer", payment_status: "awaiting", amount_due: 122, amount_paid: 0, amount_remaining: 122, payments: [] },
      });
      const orderId = order.order_id;

      // 2. Submit (draft → confirmed, auto-confirmed for deferred payment) → order_confirmation
      const submitReq = createRequest("POST", undefined, `http://localhost:3000/api/b2b/orders/${orderId}/submit`);
      const submitRes = await submitOrder(submitReq, createParams({ id: orderId }));
      const submitData = await submitRes.json();
      expect(submitData.success).toBe(true);
      expect(submitData.order.status).toBe("confirmed");
      expect(mockDispatchTrigger).toHaveBeenCalledTimes(1);
      expect(mockDispatchTrigger.mock.calls[0][1]).toBe("order_confirmation");

      // 3. Ship (confirmed → shipped) → order_shipped
      const shipReq = createRequest(
        "POST",
        { carrier: "GLS", tracking_number: "GLS789" },
        `http://localhost:3000/api/b2b/orders/${orderId}/ship`
      );
      const shipRes = await shipOrder(shipReq, createParams({ id: orderId }));
      expect((await shipRes.json()).success).toBe(true);
      expect(mockDispatchTrigger).toHaveBeenCalledTimes(2);
      expect(mockDispatchTrigger.mock.calls[1][1]).toBe("order_shipped");

      // 4. Deliver (shipped → delivered) → order_delivered
      const deliverReq = createRequest("POST", undefined, `http://localhost:3000/api/b2b/orders/${orderId}/deliver`);
      const deliverRes = await deliverOrder(deliverReq, createParams({ id: orderId }));
      expect((await deliverRes.json()).success).toBe(true);
      expect(mockDispatchTrigger).toHaveBeenCalledTimes(3);
      expect(mockDispatchTrigger.mock.calls[2][1]).toBe("order_delivered");

      // Verify all 3 triggers used the correct tenant DB
      for (let i = 0; i < 3; i++) {
        expect(mockDispatchTrigger.mock.calls[i][0]).toBe(TEST_DB_NAME);
      }
    });
  });
}, 60_000);
