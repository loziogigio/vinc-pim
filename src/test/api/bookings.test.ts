/**
 * Integration Tests — Bookings & Departures
 *
 * Covers:
 *   - POST/GET /api/b2b/departures — create and list departures
 *   - GET/PATCH/DELETE /api/b2b/departures/[id] — single departure CRUD
 *   - POST/GET /api/b2b/bookings — hold booking and list
 *   - POST /api/b2b/bookings/[id]/confirm — confirm a held booking
 *   - POST /api/b2b/bookings/[id]/cancel — cancel a booking
 *   - Concurrent capacity management
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
  createRequest,
  createParams,
} from "../conftest";
import { DepartureSchema } from "@/lib/db/models/departure";
import { BookingSchema } from "@/lib/db/models/booking";
import { PIMProductSchema } from "@/lib/db/models/pim-product";

// ============================================
// MODELS
// ============================================

const DepartureModel =
  mongoose.models.Departure ||
  mongoose.model("Departure", DepartureSchema);

const BookingModel =
  mongoose.models.Booking ||
  mongoose.model("Booking", BookingSchema);

const PIMProductModel =
  mongoose.models.PIMProduct ||
  mongoose.model("PIMProduct", PIMProductSchema);

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
      Departure: DepartureModel,
      Booking: BookingModel,
      PIMProduct: PIMProductModel,
    })
  ),
}));

vi.mock("@/lib/queue/booking-expiry-worker", () => ({
  scheduleBookingExpiry: vi.fn(() => Promise.resolve("mock-job-id")),
  cancelBookingExpiryJob: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/auth/api-key-auth", () => ({
  verifyAPIKeyFromRequest: vi.fn(() =>
    Promise.resolve({ authenticated: false, error: "No API key" })
  ),
}));

// ============================================
// ROUTE IMPORTS — after mocks
// ============================================

import {
  GET as getDepartures,
  POST as createDepartureRoute,
} from "@/app/api/b2b/departures/route";
import {
  GET as getDepartureById,
  PATCH as patchDeparture,
  DELETE as deleteDeparture,
} from "@/app/api/b2b/departures/[id]/route";
import {
  GET as getBookings,
  POST as createBookingRoute,
} from "@/app/api/b2b/bookings/route";
import { GET as getBookingById } from "@/app/api/b2b/bookings/[id]/route";
import { POST as confirmBookingRoute } from "@/app/api/b2b/bookings/[id]/confirm/route";
import { POST as cancelBookingRoute } from "@/app/api/b2b/bookings/[id]/cancel/route";

// ============================================
// TEST HELPERS
// ============================================

async function seedBookableProduct() {
  // Create parent product (boat)
  await PIMProductModel.create({
    entity_code: "BOAT-001",
    sku: "BOAT-001",
    name: { it: "Costa Smeralda" },
    slug: { it: "costa-smeralda" },
    version: 1,
    isCurrent: true,
    isCurrentPublished: true,
    status: "published",
    product_kind: "bookable",
    quantity: 0,
    sold: 0,
    unit: "pcs",
    completeness_score: 100,
    critical_issues: [],
    auto_publish_enabled: false,
    auto_publish_eligible: false,
    min_score_threshold: 80,
    required_fields: [],
    analytics: { views_30d: 0, clicks_30d: 0, add_to_cart_30d: 0, conversions_30d: 0, priority_score: 0 },
    locked_fields: [],
    manually_edited: false,
    manually_edited_fields: [],
    has_conflict: false,
    source: { source_id: "test", source_name: "test", imported_at: new Date() },
  });

  // Create child products (cabin types)
  for (const cabin of [
    { code: "CABIN-INT", name: "Interior Cabin", price: 800 },
    { code: "CABIN-BAL", name: "Balcony Suite", price: 2000 },
  ]) {
    await PIMProductModel.create({
      entity_code: cabin.code,
      sku: cabin.code,
      name: { it: cabin.name },
      slug: { it: cabin.code.toLowerCase() },
      version: 1,
      isCurrent: true,
      isCurrentPublished: true,
      status: "published",
      product_kind: "standard",
      parent_entity_code: "BOAT-001",
      is_parent: false,
      quantity: 0,
      sold: 0,
      unit: "pcs",
      pricing: { list: cabin.price, currency: "EUR" },
      completeness_score: 100,
      critical_issues: [],
      auto_publish_enabled: false,
      auto_publish_eligible: false,
      min_score_threshold: 80,
      required_fields: [],
      analytics: { views_30d: 0, clicks_30d: 0, add_to_cart_30d: 0, conversions_30d: 0, priority_score: 0 },
      locked_fields: [],
      manually_edited: false,
      manually_edited_fields: [],
      has_conflict: false,
      source: { source_id: "test", source_name: "test", imported_at: new Date() },
    });
  }
}

async function createTestDeparture() {
  const req = createRequest("POST", {
    product_entity_code: "BOAT-001",
    label: "Mediterranean - March 15",
    starts_at: "2026-03-15T00:00:00Z",
    ends_at: "2026-03-22T00:00:00Z",
    resources: [
      {
        resource_type: "cabin",
        child_entity_code: "CABIN-INT",
        total_capacity: 50,
      },
      {
        resource_type: "cabin",
        child_entity_code: "CABIN-BAL",
        total_capacity: 10,
        price_override: 2500,
        currency: "EUR",
      },
    ],
  });

  const res = await createDepartureRoute(req);
  const data = await res.json();
  return data.departure;
}

// ============================================
// TESTS
// ============================================

describe("integration: Departures API", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    vi.clearAllMocks();
    await seedBookableProduct();
  });

  it("POST /api/b2b/departures — creates departure with resources", async () => {
    const req = createRequest("POST", {
      product_entity_code: "BOAT-001",
      label: "Mediterranean - March 15",
      starts_at: "2026-03-15T00:00:00Z",
      resources: [
        {
          resource_type: "cabin",
          child_entity_code: "CABIN-INT",
          total_capacity: 50,
        },
      ],
    });

    const res = await createDepartureRoute(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.departure.label).toBe("Mediterranean - March 15");
    expect(data.departure.status).toBe("draft");
    expect(data.departure.resources).toHaveLength(1);
    expect(data.departure.resources[0].total_capacity).toBe(50);
    expect(data.departure.resources[0].available).toBe(50);
    expect(data.departure.resources[0].held).toBe(0);
    expect(data.departure.resources[0].booked).toBe(0);
  });

  it("POST /api/b2b/departures — rejects non-bookable product", async () => {
    const req = createRequest("POST", {
      product_entity_code: "CABIN-INT", // child product, not bookable
      label: "Should fail",
      starts_at: "2026-03-15T00:00:00Z",
      resources: [
        {
          resource_type: "cabin",
          child_entity_code: "CABIN-INT",
          total_capacity: 10,
        },
      ],
    });

    const res = await createDepartureRoute(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("not marked as bookable");
  });

  it("GET /api/b2b/departures — lists with pagination", async () => {
    // Create 2 departures
    await createTestDeparture();
    await createTestDeparture();

    const req = createRequest("GET", null, "http://localhost/api/b2b/departures?page=1&limit=10");
    const res = await getDepartures(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.departures.length).toBe(2);
    expect(data.pagination.total).toBe(2);
  });

  it("PATCH /api/b2b/departures/[id] — updates status", async () => {
    const departure = await createTestDeparture();

    const req = createRequest("PATCH", { status: "active" });
    const params = createParams({ id: departure.departure_id });

    const res = await patchDeparture(req, params);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.departure.status).toBe("active");
  });

  it("DELETE /api/b2b/departures/[id] — deletes draft departure", async () => {
    const departure = await createTestDeparture();

    const req = createRequest("DELETE");
    const params = createParams({ id: departure.departure_id });

    const res = await deleteDeparture(req, params);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("DELETE /api/b2b/departures/[id] — rejects non-draft departure", async () => {
    const departure = await createTestDeparture();

    // Activate it first
    await DepartureModel.updateOne(
      { departure_id: departure.departure_id },
      { $set: { status: "active" } }
    );

    const req = createRequest("DELETE");
    const params = createParams({ id: departure.departure_id });

    const res = await deleteDeparture(req, params);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("draft");
  });
});

describe("integration: Bookings API — Hold Flow", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    vi.clearAllMocks();
    await seedBookableProduct();
  });

  it("POST /api/b2b/bookings — creates held booking and decrements capacity", async () => {
    const departure = await createTestDeparture();

    // Activate departure
    await DepartureModel.updateOne(
      { departure_id: departure.departure_id },
      { $set: { status: "active" } }
    );

    const resourceId = departure.resources[0].resource_id;

    const req = createRequest("POST", {
      departure_id: departure.departure_id,
      resource_id: resourceId,
      customer_id: "customer-001",
      quantity: 2,
    });

    const res = await createBookingRoute(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.booking.status).toBe("held");
    expect(data.booking.quantity).toBe(2);
    expect(data.booking.unit_price).toBe(800); // From PIM product
    expect(data.booking.total_price).toBe(1600);
    expect(data.booking.hold_expires_at).toBeDefined();

    // Check capacity was decremented
    const updatedDeparture = await DepartureModel.findOne({
      departure_id: departure.departure_id,
    }).lean();
    const resource = (updatedDeparture as any).resources.find(
      (r: any) => r.resource_id === resourceId
    );
    expect(resource.available).toBe(48); // 50 - 2
    expect(resource.held).toBe(2);
  });

  it("POST /api/b2b/bookings — uses price_override when set", async () => {
    const departure = await createTestDeparture();

    await DepartureModel.updateOne(
      { departure_id: departure.departure_id },
      { $set: { status: "active" } }
    );

    // Use the balcony resource (has price_override: 2500)
    const balconyResource = departure.resources[1];

    const req = createRequest("POST", {
      departure_id: departure.departure_id,
      resource_id: balconyResource.resource_id,
      customer_id: "customer-001",
      quantity: 1,
    });

    const res = await createBookingRoute(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.booking.unit_price).toBe(2500); // Override, not PIM price of 2000
  });

  it("POST /api/b2b/bookings — returns 409 when capacity is 0", async () => {
    const departure = await createTestDeparture();

    await DepartureModel.updateOne(
      { departure_id: departure.departure_id },
      { $set: { status: "active" } }
    );

    // Book all 10 balcony cabins
    const balconyResource = departure.resources[1];

    const req1 = createRequest("POST", {
      departure_id: departure.departure_id,
      resource_id: balconyResource.resource_id,
      customer_id: "customer-001",
      quantity: 10,
    });

    const res1 = await createBookingRoute(req1);
    expect(res1.status).toBe(201);

    // Try to book one more
    const req2 = createRequest("POST", {
      departure_id: departure.departure_id,
      resource_id: balconyResource.resource_id,
      customer_id: "customer-002",
      quantity: 1,
    });

    const res2 = await createBookingRoute(req2);
    const data2 = await res2.json();

    expect(res2.status).toBe(409);
    expect(data2.error).toContain("No capacity");
  });

  it("POST /api/b2b/bookings — rejects booking for non-active departure", async () => {
    const departure = await createTestDeparture();
    // departure is in "draft" status

    const req = createRequest("POST", {
      departure_id: departure.departure_id,
      resource_id: departure.resources[0].resource_id,
      customer_id: "customer-001",
      quantity: 1,
    });

    const res = await createBookingRoute(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("not open for booking");
  });
});

describe("integration: Bookings API — Confirm & Cancel", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    vi.clearAllMocks();
    await seedBookableProduct();
  });

  it("POST /api/b2b/bookings/[id]/confirm — transitions held → confirmed", async () => {
    const departure = await createTestDeparture();
    await DepartureModel.updateOne(
      { departure_id: departure.departure_id },
      { $set: { status: "active" } }
    );

    // Create a hold
    const holdReq = createRequest("POST", {
      departure_id: departure.departure_id,
      resource_id: departure.resources[0].resource_id,
      customer_id: "customer-001",
      quantity: 3,
    });
    const holdRes = await createBookingRoute(holdReq);
    const holdData = await holdRes.json();
    const bookingId = holdData.booking.booking_id;

    // Confirm it
    const confirmReq = createRequest("POST", { order_id: "ORD-001" });
    const confirmParams = createParams({ id: bookingId });
    const confirmRes = await confirmBookingRoute(confirmReq, confirmParams);
    const confirmData = await confirmRes.json();

    expect(confirmRes.status).toBe(200);
    expect(confirmData.booking.status).toBe("confirmed");
    expect(confirmData.booking.order_id).toBe("ORD-001");
    expect(confirmData.booking.confirmed_at).toBeDefined();

    // Verify capacity moved from held → booked
    const updatedDeparture = await DepartureModel.findOne({
      departure_id: departure.departure_id,
    }).lean();
    const resource = (updatedDeparture as any).resources[0];
    expect(resource.held).toBe(0);
    expect(resource.booked).toBe(3);
    expect(resource.available).toBe(47); // 50 - 3 (unchanged from hold)
  });

  it("POST /api/b2b/bookings/[id]/cancel — returns capacity to available", async () => {
    const departure = await createTestDeparture();
    await DepartureModel.updateOne(
      { departure_id: departure.departure_id },
      { $set: { status: "active" } }
    );

    // Create a hold
    const holdReq = createRequest("POST", {
      departure_id: departure.departure_id,
      resource_id: departure.resources[0].resource_id,
      customer_id: "customer-001",
      quantity: 5,
    });
    const holdRes = await createBookingRoute(holdReq);
    const holdData = await holdRes.json();
    const bookingId = holdData.booking.booking_id;

    // Cancel it
    const cancelReq = createRequest("POST", { reason: "Changed plans" });
    const cancelParams = createParams({ id: bookingId });
    const cancelRes = await cancelBookingRoute(cancelReq, cancelParams);
    const cancelData = await cancelRes.json();

    expect(cancelRes.status).toBe(200);
    expect(cancelData.booking.status).toBe("cancelled");
    expect(cancelData.booking.cancellation_reason).toBe("Changed plans");

    // Verify capacity returned to available
    const updatedDeparture = await DepartureModel.findOne({
      departure_id: departure.departure_id,
    }).lean();
    const resource = (updatedDeparture as any).resources[0];
    expect(resource.available).toBe(50); // Fully restored
    expect(resource.held).toBe(0);
  });

  it("POST /api/b2b/bookings/[id]/confirm — fails if already cancelled", async () => {
    const departure = await createTestDeparture();
    await DepartureModel.updateOne(
      { departure_id: departure.departure_id },
      { $set: { status: "active" } }
    );

    // Create and cancel a hold
    const holdReq = createRequest("POST", {
      departure_id: departure.departure_id,
      resource_id: departure.resources[0].resource_id,
      customer_id: "customer-001",
      quantity: 1,
    });
    const holdRes = await createBookingRoute(holdReq);
    const holdData = await holdRes.json();
    const bookingId = holdData.booking.booking_id;

    // Cancel
    const cancelReq = createRequest("POST", {});
    await cancelBookingRoute(cancelReq, createParams({ id: bookingId }));

    // Try to confirm
    const confirmReq = createRequest("POST", {});
    const confirmRes = await confirmBookingRoute(confirmReq, createParams({ id: bookingId }));
    const confirmData = await confirmRes.json();

    expect(confirmRes.status).toBe(400);
    expect(confirmData.error).toContain("cancelled");
  });
});

describe("integration: Bookings API — Listing", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    vi.clearAllMocks();
    await seedBookableProduct();
  });

  it("GET /api/b2b/bookings — filters by departure_id", async () => {
    const departure = await createTestDeparture();
    await DepartureModel.updateOne(
      { departure_id: departure.departure_id },
      { $set: { status: "active" } }
    );

    // Create 2 bookings
    for (let i = 0; i < 2; i++) {
      const req = createRequest("POST", {
        departure_id: departure.departure_id,
        resource_id: departure.resources[0].resource_id,
        customer_id: `customer-00${i}`,
        quantity: 1,
      });
      await createBookingRoute(req);
    }

    const req = createRequest(
      "GET",
      null,
      `http://localhost/api/b2b/bookings?departure_id=${departure.departure_id}`
    );
    const res = await getBookings(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.bookings.length).toBe(2);
    expect(data.pagination.total).toBe(2);
  });

  it("GET /api/b2b/bookings — filters by status", async () => {
    const departure = await createTestDeparture();
    await DepartureModel.updateOne(
      { departure_id: departure.departure_id },
      { $set: { status: "active" } }
    );

    // Create a booking
    const holdReq = createRequest("POST", {
      departure_id: departure.departure_id,
      resource_id: departure.resources[0].resource_id,
      customer_id: "customer-001",
      quantity: 1,
    });
    const holdRes = await createBookingRoute(holdReq);
    const holdData = await holdRes.json();

    // Confirm it
    const confirmReq = createRequest("POST", {});
    await confirmBookingRoute(confirmReq, createParams({ id: holdData.booking.booking_id }));

    // Filter by "confirmed"
    const req = createRequest("GET", null, "http://localhost/api/b2b/bookings?status=confirmed");
    const res = await getBookings(req);
    const data = await res.json();

    expect(data.bookings.length).toBe(1);
    expect(data.bookings[0].status).toBe("confirmed");

    // Filter by "held" should return 0
    const req2 = createRequest("GET", null, "http://localhost/api/b2b/bookings?status=held");
    const res2 = await getBookings(req2);
    const data2 = await res2.json();

    expect(data2.bookings.length).toBe(0);
  });
});
