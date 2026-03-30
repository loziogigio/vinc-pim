/**
 * Windmill Hook Middleware — Three-Phase Execution Engine
 *
 * Generic, channel-scoped hook system.
 * Routes call runBeforeHook / runOnHook / runAfterHook with a HookContext.
 */

import { windmillRun, windmillRunAsync, WindmillError } from "./windmill-client";
import { getHomeSettings } from "@/lib/db/home-settings";
import type {
  WindmillProxySettings,
  ChannelHookConfig,
  OperationHookConfig,
  HookContext,
  HookOperation,
  HookPhase,
  WindmillHookPayload,
  BeforeHookResponse,
  BeforeHookResult,
  OnHookResponse,
  OnHookResult,
} from "@/lib/types/windmill-proxy";

// ─── SETTINGS CACHE ───────────────────────────────────────────────

interface CacheEntry {
  settings: WindmillProxySettings | null;
  expires: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const settingsCache = new Map<string, CacheEntry>();

/** Load WindmillProxySettings for a tenant (with in-memory cache). */
export async function getProxySettings(
  tenantDb: string,
): Promise<WindmillProxySettings | null> {
  const cached = settingsCache.get(tenantDb);
  if (cached && cached.expires > Date.now()) return cached.settings;

  const home = await getHomeSettings(tenantDb);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settings = (home as any)?.windmill_proxy as WindmillProxySettings | undefined;
  const resolved = settings?.enabled ? settings : null;

  settingsCache.set(tenantDb, { settings: resolved, expires: Date.now() + CACHE_TTL_MS });
  return resolved;
}

/** Invalidate the settings cache for a tenant (call after settings update). */
export function invalidateProxyCache(tenantDb: string): void {
  settingsCache.delete(tenantDb);
}

// ─── HOOK LOOKUP ──────────────────────────────────────────────────

/**
 * Find the hook config for (channel, operation, phase).
 * Priority: exact channel match → "*" wildcard → undefined.
 */
export function findHook(
  settings: WindmillProxySettings,
  channel: string,
  op: HookOperation,
  phase: HookPhase,
): OperationHookConfig | undefined {
  let wildcardChannel: ChannelHookConfig | undefined;

  for (const ch of settings.channels) {
    if (!ch.enabled) continue;

    if (ch.channel === channel) {
      const hook = ch.hooks.find(
        (h) => h.operation === op && h.phase === phase && h.enabled,
      );
      if (hook) return hook;
    }

    if (ch.channel === "*") wildcardChannel = ch;
  }

  if (wildcardChannel) {
    return wildcardChannel.hooks.find(
      (h) => h.operation === op && h.phase === phase && h.enabled,
    );
  }

  return undefined;
}

// ─── PAYLOAD BUILDER ──────────────────────────────────────────────

function buildPayload(ctx: HookContext, phase: HookPhase): WindmillHookPayload {
  return {
    operation: ctx.operation,
    phase,
    tenant_id: ctx.tenantId,
    channel: ctx.channel,
    timestamp: new Date().toISOString(),
    customer_code: ctx.customerCode,
    address_code: ctx.addressCode,
    order_id: ctx.orderId,
    order: ctx.order ?? undefined,
    entity_codes: ctx.entityCodes,
    customer_id: ctx.customerId,
    request_data: ctx.requestData,
  };
}

function workspace(settings: WindmillProxySettings): string {
  return settings.workspace_name || process.env.WINDMILL_WORKSPACE || "";
}

// ─── BEFORE PHASE ─────────────────────────────────────────────────

/**
 * Runs BEFORE the VINC operation. Synchronous. Can block.
 *
 * - No hook configured → { hooked: false, allowed: true }
 * - Hook allows → { hooked: true, allowed: true, modified_data? }
 * - Hook rejects → { hooked: true, allowed: false, message }
 * - Hook timeout/error + blocking → { hooked: true, allowed: false }
 * - Hook timeout/error + non-blocking → { hooked: true, allowed: true }
 */
export async function runBeforeHook(ctx: HookContext): Promise<BeforeHookResult> {
  const settings = await getProxySettings(ctx.tenantDb);
  if (!settings) return { hooked: false, allowed: true };

  const hook = findHook(settings, ctx.channel, ctx.operation, "before");
  if (!hook) return { hooked: false, allowed: true };

  const timeout = hook.timeout_ms ?? settings.timeout_ms;
  const payload = buildPayload(ctx, "before");
  const ws = workspace(settings);
  const baseUrl = process.env.WINDMILL_BASE_URL || settings.windmill_base_url || undefined;

  try {
    const res = await windmillRun<BeforeHookResponse>(
      ws, hook.script_path, payload, timeout, baseUrl,
    );

    return {
      hooked: true,
      allowed: res.allowed !== false, // default allow if field missing
      message: res.message,
      modified_data: res.modified_data,
    };
  } catch (err) {
    const timedOut = err instanceof WindmillError && err.status === 504;
    console.error(`[windmill-proxy] before ${ctx.operation} failed:`, err);

    if (hook.blocking) {
      return {
        hooked: true,
        allowed: false,
        message: timedOut ? "ERP validation timed out" : "ERP validation failed",
        timedOut,
      };
    }

    // Non-blocking: allow the operation to proceed
    return { hooked: true, allowed: true, timedOut };
  }
}

// ─── BEFORE PHASE WITH ASYNC FALLBACK ────────────────────────

/**
 * Runs the "before" hook with a sync-try / async-fallback pattern.
 *
 * 1. Attempts `windmillRun()` with `syncTimeoutMs` (default 10s).
 * 2. If completes in time → returns normal before result.
 * 3. If times out (504) → launches `windmillRunAsync()` and returns
 *    `{ async: true, jobId }`. The order stays draft with processing
 *    metadata so the client can poll processing-status.
 * 4. Other errors → returns standard failure (same as `runBeforeHook`).
 */
export async function runBeforeHookWithAsyncFallback(
  ctx: HookContext,
  syncTimeoutMs = 10_000,
): Promise<BeforeHookResult> {
  const settings = await getProxySettings(ctx.tenantDb);
  if (!settings) return { hooked: false, allowed: true };

  const hook = findHook(settings, ctx.channel, ctx.operation, "before");
  if (!hook) return { hooked: false, allowed: true };

  const timeout = hook.timeout_ms ?? syncTimeoutMs;
  const payload = buildPayload(ctx, "before");
  const ws = workspace(settings);
  const baseUrl = process.env.WINDMILL_BASE_URL || settings.windmill_base_url || undefined;

  try {
    // Sync attempt — wait up to timeout
    const res = await windmillRun<BeforeHookResponse>(
      ws, hook.script_path, payload, timeout, baseUrl,
    );

    return {
      hooked: true,
      allowed: res.allowed !== false,
      message: res.message,
      modified_data: res.modified_data,
    };
  } catch (err) {
    const timedOut = err instanceof WindmillError && err.status === 504;

    if (timedOut) {
      // Sync timed out — launch async job, order stays draft
      try {
        const jobId = await windmillRunAsync(
          ws, hook.script_path, payload, baseUrl,
        );
        return {
          hooked: true,
          allowed: false, // block the submit — async processing in progress
          async: true,
          jobId,
          message: "ERP validation in progress",
          timedOut: true,
        };
      } catch (asyncErr) {
        console.error(`[windmill-proxy] before ${ctx.operation} async fallback failed:`, asyncErr);
        return {
          hooked: true,
          allowed: false,
          message: "ERP validation failed (async fallback)",
          timedOut: true,
        };
      }
    }

    // Non-timeout error
    console.error(`[windmill-proxy] before ${ctx.operation} failed:`, err);

    if (hook.blocking) {
      return {
        hooked: true,
        allowed: false,
        message: "ERP validation failed",
      };
    }

    return { hooked: true, allowed: true, timedOut: false };
  }
}

// ─── ON PHASE ─────────────────────────────────────────────────────

/**
 * Runs alongside / after the VINC operation. Synchronous.
 * Returns ERP data for merging onto the order or returning to the caller.
 *
 * - No hook configured → { hooked: false, success: true, blocking: false }
 * - Hook succeeds → { hooked: true, success: true, response }
 * - Hook fails + blocking → caller should rollback
 * - Hook fails + non-blocking → caller proceeds with warning
 */
export async function runOnHook(ctx: HookContext): Promise<OnHookResult> {
  const settings = await getProxySettings(ctx.tenantDb);
  if (!settings) return { hooked: false, success: true, blocking: false };

  const hook = findHook(settings, ctx.channel, ctx.operation, "on");
  if (!hook) return { hooked: false, success: true, blocking: false };

  const timeout = hook.timeout_ms ?? settings.timeout_ms;
  const payload = buildPayload(ctx, "on");
  const ws = workspace(settings);
  const baseUrl = process.env.WINDMILL_BASE_URL || settings.windmill_base_url || undefined;

  try {
    const res = await windmillRun<OnHookResponse>(
      ws, hook.script_path, payload, timeout, baseUrl,
    );

    return {
      hooked: true,
      success: res.success !== false,
      response: res,
      blocking: hook.blocking,
    };
  } catch (err) {
    const timedOut = err instanceof WindmillError && err.status === 504;
    console.error(`[windmill-proxy] on ${ctx.operation} failed:`, err);

    return {
      hooked: true,
      success: false,
      timedOut,
      error: timedOut ? "ERP sync timed out" : (err as Error).message,
      blocking: hook.blocking,
    };
  }
}

// ─── ON PHASE WITH ASYNC FALLBACK ────────────────────────────────

/**
 * Runs the "on" hook with a sync-try / async-fallback pattern.
 *
 * 1. Attempts `windmillRun()` with `syncTimeoutMs` (default 10s).
 * 2. If completes in time → returns normal result with `async: false`.
 * 3. If times out (504) → launches `windmillRunAsync()` and returns
 *    `{ async: true, jobId }` so the caller can save the job ID.
 * 4. Other errors → returns standard failure (same as `runOnHook`).
 */
export async function runOnHookWithAsyncFallback(
  ctx: HookContext,
  syncTimeoutMs = 10_000,
): Promise<OnHookResult & { async?: boolean; jobId?: string }> {
  const settings = await getProxySettings(ctx.tenantDb);
  if (!settings) return { hooked: false, success: true, blocking: false };

  const hook = findHook(settings, ctx.channel, ctx.operation, "on");
  if (!hook) return { hooked: false, success: true, blocking: false };

  const timeout = hook.timeout_ms ?? syncTimeoutMs;
  const payload = buildPayload(ctx, "on");
  const ws = workspace(settings);
  const baseUrl = process.env.WINDMILL_BASE_URL || settings.windmill_base_url || undefined;

  try {
    // Sync attempt — wait up to timeout
    const res = await windmillRun<OnHookResponse>(
      ws, hook.script_path, payload, timeout, baseUrl,
    );

    return {
      hooked: true,
      success: res.success !== false,
      response: res,
      blocking: hook.blocking,
      async: false,
    };
  } catch (err) {
    const timedOut = err instanceof WindmillError && err.status === 504;

    if (timedOut) {
      // Sync timed out — launch async job instead
      try {
        const jobId = await windmillRunAsync(
          ws, hook.script_path, payload, baseUrl,
        );
        return {
          hooked: true,
          success: true,
          blocking: false,
          async: true,
          jobId,
        };
      } catch (asyncErr) {
        console.error(`[windmill-proxy] on ${ctx.operation} async fallback failed:`, asyncErr);
        return {
          hooked: true,
          success: false,
          error: "ERP sync failed (async fallback)",
          blocking: hook.blocking,
        };
      }
    }

    // Non-timeout error
    console.error(`[windmill-proxy] on ${ctx.operation} failed:`, err);
    return {
      hooked: true,
      success: false,
      timedOut: false,
      error: (err as Error).message,
      blocking: hook.blocking,
    };
  }
}

// ─── AFTER PHASE ──────────────────────────────────────────────────

/**
 * Fire-and-forget. Uses windmillRunAsync — returns immediately.
 * Errors are logged internally, never propagated to the caller.
 */
export function runAfterHook(ctx: HookContext): void {
  getProxySettings(ctx.tenantDb)
    .then((settings) => {
      if (!settings) return;

      const hook = findHook(settings, ctx.channel, ctx.operation, "after");
      if (!hook) return;

      const payload = buildPayload(ctx, "after");
      const ws = workspace(settings);
      const baseUrl = process.env.WINDMILL_BASE_URL || settings.windmill_base_url || undefined;

      windmillRunAsync(ws, hook.script_path, payload, baseUrl).catch((err) => {
        console.error(`[windmill-proxy] after ${ctx.operation} failed:`, err);
      });
    })
    .catch((err) => {
      console.error(`[windmill-proxy] after ${ctx.operation} settings load failed:`, err);
    });
}

// ─── WINDMILL JOB TRACKING ───────────────────────────────────────

/**
 * Append a Windmill job reference to order.erp_data.windmill_jobs.
 * Accumulates over the order lifecycle (never cleared).
 */
export async function pushWindmillJobRef(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  OrderModel: any,
  orderId: string,
  ref: { job_id: string; script: string; phase: string; operation: string },
): Promise<void> {
  await OrderModel.updateOne(
    { order_id: orderId },
    {
      $push: {
        "erp_data.windmill_jobs": {
          ...ref,
          timestamp: new Date().toISOString(),
        },
      },
    },
  );
}

// ─── ORDER ERP DATA MERGE ─────────────────────────────────────────

/**
 * Merge ERP data from an "on" hook response onto the order document.
 * Expects on.response.data to contain:
 *   { erp_data: {...}, erp_items?: [{ line_number, erp_data }] }
 */
// ─── ROUTE HELPERS ───────────────────────────────────────────────

/**
 * Build a HookContext from common route parameters.
 * Eliminates duplicated context construction across order routes.
 */
export function buildHookCtx(
  tenantDb: string,
  tenantId: string,
  operation: HookOperation,
  opts?: Partial<Omit<HookContext, "tenantDb" | "tenantId" | "operation">>,
): HookContext {
  return {
    tenantDb,
    tenantId,
    channel: "default",
    operation,
    ...opts,
  };
}

/**
 * Build a HookContext from an order result (post-operation).
 * Extracts channel, customerCode, orderId from the order object.
 */
export function buildHookCtxFromOrder(
  tenantDb: string,
  tenantId: string,
  operation: HookOperation,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order: any,
  opts?: Partial<Omit<HookContext, "tenantDb" | "tenantId" | "operation" | "order" | "channel" | "customerCode" | "orderId">>,
): HookContext {
  const plain = typeof order?.toObject === "function" ? order.toObject() : order;
  return {
    tenantDb,
    tenantId,
    channel: plain?.channel || "default",
    operation,
    orderId: plain?.order_id,
    order: plain,
    customerCode: plain?.customer_code,
    ...opts,
  };
}

/**
 * Update a HookContext with order data after the core operation completes.
 * Used when hookCtx was created before the operation (e.g., before-hook).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updateCtxFromOrder(ctx: HookContext, order: any): void {
  const plain = typeof order?.toObject === "function" ? order.toObject() : order;
  ctx.order = plain;
  ctx.channel = plain?.channel || ctx.channel || "default";
  ctx.customerCode = plain?.customer_code || ctx.customerCode;
}

/**
 * Run on-hook → merge ERP data → fire after-hook.
 * Common pattern used by most order lifecycle routes.
 */
export async function runOnMergeAfter(
  ctx: HookContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  OrderModel: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orderDbId: any,
): Promise<OnHookResult> {
  const on = await runOnHook(ctx);
  if (on.hooked && on.success && on.response?.data) {
    await mergeOrderErpData(OrderModel, orderDbId, on.response);
  }
  runAfterHook(ctx);
  return on;
}

/**
 * Build the windmill response fragment for JSON responses.
 * Returns undefined if no hooks were active (omitted from response).
 */
export function windmillResponseFragment(
  channel: string,
  before?: BeforeHookResult | null,
  on?: OnHookResult | null,
): Record<string, unknown> | undefined {
  if (!before?.hooked && !on?.hooked) return undefined;
  return {
    windmill: {
      channel,
      ...(before?.hooked ? { before: { allowed: before.allowed } } : {}),
      ...(on?.hooked ? { on: { synced: on.success, timed_out: on.timedOut } } : {}),
    },
  };
}

// ─── ERP DATA MERGE ──────────────────────────────────────────────

export async function mergeOrderErpData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  OrderModel: any,
  orderId: string,
  response: OnHookResponse,
): Promise<void> {
  if (!response.data) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {};

  // Order-level fields (e.g. erp_cart_id) — merged directly onto the order root
  if (response.data.order_data) {
    for (const [key, value] of Object.entries(response.data.order_data as Record<string, unknown>)) {
      update[key] = value;
    }
  }

  if (response.data.erp_data) {
    // Merge into erp_data.* using dot notation so we don't overwrite existing keys
    for (const [key, value] of Object.entries(response.data.erp_data as Record<string, unknown>)) {
      update[`erp_data.${key}`] = value;
    }
  }

  update.erp_sync_status = "synced";

  await OrderModel.updateOne({ _id: orderId }, { $set: update });

  // Per-item ERP data
  const erpItems = response.data.erp_items as
    | Array<{ line_number: number; erp_line_number?: number; erp_data: Record<string, unknown> }>
    | undefined;

  if (erpItems?.length) {
    for (const item of erpItems) {
      const itemUpdate: Record<string, unknown> = { "items.$.erp_data": item.erp_data };
      if (item.erp_line_number != null) {
        itemUpdate["items.$.erp_line_number"] = item.erp_line_number;
      }
      await OrderModel.updateOne(
        { _id: orderId, "items.line_number": item.line_number },
        { $set: itemUpdate },
      );
    }
  }
}
