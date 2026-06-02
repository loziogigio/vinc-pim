/**
 * Canonical module-app ids — the single id namespace used by the permission
 * catalog and (later) tenant entitlement. Kept free of icon/React imports so it
 * is safe to import in pure unit tests and server code.
 *
 * Mirrors the `id` of every entry in apps.config.ts, plus "team" (the new
 * Team & Roles app introduced by the RBAC work).
 */
export const APP_IDS = [
  "home",
  "admin",
  "settings",
  "pim",
  "correlations",
  "data-models",
  "store-orders",
  "store-coupons",
  "store-customers",
  "store-portal-users",
  "builder",
  "mobile-builder",
  "notifications",
  "documents",
  "payments",
  "pricing",
  "b2c",
  "blog",
  "b2b-portal",
  "bookings",
  "windmill",
  "team",
] as const;

export type AppId = (typeof APP_IDS)[number];

export function isAppId(value: string): value is AppId {
  return (APP_IDS as readonly string[]).includes(value);
}
