import { describe, it, expect } from "vitest";
import {
  PLAN_STATUSES,
  PLAN_KINDS,
  CHECKOUT_MODES,
  BILLING_INTERVALS,
  METRIC_AGGREGATIONS,
  isPlanStatus,
  isPlanKind,
  isCheckoutMode,
  isBillingInterval,
  isMetricAggregation,
  DEFAULT_PLAN_KIND,
  DEFAULT_CHECKOUT_MODE,
  DEFAULT_CURRENCY,
} from "@/lib/constants/subscription";

describe("unit: subscription constants", () => {
  it("exposes the expected enum values", () => {
    expect(PLAN_STATUSES).toEqual(["active", "archived"]);
    expect(PLAN_KINDS).toEqual(["standard", "enterprise", "wholesale"]);
    expect(CHECKOUT_MODES).toEqual(["self_serve", "contact_sales"]);
    expect(BILLING_INTERVALS).toEqual(["month", "year"]);
    expect(METRIC_AGGREGATIONS).toEqual(["sum", "max", "last"]);
  });

  it("validates membership", () => {
    expect(isPlanStatus("active")).toBe(true);
    expect(isPlanStatus("deleted")).toBe(false);
    expect(isPlanKind("wholesale")).toBe(true);
    expect(isPlanKind("freemium")).toBe(false);
    expect(isCheckoutMode("contact_sales")).toBe(true);
    expect(isBillingInterval("week")).toBe(false);
    expect(isMetricAggregation("sum")).toBe(true);
  });

  it("exposes sane defaults", () => {
    expect(DEFAULT_PLAN_KIND).toBe("standard");
    expect(DEFAULT_CHECKOUT_MODE).toBe("self_serve");
    expect(DEFAULT_CURRENCY).toBe("EUR");
  });
});
