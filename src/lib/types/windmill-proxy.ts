/**
 * Windmill Hook System — Types & Constants
 *
 * Domain-agnostic, channel-scoped, three-phase hook model.
 * Operations span cart, order, pricing, stock, customer, catalog.
 */

// ─── HOOK OPERATIONS ──────────────────────────────────────────────

export const HOOK_OPERATIONS = [
  // Cart
  "cart.create",
  "cart.get",
  "cart.delete",
  "item.add",
  "item.update",
  "item.remove",
  // Order lifecycle
  "order.submit",
  "order.confirm",
  "order.preparing",
  "order.ship",
  "order.cancel",
  "order.deliver",
  // Pricing
  "pricing.resolve",
  "pricing.customer",
  // Stock
  "stock.check",
  "stock.reserve",
  // Customer
  "customer.validate",
  "customer.sync",
  // Catalog
  "catalog.search",
  "catalog.enrich",
] as const;

export type HookOperation = (typeof HOOK_OPERATIONS)[number];

/** Operations grouped by domain (for settings UI). */
export const OPERATION_DOMAINS = {
  cart: [
    "cart.create",
    "cart.get",
    "cart.delete",
    "item.add",
    "item.update",
    "item.remove",
  ],
  order: ["order.submit", "order.confirm", "order.preparing", "order.ship", "order.cancel", "order.deliver"],
  pricing: ["pricing.resolve", "pricing.customer"],
  stock: ["stock.check", "stock.reserve"],
  customer: ["customer.validate", "customer.sync"],
  catalog: ["catalog.search", "catalog.enrich"],
} as const;

// ─── HOOK PHASES ──────────────────────────────────────────────────

export const HOOK_PHASES = ["before", "on", "after"] as const;
export type HookPhase = (typeof HOOK_PHASES)[number];

// ─── CONFIGURATION ────────────────────────────────────────────────

/** SSO user mapping — links a VINC user to a Windmill account. */
export interface WindmillSSOUser {
  vinc_email: string; // must match session.email
  windmill_email: string; // Windmill login email
  windmill_password_encrypted: string; // AES-256-GCM encrypted
}

/** Per-tenant Windmill hook settings (stored in HomeSettings). */
export interface WindmillProxySettings {
  enabled: boolean;
  windmill_base_url?: string; // overrides WINDMILL_BASE_URL env
  windmill_external_url?: string; // browser-accessible URL (differs from base_url in Docker)
  workspace_name?: string; // Windmill workspace (default: "time")
  timeout_ms: number; // default 5000
  channels: ChannelHookConfig[];
  sso_users?: WindmillSSOUser[];
}

/** Channel-scoped hook set. "*" = fallback for unmatched channels. */
export interface ChannelHookConfig {
  channel: string; // "b2b", "b2c", "default", storefront slug, or "*"
  enabled: boolean;
  hooks: OperationHookConfig[];
}

/** One hook = operation + phase + Windmill script. */
export interface OperationHookConfig {
  operation: HookOperation;
  phase: HookPhase;
  script_path: string; // Windmill script/flow path (e.g., "f/erp/before_confirm")
  enabled: boolean;
  blocking: boolean; // before: rejection blocks operation. on: failure rolls back. after: ignored.
  timeout_ms?: number; // per-hook override
}

// ─── HOOK CONTEXT ─────────────────────────────────────────────────

/** Generic context passed to all hook functions. */
export interface HookContext {
  tenantDb: string;
  tenantId: string;
  channel: string;
  operation: HookOperation;
  // Domain-specific (all optional)
  order?: Record<string, unknown> | null;
  orderId?: string;
  entityCodes?: string[];
  customerId?: string;
  customerCode?: string;
  addressCode?: string;
  requestData?: Record<string, unknown>;
}

// ─── PAYLOAD (sent to Windmill) ───────────────────────────────────

/** Standardised payload sent to every Windmill hook script. */
export interface WindmillHookPayload {
  [key: string]: unknown;
  operation: HookOperation;
  phase: HookPhase;
  tenant_id: string;
  channel: string;
  timestamp: string; // ISO
  // Context
  customer_code?: string;
  address_code?: string;
  order_id?: string;
  order?: Record<string, unknown>;
  entity_codes?: string[];
  customer_id?: string;
  request_data?: Record<string, unknown>;
}

// ─── RESPONSE TYPES ───────────────────────────────────────────────

/** "before" hook response — validate / transform / block. */
export interface BeforeHookResponse {
  allowed: boolean;
  message?: string;
  modified_data?: Record<string, unknown>;
}

/** "on" hook response — sync result (domain-flexible data). */
export interface OnHookResponse {
  success: boolean;
  data?: Record<string, unknown>;
  message?: string;
  error?: string;
}

/** "after" hook — fire-and-forget, no required shape. */
export type AfterHookResponse = Record<string, unknown>;

// ─── HOOK RESULTS (returned to callers) ───────────────────────────

export interface BeforeHookResult {
  hooked: boolean;
  allowed: boolean;
  message?: string;
  modified_data?: Record<string, unknown>;
  timedOut?: boolean;
  async?: boolean;
  jobId?: string;
}

export interface OnHookResult {
  hooked: boolean;
  success: boolean;
  response?: OnHookResponse;
  timedOut?: boolean;
  error?: string;
  blocking: boolean;
}
