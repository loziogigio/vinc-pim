import type { AppId } from "@/config/app-ids";

/** CASL action verb a permission grants. */
export type AppAction =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "confirm"
  | "ship"
  | "cancel"
  | "manage";

/** CASL subject (resource) a permission applies to. */
export type AppSubject =
  | "Product"
  | "Order"
  | "Customer"
  | "Role"
  | "B2BUser"
  | "all";

export interface PermissionDef {
  /** Canonical apps.config.ts app id — authoritative for entitlement. */
  app: AppId;
  action: AppAction;
  subject: AppSubject;
  /** i18n key for the role-editor UI (added to en/it/sk in a later plan). */
  i18nKey: string;
}

/**
 * STARTER catalog (Phase 0A). Phase 1 expands this to every entitled app.
 * The key reads with a friendly prefix; `app` is the canonical id.
 */
export const PERMISSIONS = {
  // PIM (app id "pim")
  "pim.product.view":   { app: "pim", action: "read",   subject: "Product", i18nKey: "rbac.perm.pim.product.view" },
  "pim.product.create": { app: "pim", action: "create", subject: "Product", i18nKey: "rbac.perm.pim.product.create" },
  "pim.product.edit":   { app: "pim", action: "update", subject: "Product", i18nKey: "rbac.perm.pim.product.edit" },
  "pim.product.delete": { app: "pim", action: "delete", subject: "Product", i18nKey: "rbac.perm.pim.product.delete" },

  // Orders (app id "store-orders")
  "orders.view":    { app: "store-orders", action: "read",    subject: "Order", i18nKey: "rbac.perm.orders.view" },
  "orders.confirm": { app: "store-orders", action: "confirm", subject: "Order", i18nKey: "rbac.perm.orders.confirm" },
  "orders.ship":    { app: "store-orders", action: "ship",    subject: "Order", i18nKey: "rbac.perm.orders.ship" },
  "orders.cancel":  { app: "store-orders", action: "cancel",  subject: "Order", i18nKey: "rbac.perm.orders.cancel" },

  // Customers (app id "store-customers")
  "customers.view": { app: "store-customers", action: "read",   subject: "Customer", i18nKey: "rbac.perm.customers.view" },
  "customers.edit": { app: "store-customers", action: "update", subject: "Customer", i18nKey: "rbac.perm.customers.edit" },

  // Team & Roles (app id "team")
  "roles.manage": { app: "team", action: "manage", subject: "Role",    i18nKey: "rbac.perm.roles.manage" },
  "users.manage": { app: "team", action: "manage", subject: "B2BUser", i18nKey: "rbac.perm.users.manage" },
} as const satisfies Record<string, PermissionDef>;

export type PermissionKey = keyof typeof PERMISSIONS;

export const ALL_PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

export function permissionsForApp(app: AppId): PermissionKey[] {
  return ALL_PERMISSION_KEYS.filter((k) => PERMISSIONS[k].app === app);
}

/** True when the given string is a known permission key. */
export function isPermissionKey(value: string): value is PermissionKey {
  return value in PERMISSIONS;
}
