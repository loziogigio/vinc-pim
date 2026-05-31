import type { SystemRoleKey } from "./system-roles";

/** Tri-state price visibility/editing capability. */
export const PRICE_ACCESS_LEVELS = ["none", "view", "edit"] as const;
export type PriceAccess = (typeof PRICE_ACCESS_LEVELS)[number];

export function isPriceAccess(value: string): value is PriceAccess {
  return (PRICE_ACCESS_LEVELS as readonly string[]).includes(value);
}

/** Default price access baked into each seeded system role. */
export const PRESET_PRICE_ACCESS: Record<SystemRoleKey, PriceAccess> = {
  admin: "edit",
  helpdesk: "view",
  agent: "view",
  viewer: "view",
};
