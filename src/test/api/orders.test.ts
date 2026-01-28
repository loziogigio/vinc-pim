/**
 * Integration Tests for Orders API
 *
 * Tests complete workflows including:
 * - API endpoints
 * - Service layer
 * - Repository layer (MongoDB)
 * - Order totals calculation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
  createRequest,
  createParams,
  OrderFactory,
  LineItemFactory,
} from "../conftest";

// ============================================
// MOCKS (must be at module level)
// ============================================

const TEST_USER_ID = "test-customer-123";

vi.mock("@/lib/auth/b2b-session", () => ({
  getB2BSession: vi.fn(() =>
    Promise.resolve({
      isLoggedIn: true,
      userId: TEST_USER_ID,
      tenantId: "test-tenant",
    })
  ),
}));

// Mock API key auth
vi.mock("@/lib/auth/api-key-auth", () => ({
  verifyAPIKeyFromRequest: vi.fn(() =>
    Promise.resolve({
      authenticated: true,
      tenantId: "test-tenant",
      tenantDb: "vinc-test-tenant",
    })
  ),
}));

vi.mock("@/lib/db/connection", async () => {
  const { CustomerModel } = await import("@/lib/db/models/customer");
  const { OrderModel } = await import("@/lib/db/models/order");
  const mongoose = await import("mongoose");
  return {
    connectToDatabase: vi.fn(() => Promise.resolve()),
    connectWithModels: vi.fn(() => Promise.resolve({
      Customer: CustomerModel,
      Order: OrderModel,
    })),
    getPooledConnection: vi.fn(() => Promise.resolve(mongoose.default.connection)),
  };
});

// Mock portal user token (no portal user restrictions for these tests)
vi.mock("@/lib/auth/portal-user-token", () => ({
  getPortalUserFromRequest: vi.fn(() => Promise.resolve(null)),
  getAccessibleCustomerIds: vi.fn(() => Promise.resolve(null)),
  hasCustomerAccess: vi.fn(() => true),
}));

// Mock customer service - needs to return actual customer from DB
const mockFindOrCreateCustomer = vi.fn();
const mockFindOrCreateAddress = vi.fn();

vi.mock("@/lib/services/customer.service", () => ({
  findOrCreateCustomer: (...args: unknown[]) => mockFindOrCreateCustomer(...args),
  findOrCreateAddress: (...args: unknown[]) => mockFindOrCreateAddress(...args),
}));

// ============================================
// IMPORTS (after mocks)
// ============================================

import { POST as createOrder, GET as listOrders } from "@/app/api/b2b/orders/route";
import { GET as getOrder, PATCH as updateOrder, DELETE as deleteOrder } from "@/app/api/b2b/orders/[id]/route";
import { GET as getActiveCart } from "@/app/api/b2b/orders/active/route";
import { POST as addItem, PATCH as updateItems, DELETE as removeItems } from "@/app/api/b2b/orders/[id]/items/route";
import { CustomerModel } from "@/lib/db/models/customer";

// ============================================
// HELPER: Create test customer
// ============================================

async function createTestCustomer(customerId: string = TEST_USER_ID): Promise<void> {
  const customer = await CustomerModel.create({
    customer_id: customerId,
    tenant_id: "test-tenant",
    customer_type: "business",
    email: `${customerId}@example.com`,
    company_name: "Test Company",
    addresses: [
      {
        address_id: "addr-default",
        address_type: "delivery",
        recipient_name: "Test",
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
    default_shipping_address_id: "addr-default",
  });

  // Configure mock to return this customer
  mockFindOrCreateCustomer.mockResolvedValue({
    customer: customer.toObject(),
    isNew: false,
  });
}

// ============================================
// TEST SETUP
// ============================================

describe("integration: Orders API", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    vi.clearAllMocks();
    process.env.VINC_TENANT_ID = "test-tenant";
  });

  afterEach(() => {
    delete process.env.VINC_TENANT_ID;
  });

  // ==========================================
  // POST /api/b2b/orders - Create Order
  // ==========================================

  describe("POST /api/b2b/orders", () => {
    it("should create draft order with valid payload", async () => {
      /**
       * Test that a new draft order is created with all required fields.
       * Verifies order_id generation and default status.
       * Note: Uses customer lookup-or-create - customer must exist or be created.
       */
      // Arrange - Create customer first (required by findOrCreateCustomer)
      await createTestCustomer();
      const payload = OrderFactory.createPayload({ customer_id: TEST_USER_ID });
      const req = createRequest("POST", payload);

      // Act
      const res = await createOrder(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.order.status).toBe("draft");
      expect(data.order.order_id).toBeDefined();
      expect(data.order.customer_id).toBe(TEST_USER_ID);
      expect(data.order.order_total).toBe(0);
    });

    it("should return 400 when customer_id is missing", async () => {
      /**
       * Test validation: customer_id is required.
       */
      // Arrange
      const req = createRequest("POST", {});

      // Act
      const res = await createOrder(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(400);
      expect(data.error).toContain("customer_id");
    });
  });

  // ==========================================
  // GET /api/b2b/orders/active - Active Cart
  // ==========================================

  describe("GET /api/b2b/orders/active", () => {
    it("should create new cart if none exists", async () => {
      /**
       * Test auto-creation of cart for customers without active draft.
       */
      // Arrange
      const req = createRequest("GET", undefined, "http://localhost:3000/api/b2b/orders/active");

      // Act
      const res = await getActiveCart(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.order.status).toBe("draft");
      expect(data.order.customer_id).toBe(TEST_USER_ID);
    });

    it("should return existing draft cart on subsequent calls", async () => {
      /**
       * Test idempotency: same cart returned for same customer.
       */
      // Arrange
      const req1 = createRequest("GET", undefined, "http://localhost:3000/api/b2b/orders/active");
      const res1 = await getActiveCart(req1);
      const data1 = await res1.json();

      // Act
      const req2 = createRequest("GET", undefined, "http://localhost:3000/api/b2b/orders/active");
      const res2 = await getActiveCart(req2);
      const data2 = await res2.json();

      // Assert
      expect(data1.order.order_id).toBe(data2.order.order_id);
    });
  });

  // ==========================================
  // POST /api/b2b/orders/[id]/items - Add Item
  // ==========================================

  describe("POST /api/b2b/orders/[id]/items", () => {
    it("should add item to cart with correct line totals", async () => {
      /**
       * Test item addition with line totals calculation.
       * Line: qty=10, unit_price=80, vat=22%
       * Expected: line_net=800, line_vat=176, line_total=976
       */
      // Arrange
      const cartRes = await getActiveCart(
        createRequest("GET", undefined, "http://localhost:3000/api/b2b/orders/active")
      );
      const { order } = await cartRes.json();

      const itemPayload = LineItemFactory.createPayload({
        entity_code: "PROD-001",
        sku: "PROD-001",
        quantity: 10,
        list_price: 100,
        unit_price: 80,
        vat_rate: 22,
      });

      // Act
      const res = await addItem(
        createRequest("POST", itemPayload),
        createParams({ id: order.order_id })
      );
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.order.items).toHaveLength(1);
      expect(data.item.line_net).toBe(800);
      expect(data.item.line_vat).toBe(176);
      expect(data.item.line_total).toBe(976);
    });

    it("should increment quantity for existing entity_code", async () => {
      /**
       * Test duplicate handling: same entity_code increments quantity.
       */
      // Arrange
      const cartRes = await getActiveCart(
        createRequest("GET", undefined, "http://localhost:3000/api/b2b/orders/active")
      );
      const { order } = await cartRes.json();

      const itemPayload = LineItemFactory.createPayload({
        entity_code: "PROD-001",
        sku: "PROD-001",
        quantity: 10,
      });

      // First add
      await addItem(createRequest("POST", itemPayload), createParams({ id: order.order_id }));

      // Act - Second add with same entity_code (full payload required)
      const res = await addItem(
        createRequest("POST", LineItemFactory.createPayload({
          entity_code: "PROD-001",
          sku: "PROD-001",
          quantity: 5,
        })),
        createParams({ id: order.order_id })
      );
      const data = await res.json();

      // Assert
      expect(data.order.items).toHaveLength(1);
      expect(data.item.quantity).toBe(15); // 10 + 5
    });

    it("should reject quantity below min_order_quantity", async () => {
      /**
       * Test MOQ validation: quantity must be >= min_order_quantity.
       */
      // Arrange
      const cartRes = await getActiveCart(
        createRequest("GET", undefined, "http://localhost:3000/api/b2b/orders/active")
      );
      const { order } = await cartRes.json();

      const itemPayload = LineItemFactory.createPayload({
        quantity: 5,
        min_order_quantity: 10,
      });

      // Act
      const res = await addItem(
        createRequest("POST", itemPayload),
        createParams({ id: order.order_id })
      );
      const data = await res.json();

      // Assert
      expect(res.status).toBe(400);
      expect(data.error).toContain("Minimum order quantity");
    });

    it("should reject quantity not multiple of pack_size", async () => {
      /**
       * Test pack_size validation: quantity must be divisible by pack_size.
       */
      // Arrange
      const cartRes = await getActiveCart(
        createRequest("GET", undefined, "http://localhost:3000/api/b2b/orders/active")
      );
      const { order } = await cartRes.json();

      const itemPayload = LineItemFactory.createPayload({
        quantity: 15,
        pack_size: 10,
      });

      // Act
      const res = await addItem(
        createRequest("POST", itemPayload),
        createParams({ id: order.order_id })
      );
      const data = await res.json();

      // Assert
      expect(res.status).toBe(400);
      expect(data.error).toContain("multiple of");
    });

    it("should store image_url, brand, and category (product snapshot)", async () => {
      /**
       * Test that product snapshot fields are preserved.
       * Mobile app needs image_url for cart display.
       */
      // Arrange
      const cartRes = await getActiveCart(
        createRequest("GET", undefined, "http://localhost:3000/api/b2b/orders/active")
      );
      const { order } = await cartRes.json();

      const itemPayload = {
        ...LineItemFactory.createPayload({
          entity_code: "PROD-IMAGE",
          sku: "PROD-IMAGE",
          quantity: 1,
        }),
        image_url: "https://cdn.example.com/products/test.jpg",
        brand: "Test Brand",
        category: "Test Category",
      };

      // Act
      const res = await addItem(
        createRequest("POST", itemPayload),
        createParams({ id: order.order_id })
      );
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.item.image_url).toBe("https://cdn.example.com/products/test.jpg");
      expect(data.item.brand).toBe("Test Brand");
      expect(data.item.category).toBe("Test Category");
    });

    it("should store promo tracking fields", async () => {
      /**
       * Test promo fields: promo_code, promo_label, promo_discount_pct, promo_discount_amt.
       * These track promotion details for reporting and display.
       */
      // Arrange
      const cartRes = await getActiveCart(
        createRequest("GET", undefined, "http://localhost:3000/api/b2b/orders/active")
      );
      const { order } = await cartRes.json();

      const itemPayload = {
        ...LineItemFactory.createPayload({
          entity_code: "PROD-PROMO",
          sku: "PROD-PROMO",
          quantity: 1,
          list_price: 100,
          unit_price: 80,
        }),
        promo_code: "SUMMER-SALE",
        promo_label: "Summer Sale -20%",
        promo_discount_pct: -20,
      };

      // Act
      const res = await addItem(
        createRequest("POST", itemPayload),
        createParams({ id: order.order_id })
      );
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.item.promo_code).toBe("SUMMER-SALE");
      expect(data.item.promo_label).toBe("Summer Sale -20%");
      expect(data.item.promo_discount_pct).toBe(-20);
    });

    it("should store discount_chain for price calculation tracking", async () => {
      /**
       * Test discount_chain: array of discount steps tracking full price calculation.
       * Each step has type, value, source, and order.
       */
      // Arrange
      const cartRes = await getActiveCart(
        createRequest("GET", undefined, "http://localhost:3000/api/b2b/orders/active")
      );
      const { order } = await cartRes.json();

      const discountChain = [
        { type: "percentage", value: -10, source: "price_list", order: 1 },
        { type: "percentage", value: -15, source: "promo", order: 2 },
      ];

      const itemPayload = {
        ...LineItemFactory.createPayload({
          entity_code: "PROD-CHAIN",
          sku: "PROD-CHAIN",
          quantity: 1,
          list_price: 100,
          unit_price: 76.5, // 100 * 0.9 * 0.85
        }),
        promo_code: "CHAIN-TEST",
        promo_label: "Chained Discount",
        discount_chain: discountChain,
      };

      // Act
      const res = await addItem(
        createRequest("POST", itemPayload),
        createParams({ id: order.order_id })
      );
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.item.discount_chain).toHaveLength(2);
      expect(data.item.discount_chain[0]).toMatchObject({
        type: "percentage",
        value: -10,
        source: "price_list",
        order: 1,
      });
      expect(data.item.discount_chain[1]).toMatchObject({
        type: "percentage",
        value: -15,
        source: "promo",
        order: 2,
      });
    });

    it("should store discount_chain with net price type", async () => {
      /**
       * Test discount_chain with direct net price (overrides calculation).
       */
      // Arrange
      const cartRes = await getActiveCart(
        createRequest("GET", undefined, "http://localhost:3000/api/b2b/orders/active")
      );
      const { order } = await cartRes.json();

      const discountChain = [
        { type: "percentage", value: -10, source: "price_list", order: 1 },
        { type: "net", value: 50, source: "promo", order: 2 },
      ];

      const itemPayload = {
        ...LineItemFactory.createPayload({
          entity_code: "PROD-NET",
          sku: "PROD-NET",
          quantity: 1,
          list_price: 100,
          unit_price: 50, // Direct net price from promo
        }),
        promo_code: "NET-PRICE",
        promo_label: "Fixed Price €50",
        discount_chain: discountChain,
      };

      // Act
      const res = await addItem(
        createRequest("POST", itemPayload),
        createParams({ id: order.order_id })
      );
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.item.discount_chain).toHaveLength(2);
      expect(data.item.discount_chain[1]).toMatchObject({
        type: "net",
        value: 50,
        source: "promo",
        order: 2,
      });
    });
  });

  // ==========================================
  // PATCH /api/b2b/orders/[id]/items - Update Items (batch)
  // ==========================================

  describe("PATCH /api/b2b/orders/[id]/items", () => {
    it("should update item quantity and recalculate totals", async () => {
      /**
       * Test quantity update with totals recalculation.
       * New API uses line_number in body for identification.
       */
      // Arrange
      const cartRes = await getActiveCart(
        createRequest("GET", undefined, "http://localhost:3000/api/b2b/orders/active")
      );
      const { order } = await cartRes.json();

      const addRes = await addItem(
        createRequest("POST", LineItemFactory.createPayload({ entity_code: "PROD-001", quantity: 10 })),
        createParams({ id: order.order_id })
      );
      const addData = await addRes.json();
      const lineNumber = addData.item.line_number;

      // Act - Use new batch format with line_number in body
      const res = await updateItems(
        createRequest("PATCH", { items: [{ line_number: lineNumber, quantity: 20 }] }),
        createParams({ id: order.order_id })
      );
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.order.items[0].quantity).toBe(20);
      expect(data.order.items[0].line_net).toBe(1600); // 20 * 80
    });

    it("should preserve promo fields and discount_chain when updating quantity", async () => {
      /**
       * Test that all promo data is preserved when updating quantity.
       * Critical for mobile app: promo_code, promo_label, discount_chain must not be lost.
       */
      // Arrange
      const cartRes = await getActiveCart(
        createRequest("GET", undefined, "http://localhost:3000/api/b2b/orders/active")
      );
      const { order } = await cartRes.json();

      const discountChain = [
        { type: "percentage", value: -10, source: "price_list", order: 1 },
        { type: "percentage", value: -20, source: "promo", order: 2 },
      ];

      const addRes = await addItem(
        createRequest("POST", {
          ...LineItemFactory.createPayload({
            entity_code: "PROD-PRESERVE",
            sku: "PROD-PRESERVE",
            quantity: 1,
            list_price: 100,
            unit_price: 72, // 100 * 0.9 * 0.8
          }),
          image_url: "https://cdn.example.com/test.jpg",
          brand: "Preserved Brand",
          promo_code: "PRESERVE-TEST",
          promo_label: "20% Off",
          promo_discount_pct: -20,
          discount_chain: discountChain,
        }),
        createParams({ id: order.order_id })
      );
      const addData = await addRes.json();
      const lineNumber = addData.item.line_number;

      // Act - Update quantity
      const res = await updateItems(
        createRequest("PATCH", { items: [{ line_number: lineNumber, quantity: 5 }] }),
        createParams({ id: order.order_id })
      );
      const data = await res.json();

      // Assert - Quantity updated, promo fields preserved
      expect(res.status).toBe(200);
      const updatedItem = data.order.items.find((i: { line_number: number }) => i.line_number === lineNumber);
      expect(updatedItem.quantity).toBe(5);
      expect(updatedItem.image_url).toBe("https://cdn.example.com/test.jpg");
      expect(updatedItem.brand).toBe("Preserved Brand");
      expect(updatedItem.promo_code).toBe("PRESERVE-TEST");
      expect(updatedItem.promo_label).toBe("20% Off");
      expect(updatedItem.promo_discount_pct).toBe(-20);
      expect(updatedItem.discount_chain).toHaveLength(2);
      expect(updatedItem.discount_chain[0].source).toBe("price_list");
      expect(updatedItem.discount_chain[1].source).toBe("promo");
    });
  });

  // ==========================================
  // DELETE /api/b2b/orders/[id]/items - Remove Items (batch)
  // ==========================================

  describe("DELETE /api/b2b/orders/[id]/items", () => {
    it("should remove item and recalculate order totals", async () => {
      /**
       * Test item removal with order totals reset.
       * New API uses line_number in body for identification.
       */
      // Arrange
      const cartRes = await getActiveCart(
        createRequest("GET", undefined, "http://localhost:3000/api/b2b/orders/active")
      );
      const { order } = await cartRes.json();

      const addRes = await addItem(
        createRequest("POST", LineItemFactory.createPayload({ entity_code: "PROD-001" })),
        createParams({ id: order.order_id })
      );
      const addData = await addRes.json();
      const lineNumber = addData.item.line_number;

      // Act - Use new batch format with line_numbers array
      const res = await removeItems(
        createRequest("DELETE", { line_numbers: [lineNumber] }),
        createParams({ id: order.order_id })
      );
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.order.items).toHaveLength(0);
      expect(data.order.order_total).toBe(0);
    });
  });

  // ==========================================
  // Order Totals Calculation
  // ==========================================

  describe("Order Totals Calculation", () => {
    it("should correctly aggregate multiple items", async () => {
      /**
       * Test order totals aggregation with multiple items.
       *
       * Item 1: qty=10, unit_price=80, vat=22%
       *   line_net=800, line_vat=176
       *
       * Item 2: qty=5, unit_price=50, vat=10%
       *   line_net=250, line_vat=25
       *
       * Order: subtotal_net=1050, total_vat=201, order_total=1251
       */
      // Arrange
      const cartRes = await getActiveCart(
        createRequest("GET", undefined, "http://localhost:3000/api/b2b/orders/active")
      );
      const { order } = await cartRes.json();

      // Act - Add two items
      await addItem(
        createRequest("POST", LineItemFactory.createPayload({
          entity_code: "PROD-001",
          quantity: 10,
          unit_price: 80,
          vat_rate: 22,
        })),
        createParams({ id: order.order_id })
      );

      const res = await addItem(
        createRequest("POST", LineItemFactory.createPayload({
          entity_code: "PROD-002",
          quantity: 5,
          list_price: 60,
          unit_price: 50,
          vat_rate: 10,
        })),
        createParams({ id: order.order_id })
      );
      const data = await res.json();

      // Assert
      expect(data.order.subtotal_net).toBe(1050);
      expect(data.order.total_vat).toBe(201);
      expect(data.order.order_total).toBe(1251);
    });
  });
});
