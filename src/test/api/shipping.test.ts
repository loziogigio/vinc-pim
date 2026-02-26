/**
 * Integration Tests — Shipping Configuration & Order Shipping
 *
 * Covers:
 *   - GET/PUT /api/b2b/shipping-config
 *   - GET /api/b2b/orders/[id]/shipping-options
 *   - POST /api/b2b/orders/[id]/shipping
 *
 * Uses the Italy example from the spec:
 *   Method A — Pick up:         any basket → €0
 *   Method B — Pay at delivery: basket >= €100 → €7, else → €17
 *   Method C — Home delivery:   basket >= €100 → €0 (free), else → €7
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
  createRequest,
  createParams,
  OrderFactory,
  CustomerFactory,
} from "../conftest";
import { ShippingConfigSchema } from "@/lib/db/models/shipping-config";
import { CustomerSchema } from "@/lib/db/models/customer";
import { OrderSchema } from "@/lib/db/models/order";

// ============================================
// MODELS
// ============================================

const ShippingConfigModel =
  mongoose.models.ShippingConfig ||
  mongoose.model("ShippingConfig", ShippingConfigSchema);

const CustomerModel =
  mongoose.models.Customer ||
  mongoose.model("Customer", CustomerSchema);

const OrderModel =
  mongoose.models.Order ||
  mongoose.model("Order", OrderSchema);

// ============================================
// MOCKS — must be before route imports
// ============================================

vi.mock("@/lib/auth/b2b-session", () => ({
  getB2BSession: vi.fn(() =>
    Promise.resolve({
      isLoggedIn: true,
      userId: "test-admin",
      tenantId: "test-tenant",
    })
  ),
}));

vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn(() =>
    Promise.resolve({
      ShippingConfig: ShippingConfigModel,
      Customer: CustomerModel,
      Order: OrderModel,
    })
  ),
}));

// ============================================
// ROUTE IMPORTS — after mocks
// ============================================

import {
  GET as getShippingConfig,
  PUT as putShippingConfig,
} from "@/app/api/b2b/shipping-config/route";
import { GET as getShippingOptions } from "@/app/api/b2b/orders/[id]/shipping-options/route";
import { POST as applyShipping } from "@/app/api/b2b/orders/[id]/shipping/route";

// ============================================
// FIXTURES
// ============================================

/** Italy shipping config from the spec */
const italyConfig = {
  zones: [
    {
      zone_id: "",
      name: "Italy",
      countries: ["IT"],
      methods: [
        {
          method_id: "",
          name: "Pick up",
          tiers: [{ min_subtotal: 0, rate: 0 }],
          enabled: true,
        },
        {
          method_id: "",
          name: "Pay at delivery",
          tiers: [
            { min_subtotal: 100, rate: 7 },
            { min_subtotal: 0, rate: 17 },
          ],
          enabled: true,
        },
        {
          method_id: "",
          name: "Home delivery",
          tiers: [
            { min_subtotal: 100, rate: 0 },
            { min_subtotal: 0, rate: 7 },
          ],
          enabled: true,
        },
      ],
    },
    {
      zone_id: "",
      name: "Rest of World",
      countries: ["*"],
      methods: [
        {
          method_id: "",
          name: "International",
          carrier: "DHL",
          tiers: [{ min_subtotal: 0, rate: 25 }],
          enabled: true,
        },
      ],
    },
  ],
};

/** Create a customer with an Italian delivery address */
async function createItalianCustomer(customerId: string) {
  return CustomerModel.create({
    customer_id: customerId,
    tenant_id: "test-tenant",
    ...CustomerFactory.createWithAddress({
      email: `${customerId}@test.com`,
      addresses: [
        {
          address_id: "addr-it-01",
          address_type: "delivery",
          recipient_name: "Mario Rossi",
          street_address: "Via Roma 1",
          city: "Milano",
          province: "MI",
          postal_code: "20100",
          country: "IT",
          is_default: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      default_shipping_address_id: "addr-it-01",
    }),
  });
}

/** Create a draft order linked to the customer and address */
async function createDraftOrder(
  orderId: string,
  customerId: string,
  subtotalNet: number
) {
  return OrderModel.create({
    order_id: orderId,
    tenant_id: "test-tenant",
    customer_id: customerId,
    shipping_address_id: "addr-it-01",
    status: "draft",
    order_type: "b2b",
    channel: "b2b-portal",
    session_id: "sess_test",
    flow_id: "flow_test",
    source: "web",
    currency: "EUR",
    price_list_id: "default",
    price_list_type: "wholesale",
    year: new Date().getFullYear(),
    subtotal_gross: subtotalNet * 1.22,
    subtotal_net: subtotalNet,
    total_vat: subtotalNet * 0.22,
    total_discount: 0,
    shipping_cost: 0,
    order_total: subtotalNet * 1.22,
    items: [],
  });
}

// ============================================
// TESTS
// ============================================

describe("integration: Shipping Config API", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    vi.clearAllMocks();
  });

  // ------------------------------------------
  describe("GET /api/b2b/shipping-config", () => {
    it("returns empty zones when no config exists", async () => {
      const req = createRequest("GET");
      const res = await getShippingConfig(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.zones).toEqual([]);
    });

    it("returns saved config after PUT", async () => {
      // Seed via PUT
      await putShippingConfig(createRequest("PUT", italyConfig));

      const req = createRequest("GET");
      const res = await getShippingConfig(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.zones).toHaveLength(2);
      expect(data.data.zones[0].name).toBe("Italy");
      expect(data.data.zones[0].methods).toHaveLength(3);
    });
  });

  // ------------------------------------------
  describe("PUT /api/b2b/shipping-config", () => {
    it("saves a valid config and generates IDs", async () => {
      const req = createRequest("PUT", italyConfig);
      const res = await putShippingConfig(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);

      const italy = data.data.zones[0];
      expect(italy.zone_id).toBeTruthy(); // ID generated by pre-save hook
      expect(italy.methods[0].method_id).toBeTruthy();
    });

    it("replaces config on second PUT (idempotent upsert)", async () => {
      await putShippingConfig(createRequest("PUT", italyConfig));

      const updatedConfig = {
        zones: [
          {
            zone_id: "",
            name: "Italy Updated",
            countries: ["IT"],
            methods: [
              {
                method_id: "",
                name: "Pick up",
                tiers: [{ min_subtotal: 0, rate: 0 }],
                enabled: true,
              },
            ],
          },
        ],
      };

      const res = await putShippingConfig(createRequest("PUT", updatedConfig));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.zones).toHaveLength(1);
      expect(data.data.zones[0].name).toBe("Italy Updated");
    });

    it("rejects a method missing a min_subtotal: 0 base tier", async () => {
      const badConfig = {
        zones: [
          {
            zone_id: "",
            name: "Italy",
            countries: ["IT"],
            methods: [
              {
                method_id: "",
                name: "Bad method",
                // Missing tier with min_subtotal: 0
                tiers: [{ min_subtotal: 50, rate: 10 }],
                enabled: true,
              },
            ],
          },
        ],
      };

      const req = createRequest("PUT", badConfig);
      const res = await putShippingConfig(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("min_subtotal: 0");
    });

    it("rejects a zone missing country codes", async () => {
      const badConfig = {
        zones: [{ zone_id: "", name: "Empty Zone", countries: [], methods: [] }],
      };

      const req = createRequest("PUT", badConfig);
      const res = await putShippingConfig(req);

      expect(res.status).toBe(400);
    });

    it("rejects body with no zones array", async () => {
      const req = createRequest("PUT", { notZones: true });
      const res = await putShippingConfig(req);

      expect(res.status).toBe(400);
    });
  });
});

// ============================================

describe("integration: Order Shipping Options", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    vi.clearAllMocks();
    // Seed the Italy config before each test
    await ShippingConfigModel.create(italyConfig);
  });

  // ------------------------------------------
  describe("GET /api/b2b/orders/[id]/shipping-options", () => {
    it("returns options for Italian address — subtotal 80 (below threshold)", async () => {
      await createItalianCustomer("cust-001");
      await createDraftOrder("order-001", "cust-001", 80);

      const req = createRequest("GET");
      const res = await getShippingOptions(req, createParams({ id: "order-001" }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.zone_name).toBe("Italy");

      const byName = Object.fromEntries(
        data.data.options.map((o: { name: string }) => [o.name, o])
      );
      // Pick up always free
      expect(byName["Pick up"].computed_cost).toBe(0);
      expect(byName["Pick up"].is_free).toBe(true);
      // Pay at delivery: below 100 → €17
      expect(byName["Pay at delivery"].computed_cost).toBe(17);
      expect(byName["Pay at delivery"].is_free).toBe(false);
      // Home delivery: below 100 → €7
      expect(byName["Home delivery"].computed_cost).toBe(7);
      expect(byName["Home delivery"].is_free).toBe(false);
    });

    it("returns options for Italian address — subtotal 120 (above threshold)", async () => {
      await createItalianCustomer("cust-002");
      await createDraftOrder("order-002", "cust-002", 120);

      const req = createRequest("GET");
      const res = await getShippingOptions(req, createParams({ id: "order-002" }));
      const data = await res.json();

      expect(res.status).toBe(200);

      const byName = Object.fromEntries(
        data.data.options.map((o: { name: string }) => [o.name, o])
      );
      // Pay at delivery: above 100 → €7
      expect(byName["Pay at delivery"].computed_cost).toBe(7);
      // Home delivery: above 100 → free
      expect(byName["Home delivery"].computed_cost).toBe(0);
      expect(byName["Home delivery"].is_free).toBe(true);
    });

    it("falls through to wildcard zone for non-IT address", async () => {
      // Create customer with German address
      await CustomerModel.create({
        customer_id: "cust-de",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "de@test.com",
        addresses: [
          {
            address_id: "addr-de",
            address_type: "delivery",
            recipient_name: "Hans Mueller",
            street_address: "Hauptstrasse 1",
            city: "Berlin",
            province: "BE",
            postal_code: "10115",
            country: "DE",
            is_default: true,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        default_shipping_address_id: "addr-de",
      });

      await OrderModel.create({
        order_id: "order-de",
        tenant_id: "test-tenant",
        customer_id: "cust-de",
        shipping_address_id: "addr-de",
        status: "draft",
        order_type: "b2b",
        channel: "b2b-portal",
        session_id: "sess_de",
        flow_id: "flow_de",
        source: "web",
        currency: "EUR",
        price_list_id: "default",
        price_list_type: "wholesale",
        year: new Date().getFullYear(),
        subtotal_gross: 60,
        subtotal_net: 50,
        total_vat: 10,
        total_discount: 0,
        shipping_cost: 0,
        order_total: 60,
        items: [],
      });

      const req = createRequest("GET");
      const res = await getShippingOptions(req, createParams({ id: "order-de" }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.zone_name).toBe("Rest of World");
      expect(data.data.options).toHaveLength(1);
      expect(data.data.options[0].name).toBe("International");
      expect(data.data.options[0].computed_cost).toBe(25);
    });

    it("returns empty options when order has no shipping address", async () => {
      await OrderModel.create({
        order_id: "order-no-addr",
        tenant_id: "test-tenant",
        customer_id: "cust-x",
        status: "draft",
        order_type: "b2b",
        channel: "b2b-portal",
        session_id: "sess_x",
        flow_id: "flow_x",
        source: "web",
        currency: "EUR",
        price_list_id: "default",
        price_list_type: "wholesale",
        year: new Date().getFullYear(),
        subtotal_gross: 0,
        subtotal_net: 0,
        total_vat: 0,
        total_discount: 0,
        shipping_cost: 0,
        order_total: 0,
        items: [],
      });

      const req = createRequest("GET");
      const res = await getShippingOptions(req, createParams({ id: "order-no-addr" }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.options).toHaveLength(0);
      expect(data.data.zone_name).toBeNull();
    });

    it("returns 404 for non-existent order", async () => {
      const req = createRequest("GET");
      const res = await getShippingOptions(req, createParams({ id: "no-such-order" }));

      expect(res.status).toBe(404);
    });
  });
});

// ============================================

describe("integration: Apply Shipping to Order", () => {
  let pickupMethodId: string;
  let payAtDeliveryMethodId: string;
  let homeDeliveryMethodId: string;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    vi.clearAllMocks();

    // Seed config and capture generated method IDs
    const saved = await ShippingConfigModel.create(italyConfig);
    const italyZone = saved.zones[0];
    pickupMethodId = italyZone.methods[0].method_id;
    payAtDeliveryMethodId = italyZone.methods[1].method_id;
    homeDeliveryMethodId = italyZone.methods[2].method_id;
  });

  // ------------------------------------------
  describe("POST /api/b2b/orders/[id]/shipping", () => {
    it("applies pick-up method (always €0) and recalculates order_total", async () => {
      await createItalianCustomer("cust-p1");
      await createDraftOrder("order-p1", "cust-p1", 80);

      const req = createRequest("POST", { method_id: pickupMethodId });
      const res = await applyShipping(req, createParams({ id: "order-p1" }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.shipping_method).toBe("Pick up");
      expect(data.data.shipping_cost).toBe(0);
      // order_total = subtotal_net (80) + vat (80*0.22=17.6) + shipping (0) = 97.6
      expect(data.data.order_total).toBeCloseTo(97.6, 1);
    });

    it("applies pay-at-delivery on basket 80 → shipping €17", async () => {
      await createItalianCustomer("cust-p2");
      await createDraftOrder("order-p2", "cust-p2", 80);

      const req = createRequest("POST", { method_id: payAtDeliveryMethodId });
      const res = await applyShipping(req, createParams({ id: "order-p2" }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.shipping_cost).toBe(17);
      // order_total = 80 + 17.6 + 17 = 114.6
      expect(data.data.order_total).toBeCloseTo(114.6, 1);
    });

    it("applies pay-at-delivery on basket 120 → shipping €7", async () => {
      await createItalianCustomer("cust-p3");
      await createDraftOrder("order-p3", "cust-p3", 120);

      const req = createRequest("POST", { method_id: payAtDeliveryMethodId });
      const res = await applyShipping(req, createParams({ id: "order-p3" }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.shipping_cost).toBe(7);
    });

    it("applies home-delivery on basket 120 → free shipping, order_total unchanged from net+vat", async () => {
      await createItalianCustomer("cust-p4");
      await createDraftOrder("order-p4", "cust-p4", 120);

      const req = createRequest("POST", { method_id: homeDeliveryMethodId });
      const res = await applyShipping(req, createParams({ id: "order-p4" }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.shipping_method).toBe("Home delivery");
      expect(data.data.shipping_cost).toBe(0);
      // order_total = 120 + 26.4 + 0 = 146.4
      expect(data.data.order_total).toBeCloseTo(146.4, 1);
    });

    it("applying a method twice updates to the new cost", async () => {
      await createItalianCustomer("cust-p5");
      await createDraftOrder("order-p5", "cust-p5", 80);

      // First: pick up → €0
      await applyShipping(
        createRequest("POST", { method_id: pickupMethodId }),
        createParams({ id: "order-p5" })
      );

      // Second: home delivery → €7
      const res = await applyShipping(
        createRequest("POST", { method_id: homeDeliveryMethodId }),
        createParams({ id: "order-p5" })
      );
      const data = await res.json();

      expect(data.data.shipping_cost).toBe(7);
    });

    it("rejects applying a method to a non-draft order", async () => {
      await createItalianCustomer("cust-p6");
      await OrderModel.create({
        order_id: "order-confirmed",
        tenant_id: "test-tenant",
        customer_id: "cust-p6",
        shipping_address_id: "addr-it-01",
        status: "confirmed",
        order_type: "b2b",
        channel: "b2b-portal",
        session_id: "sess_x",
        flow_id: "flow_x",
        source: "web",
        currency: "EUR",
        price_list_id: "default",
        price_list_type: "wholesale",
        year: new Date().getFullYear(),
        subtotal_gross: 0,
        subtotal_net: 0,
        total_vat: 0,
        total_discount: 0,
        shipping_cost: 0,
        order_total: 0,
        items: [],
      });

      const req = createRequest("POST", { method_id: pickupMethodId });
      const res = await applyShipping(req, createParams({ id: "order-confirmed" }));

      expect(res.status).toBe(400);
    });

    it("rejects an unknown method_id", async () => {
      await createItalianCustomer("cust-p7");
      await createDraftOrder("order-p7", "cust-p7", 80);

      const req = createRequest("POST", { method_id: "no-such-method" });
      const res = await applyShipping(req, createParams({ id: "order-p7" }));

      expect(res.status).toBe(404);
    });

    it("rejects when method_id is missing from body", async () => {
      await createItalianCustomer("cust-p8");
      await createDraftOrder("order-p8", "cust-p8", 80);

      const req = createRequest("POST", {});
      const res = await applyShipping(req, createParams({ id: "order-p8" }));

      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent order", async () => {
      const req = createRequest("POST", { method_id: pickupMethodId });
      const res = await applyShipping(req, createParams({ id: "ghost-order" }));

      expect(res.status).toBe(404);
    });
  });
});
