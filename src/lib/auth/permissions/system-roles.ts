import { ALL_PERMISSION_KEYS, type PermissionKey } from "./catalog";
import type { RoleScope } from "./scope";

export const SYSTEM_ROLE_KEYS = ["admin", "helpdesk", "agent", "viewer"] as const;
export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

export interface SystemRolePreset {
  name: string;
  description: string;
  permissions: PermissionKey[];
  scope: RoleScope;
}

const ALL_SCOPE: RoleScope = { channels: "all", customers: "all", price_lists: "all" };

export const SYSTEM_ROLE_PRESETS: Record<SystemRoleKey, SystemRolePreset> = {
  admin: {
    name: "Admin",
    description: "Full access to every entitled app.",
    permissions: [...ALL_PERMISSION_KEYS],
    scope: ALL_SCOPE,
  },
  helpdesk: {
    name: "Helpdesk",
    description: "Read-oriented support across orders, customers and products.",
    permissions: ["orders.view", "customers.view", "pim.product.view"],
    scope: ALL_SCOPE,
  },
  agent: {
    name: "Agent",
    description: "Sales agent — manages their own channel's orders and customers.",
    permissions: [
      "orders.view",
      "orders.confirm",
      "orders.ship",
      "customers.view",
      "customers.edit",
      "pim.product.view",
    ],
    scope: { channels: "per_user", customers: "per_user", price_lists: "all" },
  },
  viewer: {
    name: "Viewer",
    description: "Read-only across entitled apps.",
    permissions: ["pim.product.view", "orders.view", "customers.view"],
    scope: ALL_SCOPE,
  },
};

export function isSystemRoleKey(value: string): value is SystemRoleKey {
  return (SYSTEM_ROLE_KEYS as readonly string[]).includes(value);
}
