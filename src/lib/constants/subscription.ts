/**
 * Subscription plan constants & validators (Phase 1).
 * Pure — safe to import in unit tests and server/client code.
 */

export const PLAN_STATUSES = ["active", "archived"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const PLAN_KINDS = ["standard", "enterprise", "wholesale"] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];

export const CHECKOUT_MODES = ["self_serve", "contact_sales"] as const;
export type CheckoutMode = (typeof CHECKOUT_MODES)[number];

export const BILLING_INTERVALS = ["month", "year"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const METRIC_AGGREGATIONS = ["sum", "max", "last"] as const;
export type MetricAggregation = (typeof METRIC_AGGREGATIONS)[number];

export const DEFAULT_PLAN_KIND: PlanKind = "standard";
export const DEFAULT_CHECKOUT_MODE: CheckoutMode = "self_serve";
export const DEFAULT_CURRENCY = "EUR";

export function isPlanStatus(v: string): v is PlanStatus {
  return (PLAN_STATUSES as readonly string[]).includes(v);
}
export function isPlanKind(v: string): v is PlanKind {
  return (PLAN_KINDS as readonly string[]).includes(v);
}
export function isCheckoutMode(v: string): v is CheckoutMode {
  return (CHECKOUT_MODES as readonly string[]).includes(v);
}
export function isBillingInterval(v: string): v is BillingInterval {
  return (BILLING_INTERVALS as readonly string[]).includes(v);
}
export function isMetricAggregation(v: string): v is MetricAggregation {
  return (METRIC_AGGREGATIONS as readonly string[]).includes(v);
}
