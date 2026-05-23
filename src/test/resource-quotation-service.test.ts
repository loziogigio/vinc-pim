import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "./conftest";
import { OrderSchema } from "@/lib/db/models/order";
import { DepartureSchema } from "@/lib/db/models/departure";
import { BookingSchema } from "@/lib/db/models/booking";
import { PIMProductSchema } from "@/lib/db/models/pim-product";
import * as ocApi from "@/lib/oc-api/client";
import { createDeparture } from "@/lib/services/booking.service";

// Register models on default mongoose connection (used by setupTestDatabase)
const OrderModel =
  mongoose.models.Order || mongoose.model("Order", OrderSchema);
const DepartureModel =
  mongoose.models.Departure || mongoose.model("Departure", DepartureSchema);
const BookingModel =
  mongoose.models.Booking || mongoose.model("Booking", BookingSchema);
const PIMProductModel =
  mongoose.models.PIMProduct || mongoose.model("PIMProduct", PIMProductSchema);

// Mock connectWithModels so the service uses our in-memory DB connection
vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn(() =>
    Promise.resolve({
      Order: OrderModel,
      Departure: DepartureModel,
      Booking: BookingModel,
      PIMProduct: PIMProductModel,
    })
  ),
}));

// Mock order-lifecycle functions that depend on DB internals
// (We test lifecycle integration in a separate file T4)
vi.mock("@/lib/services/order-lifecycle.service", async (orig) => {
  const actual = await orig<typeof import("@/lib/services/order-lifecycle.service")>();
  return {
    ...actual,
    convertToQuotation: vi.fn(async (tenantDb: mongoose.Connection, orderId: string, _userId: string, opts: unknown) => {
      // Simulate convertToQuotation: set status=quotation and quotation data
      const Order = tenantDb.models.Order || mongoose.model("Order", OrderSchema);
      const order = await Order.findOne({ order_id: orderId });
      if (!order) return { success: false, error: "not found" };
      const year = new Date().getFullYear();
      order.status = "quotation";
      order.quotation = {
        quotation_number: `Q-${year}-00001`,
        quotation_status: "draft",
        valid_until: new Date(Date.now() + 30 * 86400000),
        days_valid: (opts as { daysValid?: number })?.daysValid ?? 30,
        current_revision: 0,
        revisions: [],
        total_rounds: 0,
        last_actor: "sales",
        last_activity_at: new Date(),
      };
      await order.save();
      return { success: true, order };
    }),
  };
});

import {
  createResourceQuotation,
  getResourceQuotationByToken,
} from "@/lib/services/resource-quotation.service";

const TENANT_DB_NAME = "vinc-test";
const TENANT = "test";

const AVAIL = {
  source: "msc",
  oc_cruise_id: 6,
  category: "IR1",
  available: true,
  cabins_available: 128,
  guarantees_available: 0,
  price_code: "VIC00719IT6024EA",
  price: {
    currency: "EUR",
    per_pax: [{ pax_no: 1, type: "ADT", amount: "979.00" }],
    total_gross: "979.00",
    taxes: "0",
    commission: "166.43",
  },
};

// Get the tenantDb connection (default mongoose connection used by in-memory DB)
function getTenantDb(): mongoose.Connection {
  return mongoose.connection;
}

beforeAll(async () => { await setupTestDatabase(); });
afterAll(async () => { await teardownTestDatabase(); });
beforeEach(async () => { await clearDatabase(); vi.restoreAllMocks(); });

describe("createResourceQuotation — external/cruise mode", () => {
  it("creates a quotation with OC snapshot, sets public_token", async () => {
    vi.spyOn(ocApi, "getOCApiForTenant").mockReturnValue({
      getCruiseAvailability: vi.fn(async () => AVAIL),
    } as unknown as ReturnType<typeof ocApi.getOCApiForTenant>);

    const result = await createResourceQuotation(getTenantDb(), TENANT, {
      customer: { name: "Mario Rossi", email: "mario@example.com", phone: "+39000" },
      lines: [{
        mode: "external",
        source: "msc",
        resource_type: "cabin",
        label: "Cabina Interna IR1",
        cruise: { oc_cruise_id: 6, category: "IR1", adults: 2, children: 0 },
      }],
    });

    expect(result.success).toBe(true);
    expect(result.data?.public_token).toBeTruthy();
    expect(result.data?.quotation_number).toMatch(/^Q-\d{4}-/);
    expect(result.data?.order_id).toBeTruthy();

    // Verify the order was persisted
    const order = await OrderModel.findOne({ order_id: result.data!.order_id }).lean();
    expect(order).not.toBeNull();
    expect(order!.public_token).toBe(result.data!.public_token);
    expect(order!.status).toBe("quotation");

    // Line has OC snapshot with numeric price
    const line = (order!.items as unknown[])[0] as Record<string, unknown>;
    expect(line.resource_type).toBe("cabin");
    expect(line.source).toBe("msc");
    const snap = line.quote_snapshot as Record<string, unknown>;
    expect(snap).toBeDefined();
    const price = snap.price as Record<string, unknown>;
    expect(typeof price.total_gross).toBe("number"); // parsed from decimal string
    expect(price.total_gross).toBeCloseTo(979, 0);
  });

  it("degrades to oc_unavailable when OC fails — never loses the lead", async () => {
    vi.spyOn(ocApi, "getOCApiForTenant").mockReturnValue({
      getCruiseAvailability: vi.fn(async () => { throw new ocApi.OCApiError(502, "down"); }),
    } as unknown as ReturnType<typeof ocApi.getOCApiForTenant>);

    const result = await createResourceQuotation(getTenantDb(), TENANT, {
      customer: { name: "Giulia Verdi", email: "g@example.com" },
      lines: [{
        mode: "external",
        source: "msc",
        resource_type: "cabin",
        label: "Cabina IR1",
        cruise: { oc_cruise_id: 6, category: "IR1", adults: 1, children: 0 },
      }],
    });

    expect(result.success).toBe(true);
    expect(result.data?.public_token).toBeTruthy();

    const order = await OrderModel.findOne({ order_id: result.data!.order_id }).lean();
    const line = (order!.items as unknown[])[0] as Record<string, unknown>;
    const snap = line.quote_snapshot as Record<string, unknown>;
    const avail = snap.availability as Record<string, unknown>;
    expect(avail.source_status).toBe("oc_unavailable");
  });

  it("splits customer name correctly", async () => {
    vi.spyOn(ocApi, "getOCApiForTenant").mockReturnValue({
      getCruiseAvailability: vi.fn(async () => AVAIL),
    } as unknown as ReturnType<typeof ocApi.getOCApiForTenant>);

    const result = await createResourceQuotation(getTenantDb(), TENANT, {
      customer: { name: "Mario Rossi Bianchi", email: "m@example.com" },
      lines: [{
        mode: "external", source: "msc", resource_type: "cabin",
        label: "X", cruise: { oc_cruise_id: 6, category: "IR1", adults: 1, children: 0 },
      }],
    });
    const order = await OrderModel.findOne({ order_id: result.data!.order_id }).lean();
    expect(order!.buyer?.first_name).toBe("Mario");
    expect(order!.buyer?.last_name).toBe("Rossi Bianchi");
    expect(order!.buyer?.is_guest).toBe(true);
  });
});

describe("getResourceQuotationByToken", () => {
  it("returns customer-safe quotation (no commission, no internal_notes, no payment)", async () => {
    vi.spyOn(ocApi, "getOCApiForTenant").mockReturnValue({
      getCruiseAvailability: vi.fn(async () => AVAIL),
    } as unknown as ReturnType<typeof ocApi.getOCApiForTenant>);

    const created = await createResourceQuotation(getTenantDb(), TENANT, {
      customer: { name: "Anna Neri", email: "anna@example.com" },
      lines: [{
        mode: "external", source: "msc", resource_type: "cabin",
        label: "Cabina", cruise: { oc_cruise_id: 6, category: "IR1", adults: 2, children: 0 },
      }],
    });
    const token = created.data!.public_token;

    const result = await getResourceQuotationByToken(getTenantDb(), token);
    expect(result.success).toBe(true);

    const data = result.data!;
    // Assert fields present
    expect(data.quotation_number).toBeTruthy();
    expect(data.status).toBe("quotation");
    expect(data.public_token).toBe(token);

    // Assert sensitive fields ABSENT
    expect("commission" in data).toBe(false);
    expect("internal_notes" in data).toBe(false);
    expect("payment" in data).toBe(false);
    expect("customer_id" in data).toBe(false);

    // Lines present — commission stripped from quote_snapshot.price
    const lines = data.lines as Record<string, unknown>[];
    expect(lines.length).toBe(1);
    const lineSnap = (lines[0].quote_snapshot as Record<string, unknown> | undefined);
    if (lineSnap?.price) {
      expect("commission" in (lineSnap.price as object)).toBe(false);
    }

    // raw_data and erp_data absent from lines
    expect("raw_data" in lines[0]).toBe(false);
    expect("erp_data" in lines[0]).toBe(false);
    expect("list_price" in lines[0]).toBe(false);

    // Deep guard: NO operator-only field anywhere in the customer-safe payload
    // (the OC mock includes price.commission and price_code).
    const fullJson = JSON.stringify(data);
    expect(fullJson).not.toContain("commission");
    expect(fullJson).not.toContain("price_code");

    // Customer-facing availability + price ARE present on the line.
    const snap0 = lines[0].quote_snapshot as Record<string, unknown>;
    const avail0 = snap0.availability as Record<string, unknown>;
    expect(avail0.available).toBe(true);
    expect((snap0.price as Record<string, unknown>).total_gross).toBeCloseTo(979, 0);
  });

  it("returns 404 for unknown token", async () => {
    const result = await getResourceQuotationByToken(getTenantDb(), "no-such-token");
    expect(result.success).toBe(false);
    expect(result.status).toBe(404);
  });
});

describe("createResourceQuotation — bookable mode", () => {
  async function seedDeparture() {
    // Create parent PIM product (bookable)
    await PIMProductModel.create({
      entity_code: "BOAT-001",
      sku: "BOAT-001",
      name: { it: "Barca Test", en: "Test Boat" },
      status: "published",
      isCurrent: true,
      product_kind: "bookable",
      pricing: { list: 0 },
    });
    // Create child PIM product (resource type)
    await PIMProductModel.create({
      entity_code: "CABIN-A",
      sku: "CABIN-A",
      name: { it: "Cabina A", en: "Cabin A" },
      status: "published",
      isCurrent: true,
      pricing: { list: 250, currency: "EUR" },
    });

    const result = await createDeparture(TENANT_DB_NAME, TENANT, {
      product_entity_code: "BOAT-001",
      label: "Test Departure 2026",
      starts_at: "2026-08-01T10:00:00Z",
      resources: [{
        resource_type: "cabin",
        child_entity_code: "CABIN-A",
        total_capacity: 5,
        price_override: 250,
        currency: "EUR",
      }],
    });

    if (!result.success || !result.data) {
      throw new Error("Failed to create test departure: " + result.error);
    }

    // Activate the departure (holdBooking requires status="active")
    await DepartureModel.updateOne(
      { departure_id: result.data.departure_id },
      { $set: { status: "active" } }
    );

    return result.data;
  }

  it("places a real hold and stores booking_id on the line", async () => {
    const departure = await seedDeparture();
    const resourceId = departure.resources[0].resource_id;

    const result = await createResourceQuotation(getTenantDb(), TENANT, {
      customer: { name: "Luca Blu", email: "luca@example.com" },
      lines: [{
        mode: "bookable",
        departure_id: departure.departure_id,
        resource_id: resourceId,
        quantity: 1,
        label: "Cabina Test",
      }],
    });

    expect(result.success).toBe(true);

    // Line has booking_id
    const order = await OrderModel.findOne({ order_id: result.data!.order_id }).lean();
    const line = (order!.items as unknown[])[0] as Record<string, unknown>;
    expect(line.booking_id).toBeTruthy();
    expect(line.departure_id).toBe(departure.departure_id);
    expect(line.resource_id).toBe(resourceId);

    // Departure capacity was decremented
    const dep = await DepartureModel.findOne({ departure_id: departure.departure_id }).lean();
    const resource = (dep!.resources as unknown[]).find(
      (r: unknown) => (r as { resource_id: string }).resource_id === resourceId
    ) as { available: number; held: number };
    expect(resource.available).toBe(4); // 5 - 1
    expect(resource.held).toBe(1);

    // Booking exists in held status
    const booking = await BookingModel.findOne({ booking_id: line.booking_id }).lean();
    expect(booking).not.toBeNull();
    expect(booking!.status).toBe("held");
  });

  it("degrades gracefully when no capacity (hold fails)", async () => {
    const departure = await seedDeparture();
    // Drain all capacity by manually setting available=0
    await DepartureModel.updateOne(
      { departure_id: departure.departure_id },
      { $set: { "resources.0.available": 0 } }
    );

    const result = await createResourceQuotation(getTenantDb(), TENANT, {
      customer: { name: "Sofia Rosa", email: "sofia@example.com" },
      lines: [{
        mode: "bookable",
        departure_id: departure.departure_id,
        resource_id: departure.resources[0].resource_id,
        quantity: 1,
        label: "Cabina Test",
      }],
    });

    // Quotation still created (never lose the lead)
    expect(result.success).toBe(true);
    const order = await OrderModel.findOne({ order_id: result.data!.order_id }).lean();
    const line = (order!.items as unknown[])[0] as Record<string, unknown>;
    expect(line.booking_id).toBeUndefined();
    const snap = line.quote_snapshot as Record<string, unknown>;
    const avail = snap.availability as Record<string, unknown>;
    expect(avail.source_status).toBe("no_capacity");
  });
});
