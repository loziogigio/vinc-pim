import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "./conftest";
import { OrderSchema } from "@/lib/db/models/order";
import { DepartureSchema } from "@/lib/db/models/departure";
import { BookingSchema } from "@/lib/db/models/booking";
import { PIMProductSchema } from "@/lib/db/models/pim-product";
import { nanoid } from "nanoid";
import {
  confirmOrder,
  cancelOrder,
  rejectQuotation,
  markExpiredQuotations,
} from "@/lib/services/order-lifecycle.service";

const OrderModel =
  mongoose.models.Order || mongoose.model("Order", OrderSchema);
const DepartureModel =
  mongoose.models.Departure || mongoose.model("Departure", DepartureSchema);
const BookingModel =
  mongoose.models.Booking || mongoose.model("Booking", BookingSchema);
const PIMProductModel =
  mongoose.models.PIMProduct || mongoose.model("PIMProduct", PIMProductSchema);

// Mock connectWithModels so booking.service uses our in-memory DB
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

// Mock non-essential services (windmill, snapshots, etc.)
vi.mock("@/lib/services/windmill-proxy.service", () => ({
  emitStatusChangeAfterHook: vi.fn(),
  tenantIdFromDbName: (dbName: string) => dbName.replace("vinc-", ""),
  buildHookCtxFromOrder: vi.fn(),
  runOnHookAuto: vi.fn(async () => ({ hooked: false })),
}));
vi.mock("@/lib/services/order-snapshot.service", () => ({
  populateOrderSnapshots: vi.fn(async () => {}),
}));
vi.mock("@/lib/services/coupon.service", () => ({
  confirmCouponUsage: vi.fn(async () => {}),
}));
vi.mock("@/lib/services/order.service", () => ({
  saveOrder: vi.fn(async (order: unknown) => {
    await (order as { save: () => Promise<void> }).save();
  }),
}));

function getTenantDb(): mongoose.Connection {
  return mongoose.connection;
}

async function createTestDeparture(available = 5) {
  await PIMProductModel.create({
    entity_code: "BOAT-LC-001",
    sku: "BOAT-LC-001",
    name: { it: "Barca" },
    status: "published",
    isCurrent: true,
    product_kind: "bookable",
    pricing: { list: 0 },
  });
  await PIMProductModel.create({
    entity_code: "CABIN-LC-A",
    sku: "CABIN-LC-A",
    name: { it: "Cabina" },
    status: "published",
    isCurrent: true,
    pricing: { list: 300, currency: "EUR" },
  });
  const dep = await DepartureModel.create({
    departure_id: nanoid(12),
    tenant_id: "test",
    product_entity_code: "BOAT-LC-001",
    label: "Test",
    status: "active",
    starts_at: new Date("2026-08-01"),
    hold_ttl_ms: 900000,
    resources: [
      {
        resource_id: nanoid(8),
        resource_type: "cabin",
        child_entity_code: "CABIN-LC-A",
        total_capacity: available,
        available,
        held: 0,
        booked: 0,
        price_override: 300,
        currency: "EUR",
      },
    ],
  });
  return dep;
}

async function createTestBooking(
  dep: mongoose.Document & {
    departure_id: string;
    resources: { resource_id: string }[];
  }
) {
  const booking = await BookingModel.create({
    booking_id: nanoid(12),
    tenant_id: "test",
    departure_id: dep.departure_id,
    resource_id: dep.resources[0].resource_id,
    child_entity_code: "CABIN-LC-A",
    departure_label: "Test",
    starts_at: new Date("2026-08-01"),
    customer_id: "guest",
    quantity: 1,
    unit_price: 300,
    currency: "EUR",
    total_price: 300,
    status: "held",
    hold_expires_at: new Date(Date.now() + 900000),
  });
  // Decrement available, increment held to match hold state
  await DepartureModel.updateOne(
    {
      departure_id: dep.departure_id,
      "resources.resource_id": dep.resources[0].resource_id,
    },
    { $inc: { "resources.$.available": -1, "resources.$.held": 1 } }
  );
  return booking;
}

async function createQuotationOrder(
  bookingId: string,
  dep: { departure_id: string; resources: { resource_id: string }[] }
) {
  const order = await OrderModel.create({
    order_id: nanoid(12),
    year: 2026,
    status: "quotation",
    tenant_id: "test",
    channel: "quotation",
    order_type: "quote",
    price_list_id: "default",
    price_list_type: "wholesale",
    currency: "EUR",
    session_id: nanoid(12),
    flow_id: nanoid(8),
    is_current: false,
    shipping_cost: 0,
    subtotal_gross: 300,
    subtotal_net: 300,
    total_discount: 0,
    total_vat: 0,
    order_total: 300,
    buyer: {
      email: "test@example.com",
      first_name: "Test",
      last_name: "User",
      customer_type: "private",
      is_guest: true,
    },
    public_token: nanoid(20),
    quotation: {
      quotation_number: `Q-2026-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`,
      quotation_status: "sent",
      valid_until: new Date(Date.now() + 30 * 86400000),
      days_valid: 30,
      current_revision: 0,
      revisions: [],
      total_rounds: 0,
      last_actor: "sales",
      last_activity_at: new Date(),
    },
    items: [
      {
        line_number: 10,
        entity_code: dep.resources[0].resource_id,
        sku: dep.resources[0].resource_id,
        name: "Cabina Test",
        product_source: "pim",
        departure_id: dep.departure_id,
        resource_id: dep.resources[0].resource_id,
        booking_id: bookingId,
        resource_type: "cabin",
        quantity: 1,
        list_price: 300,
        unit_price: 300,
        vat_rate: 0,
        vat_included: false,
        line_gross: 300,
        line_net: 300,
        line_vat: 0,
        line_total: 300,
        discounts: [],
        total_discount_percent: 0,
        is_gift_line: false,
        added_at: new Date(),
        updated_at: new Date(),
      },
    ],
  });
  return order;
}

beforeAll(async () => {
  await setupTestDatabase();
});
afterAll(async () => {
  await teardownTestDatabase();
});
beforeEach(async () => {
  await clearDatabase();
  vi.restoreAllMocks();
});

describe("confirmOrder — confirms held booking", () => {
  it("moves booking from held to confirmed and decrements held counter", async () => {
    const dep = await createTestDeparture();
    const booking = await createTestBooking(
      dep as unknown as mongoose.Document & {
        departure_id: string;
        resources: { resource_id: string }[];
      }
    );
    const order = await createQuotationOrder(
      booking.booking_id,
      dep as unknown as {
        departure_id: string;
        resources: { resource_id: string }[];
      }
    );

    // Set quotation to accepted so confirmOrder allows it
    await OrderModel.updateOne(
      { order_id: order.order_id },
      { $set: { "quotation.quotation_status": "accepted" } }
    );

    const result = await confirmOrder(
      getTenantDb(),
      order.order_id,
      "admin-1",
      "admin"
    );
    expect(result.success).toBe(true);

    // Booking is now confirmed
    const updatedBooking = await BookingModel.findOne({
      booking_id: booking.booking_id,
    }).lean();
    expect(updatedBooking!.status).toBe("confirmed");

    // Departure: held decremented, booked incremented
    const updatedDep = await DepartureModel.findOne({
      departure_id: dep.departure_id,
    }).lean();
    const resource = (updatedDep!.resources as unknown[]).find(
      (r: unknown) =>
        (r as { resource_id: string }).resource_id ===
        dep.resources[0].resource_id
    ) as { held: number; booked: number };
    expect(resource.held).toBe(0);
    expect(resource.booked).toBe(1);
  });
});

describe("cancelOrder — releases held booking", () => {
  it("cancels booking and returns capacity", async () => {
    const dep = await createTestDeparture();
    const booking = await createTestBooking(
      dep as unknown as mongoose.Document & {
        departure_id: string;
        resources: { resource_id: string }[];
      }
    );
    const order = await createQuotationOrder(
      booking.booking_id,
      dep as unknown as {
        departure_id: string;
        resources: { resource_id: string }[];
      }
    );

    const result = await cancelOrder(
      getTenantDb(),
      order.order_id,
      "admin-1",
      "admin"
    );
    expect(result.success).toBe(true);

    // Booking is cancelled
    const updatedBooking = await BookingModel.findOne({
      booking_id: booking.booking_id,
    }).lean();
    expect(updatedBooking!.status).toBe("cancelled");

    // Capacity returned
    const updatedDep = await DepartureModel.findOne({
      departure_id: dep.departure_id,
    }).lean();
    const resource = (updatedDep!.resources as unknown[]).find(
      (r: unknown) =>
        (r as { resource_id: string }).resource_id ===
        dep.resources[0].resource_id
    ) as { available: number; held: number };
    expect(resource.available).toBe(5); // fully returned
    expect(resource.held).toBe(0);
  });
});

describe("rejectQuotation — releases held booking", () => {
  it("rejects and releases held capacity", async () => {
    const dep = await createTestDeparture();
    const booking = await createTestBooking(
      dep as unknown as mongoose.Document & {
        departure_id: string;
        resources: { resource_id: string }[];
      }
    );
    const order = await createQuotationOrder(
      booking.booking_id,
      dep as unknown as {
        departure_id: string;
        resources: { resource_id: string }[];
      }
    );

    const result = await rejectQuotation(
      getTenantDb(),
      order.order_id,
      "customer-1"
    );
    expect(result.success).toBe(true);

    const updatedBooking = await BookingModel.findOne({
      booking_id: booking.booking_id,
    }).lean();
    expect(updatedBooking!.status).toBe("cancelled");

    const updatedDep = await DepartureModel.findOne({
      departure_id: dep.departure_id,
    }).lean();
    const resource = (updatedDep!.resources as unknown[]).find(
      (r: unknown) =>
        (r as { resource_id: string }).resource_id ===
        dep.resources[0].resource_id
    ) as { available: number };
    expect(resource.available).toBe(5);
  });
});

describe("markExpiredQuotations — releases held bookings on expiry", () => {
  it("marks expired and releases held bookings", async () => {
    const dep = await createTestDeparture();
    const booking = await createTestBooking(
      dep as unknown as mongoose.Document & {
        departure_id: string;
        resources: { resource_id: string }[];
      }
    );

    // Create a quotation with valid_until in the past
    const order = await createQuotationOrder(
      booking.booking_id,
      dep as unknown as {
        departure_id: string;
        resources: { resource_id: string }[];
      }
    );
    await OrderModel.updateOne(
      { order_id: order.order_id },
      { $set: { "quotation.valid_until": new Date(Date.now() - 1000) } }
    );

    const result = await markExpiredQuotations(getTenantDb());
    expect(result.count).toBeGreaterThanOrEqual(1);

    // Booking is cancelled
    const updatedBooking = await BookingModel.findOne({
      booking_id: booking.booking_id,
    }).lean();
    expect(updatedBooking!.status).toBe("cancelled");

    // Capacity returned
    const updatedDep = await DepartureModel.findOne({
      departure_id: dep.departure_id,
    }).lean();
    const resource = (updatedDep!.resources as unknown[]).find(
      (r: unknown) =>
        (r as { resource_id: string }).resource_id ===
        dep.resources[0].resource_id
    ) as { available: number };
    expect(resource.available).toBe(5);
  });
});
