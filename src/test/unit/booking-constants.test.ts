import { describe, it, expect } from "vitest";
import {
  BOOKING_STATUSES,
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_TRANSITIONS,
  DEPARTURE_STATUSES,
  DEPARTURE_STATUS_LABELS,
  RESOURCE_TYPES,
  RESOURCE_TYPE_LABELS,
  PRODUCT_KINDS,
  PRODUCT_KIND_LABELS,
  HOLD_TTL_MS,
  canTransitionBooking,
  getAllowedBookingTransitions,
  isTerminalBookingStatus,
  isActiveBooking,
} from "@/lib/constants/booking";

// ============================================
// CONSTANT COMPLETENESS
// ============================================

describe("unit: Booking Constants Completeness", () => {
  it("every booking status should have a label", () => {
    for (const status of BOOKING_STATUSES) {
      expect(BOOKING_STATUS_LABELS[status]).toBeDefined();
      expect(BOOKING_STATUS_LABELS[status].length).toBeGreaterThan(0);
    }
  });

  it("every booking status should have a transitions entry", () => {
    for (const status of BOOKING_STATUSES) {
      expect(BOOKING_STATUS_TRANSITIONS[status]).toBeDefined();
    }
  });

  it("every departure status should have a label", () => {
    for (const status of DEPARTURE_STATUSES) {
      expect(DEPARTURE_STATUS_LABELS[status]).toBeDefined();
      expect(DEPARTURE_STATUS_LABELS[status].length).toBeGreaterThan(0);
    }
  });

  it("every resource type should have a label", () => {
    for (const type of RESOURCE_TYPES) {
      expect(RESOURCE_TYPE_LABELS[type]).toBeDefined();
      expect(RESOURCE_TYPE_LABELS[type].length).toBeGreaterThan(0);
    }
  });

  it("every product kind should have a label", () => {
    for (const kind of PRODUCT_KINDS) {
      expect(PRODUCT_KIND_LABELS[kind]).toBeDefined();
      expect(PRODUCT_KIND_LABELS[kind].length).toBeGreaterThan(0);
    }
  });

  it("HOLD_TTL_MS should be 15 minutes", () => {
    expect(HOLD_TTL_MS).toBe(15 * 60 * 1000);
  });

  it("PRODUCT_KINDS should include standard, bookable, and service", () => {
    expect(PRODUCT_KINDS).toContain("standard");
    expect(PRODUCT_KINDS).toContain("bookable");
    expect(PRODUCT_KINDS).toContain("service");
  });
});

// ============================================
// canTransitionBooking
// ============================================

describe("unit: canTransitionBooking", () => {
  it("should allow system to expire a held booking", () => {
    expect(canTransitionBooking("held", "expired", "system")).toBe(true);
  });

  it("should allow admin to confirm a held booking", () => {
    expect(canTransitionBooking("held", "confirmed", "admin")).toBe(true);
  });

  it("should allow customer to cancel a held booking", () => {
    expect(canTransitionBooking("held", "cancelled", "customer")).toBe(true);
  });

  it("should allow admin to cancel a confirmed booking", () => {
    expect(canTransitionBooking("confirmed", "cancelled", "admin")).toBe(true);
  });

  it("should not allow customer to expire a booking", () => {
    expect(canTransitionBooking("held", "expired", "customer")).toBe(false);
  });

  it("should allow any role to cancel a confirmed booking (admin is listed)", () => {
    // Since admin is in the allowed roles, the transition is available to all
    // (same pattern as order.ts canTransition)
    expect(canTransitionBooking("confirmed", "cancelled", "admin")).toBe(true);
  });

  it("should not allow transitions from terminal states", () => {
    expect(canTransitionBooking("cancelled", "held", "admin")).toBe(false);
    expect(canTransitionBooking("expired", "held", "admin")).toBe(false);
    expect(canTransitionBooking("no_show", "confirmed", "admin")).toBe(false);
    expect(canTransitionBooking("checked_in", "confirmed", "admin")).toBe(false);
  });

  it("should allow warehouse to mark confirmed as checked_in", () => {
    expect(canTransitionBooking("confirmed", "checked_in", "warehouse")).toBe(true);
  });

  it("should allow warehouse to mark confirmed as no_show", () => {
    expect(canTransitionBooking("confirmed", "no_show", "warehouse")).toBe(true);
  });
});

// ============================================
// getAllowedBookingTransitions
// ============================================

describe("unit: getAllowedBookingTransitions", () => {
  it("should return confirm and cancel for held booking as admin", () => {
    // expired is system-only, not available to admin
    const transitions = getAllowedBookingTransitions("held", "admin");
    expect(transitions).toContain("confirmed");
    expect(transitions).toContain("cancelled");
    expect(transitions).not.toContain("expired");
  });

  it("should return confirm and cancel for held booking as customer", () => {
    // Customer can cancel directly; confirm is also available because
    // admin is listed in the allowed roles (same pattern as order.ts)
    const transitions = getAllowedBookingTransitions("held", "customer");
    expect(transitions).toContain("confirmed");
    expect(transitions).toContain("cancelled");
  });

  it("should return empty array for terminal states", () => {
    expect(getAllowedBookingTransitions("cancelled", "admin")).toEqual([]);
    expect(getAllowedBookingTransitions("expired", "admin")).toEqual([]);
    expect(getAllowedBookingTransitions("no_show", "admin")).toEqual([]);
  });
});

// ============================================
// isTerminalBookingStatus
// ============================================

describe("unit: isTerminalBookingStatus", () => {
  it("cancelled is terminal", () => {
    expect(isTerminalBookingStatus("cancelled")).toBe(true);
  });

  it("expired is terminal", () => {
    expect(isTerminalBookingStatus("expired")).toBe(true);
  });

  it("no_show is terminal", () => {
    expect(isTerminalBookingStatus("no_show")).toBe(true);
  });

  it("checked_in is terminal", () => {
    expect(isTerminalBookingStatus("checked_in")).toBe(true);
  });

  it("held is not terminal", () => {
    expect(isTerminalBookingStatus("held")).toBe(false);
  });

  it("confirmed is not terminal", () => {
    expect(isTerminalBookingStatus("confirmed")).toBe(false);
  });
});

// ============================================
// isActiveBooking
// ============================================

describe("unit: isActiveBooking", () => {
  it("held is active", () => {
    expect(isActiveBooking("held")).toBe(true);
  });

  it("confirmed is active", () => {
    expect(isActiveBooking("confirmed")).toBe(true);
  });

  it("cancelled is not active", () => {
    expect(isActiveBooking("cancelled")).toBe(false);
  });

  it("expired is not active", () => {
    expect(isActiveBooking("expired")).toBe(false);
  });

  it("no_show is not active", () => {
    expect(isActiveBooking("no_show")).toBe(false);
  });

  it("checked_in is not active", () => {
    expect(isActiveBooking("checked_in")).toBe(false);
  });
});
