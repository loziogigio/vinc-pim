/**
 * Windmill Hook Middleware — Three-Phase Execution Engine
 *
 * Generic, channel-scoped hook system.
 * Routes call runBeforeHook / runOnHook / runAfterHook with a HookContext.
 */

import { windmillRun, windmillRunTracked, windmillRunAsync, windmillGetJobResult, WindmillError } from "./windmill-client";
import { getHomeSettings } from "@/lib/db/home-settings";
import { connectWithModels } from "@/lib/db/connection";
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
  HookMode,
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

// ─── HOOK MODE RESOLUTION (backward compat) ─────────────────────

/** Resolve mode from new `mode` field or legacy `blocking` boolean. */
function resolveMode(hook: OperationHookConfig): HookMode {
  if (hook.mode) return hook.mode;
  return hook.blocking ? "blocking" : "async";
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

  const started = Date.now();
  const startedIso = new Date(started).toISOString();

  try {
    const { result: res, jobId } = await windmillRunTracked<BeforeHookResponse>(
      ws, hook.script_path, payload, timeout, baseUrl,
    );

    const duration = Date.now() - started;
    await trackHookInvocation(ctx, {
      phase: "before",
      mode: "sync",
      script: hook.script_path,
      started_at: startedIso,
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      args: payload,
      result: res,
      jobId,
    });

    return {
      hooked: true,
      allowed: res.allowed !== false, // default allow if field missing
      message: res.message,
      modified_data: res.modified_data,
    };
  } catch (err) {
    const timedOut = err instanceof WindmillError && err.status === 504;
    const jobId = (err as WindmillError & { jobId?: string }).jobId;
    console.error(`[windmill-proxy] before ${ctx.operation} failed:`, err);

    await trackHookInvocation(ctx, {
      phase: "before",
      mode: "sync",
      script: hook.script_path,
      started_at: startedIso,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - started,
      args: payload,
      error: timedOut ? "ERP validation timed out" : (err as Error).message,
      status: "failed",
      jobId,
    });

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

  const started = Date.now();
  const startedIso = new Date(started).toISOString();

  try {
    // Sync attempt — wait up to timeout (returns real Windmill job_id)
    const { result: res, jobId } = await windmillRunTracked<BeforeHookResponse>(
      ws, hook.script_path, payload, timeout, baseUrl,
    );

    await trackHookInvocation(ctx, {
      phase: "before",
      mode: "sync",
      script: hook.script_path,
      started_at: startedIso,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - started,
      args: payload,
      result: res,
      jobId,
    });

    return {
      hooked: true,
      allowed: res.allowed !== false,
      message: res.message,
      modified_data: res.modified_data,
    };
  } catch (err) {
    const timedOut = err instanceof WindmillError && err.status === 504;

    if (timedOut) {
      // Sync timed out — the job is already running on Windmill (with the
      // jobId attached to the timeout error). Fall back to async mode and
      // reuse the same jobId so the client's polling sees the same job.
      const existingJobId = (err as WindmillError & { jobId?: string }).jobId;
      try {
        const jobId =
          existingJobId ??
          (await windmillRunAsync(ws, hook.script_path, payload, baseUrl));
        await trackHookInvocation(ctx, {
          phase: "before",
          mode: "async",
          script: hook.script_path,
          started_at: startedIso,
          jobId,
          args: payload,
          status: "queued",
        });
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
        await trackHookInvocation(ctx, {
          phase: "before",
          mode: "async",
          script: hook.script_path,
          started_at: startedIso,
          completed_at: new Date().toISOString(),
          args: payload,
          error: (asyncErr as Error).message,
          status: "failed",
          jobId: existingJobId,
        });
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
    const errJobId = (err as WindmillError & { jobId?: string }).jobId;
    await trackHookInvocation(ctx, {
      phase: "before",
      mode: "sync",
      script: hook.script_path,
      started_at: startedIso,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - started,
      args: payload,
      error: (err as Error).message,
      status: "failed",
      jobId: errJobId,
    });

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
  if (!settings) return { hooked: false, success: true, mode: "async" };

  const hook = findHook(settings, ctx.channel, ctx.operation, "on");
  if (!hook) return { hooked: false, success: true, mode: "async" };

  const mode = resolveMode(hook);
  const timeout = hook.timeout_ms ?? settings.timeout_ms;
  const payload = buildPayload(ctx, "on");
  const ws = workspace(settings);
  const baseUrl = process.env.WINDMILL_BASE_URL || settings.windmill_base_url || undefined;

  const started = Date.now();
  const startedIso = new Date(started).toISOString();

  try {
    const { result: res, jobId } = await windmillRunTracked<OnHookResponse>(
      ws, hook.script_path, payload, timeout, baseUrl,
    );

    await trackHookInvocation(ctx, {
      phase: "on",
      mode: "sync",
      script: hook.script_path,
      started_at: startedIso,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - started,
      args: payload,
      result: res,
      status: res.success !== false ? "completed" : "failed",
      error: res.success === false ? res.error : undefined,
      jobId,
    });

    return {
      hooked: true,
      success: res.success !== false,
      response: res,
      mode,
    };
  } catch (err) {
    const timedOut = err instanceof WindmillError && err.status === 504;
    const jobId = (err as WindmillError & { jobId?: string }).jobId;
    console.error(`[windmill-proxy] on ${ctx.operation} failed:`, err);

    await trackHookInvocation(ctx, {
      phase: "on",
      mode: "sync",
      script: hook.script_path,
      started_at: startedIso,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - started,
      args: payload,
      error: timedOut ? "ERP sync timed out" : (err as Error).message,
      status: "failed",
      jobId,
    });

    return {
      hooked: true,
      success: false,
      timedOut,
      error: timedOut ? "ERP sync timed out" : (err as Error).message,
      mode,
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
): Promise<OnHookResult> {
  const settings = await getProxySettings(ctx.tenantDb);
  if (!settings) return { hooked: false, success: true, mode: "async" };

  const hook = findHook(settings, ctx.channel, ctx.operation, "on");
  if (!hook) return { hooked: false, success: true, mode: "async" };

  const timeout = hook.timeout_ms ?? syncTimeoutMs;
  const payload = buildPayload(ctx, "on");
  const ws = workspace(settings);
  const baseUrl = process.env.WINDMILL_BASE_URL || settings.windmill_base_url || undefined;

  const started = Date.now();
  const startedIso = new Date(started).toISOString();

  try {
    // Sync attempt — wait up to timeout (returns real Windmill job_id)
    const { result: res, jobId } = await windmillRunTracked<OnHookResponse>(
      ws, hook.script_path, payload, timeout, baseUrl,
    );

    await trackHookInvocation(ctx, {
      phase: "on",
      mode: "sync",
      script: hook.script_path,
      started_at: startedIso,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - started,
      args: payload,
      result: res,
      status: res.success !== false ? "completed" : "failed",
      error: res.success === false ? res.error : undefined,
      jobId,
    });

    return {
      hooked: true,
      success: res.success !== false,
      response: res,
      mode: "blocking_with_fallback",
      async: false,
    };
  } catch (err) {
    const timedOut = err instanceof WindmillError && err.status === 504;

    if (timedOut) {
      // Sync timed out — reuse the jobId from the timeout error if present
      // (the job is already running on Windmill from windmillRunTracked).
      const existingJobId = (err as WindmillError & { jobId?: string }).jobId;
      try {
        const jobId =
          existingJobId ??
          (await windmillRunAsync(ws, hook.script_path, payload, baseUrl));
        await trackHookInvocation(ctx, {
          phase: "on",
          mode: "async",
          script: hook.script_path,
          started_at: startedIso,
          jobId,
          args: payload,
          status: "queued",
        });
        return {
          hooked: true,
          success: true,
          mode: "blocking_with_fallback",
          async: true,
          jobId,
        };
      } catch (asyncErr) {
        console.error(`[windmill-proxy] on ${ctx.operation} async fallback failed:`, asyncErr);
        await trackHookInvocation(ctx, {
          phase: "on",
          mode: "async",
          script: hook.script_path,
          started_at: startedIso,
          completed_at: new Date().toISOString(),
          args: payload,
          error: (asyncErr as Error).message,
          status: "failed",
          jobId: existingJobId,
        });
        return {
          hooked: true,
          success: false,
          error: "ERP sync failed (async fallback)",
          mode: "blocking_with_fallback",
        };
      }
    }

    // Non-timeout error
    console.error(`[windmill-proxy] on ${ctx.operation} failed:`, err);
    const errJobId = (err as WindmillError & { jobId?: string }).jobId;
    await trackHookInvocation(ctx, {
      phase: "on",
      mode: "sync",
      script: hook.script_path,
      started_at: startedIso,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - started,
      args: payload,
      error: (err as Error).message,
      status: "failed",
      jobId: errJobId,
    });
    return {
      hooked: true,
      success: false,
      timedOut: false,
      error: (err as Error).message,
      mode: "blocking_with_fallback",
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

      const startedIso = new Date().toISOString();
      windmillRunAsync(ws, hook.script_path, payload, baseUrl)
        .then((jobId) => {
          trackHookInvocation(ctx, {
            phase: "after",
            mode: "async",
            script: hook.script_path,
            started_at: startedIso,
            jobId,
            args: payload,
            status: "queued",
          }).catch(() => {});
        })
        .catch((err) => {
          console.error(`[windmill-proxy] after ${ctx.operation} failed:`, err);
          trackHookInvocation(ctx, {
            phase: "after",
            mode: "async",
            script: hook.script_path,
            started_at: startedIso,
            completed_at: new Date().toISOString(),
            args: payload,
            error: (err as Error).message,
            status: "failed",
          }).catch(() => {});
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
  ref: {
    job_id: string;
    script: string;
    phase: string;
    operation: string;
    status?: "queued" | "completed" | "failed";
    error?: string;
    duration_ms?: number;
    mode?: "sync" | "async";
    /** Inline payload sent to Windmill — used for sync calls where we cannot
     *  round-trip through the Windmill API to retrieve args later. */
    args?: unknown;
    /** Inline result returned by Windmill (sync) so the activity modal can
     *  render it without a second Windmill fetch. */
    result?: unknown;
    started_at?: string;
    completed_at?: string;
  },
): Promise<void> {
  const now = new Date().toISOString();
  await OrderModel.updateOne(
    { order_id: orderId },
    {
      $push: {
        "erp_data.windmill_jobs": {
          ...ref,
          timestamp: ref.started_at ?? now,
          ...(ref.status === "completed" || ref.status === "failed"
            ? { completed_at: ref.completed_at ?? now }
            : {}),
        },
      },
    },
  );
}

// ─── CENTRALISED HOOK INVOCATION TRACKER ────────────────────────
//
// Called from every runner (before/on/after, sync or async) so that a
// job ref lands on `order.erp_data.windmill_jobs[]` for every Windmill
// call that ran against this order — not just submits. The activity
// modal reads this array to build the Jobs section of the timeline.
//
// Silent on error: if the order doesn't exist yet (e.g. pre-creation
// hook) or the push fails, the caller's Windmill work still succeeds.

interface TrackHookInvocationParams {
  phase: "before" | "on" | "after";
  mode: "sync" | "async";
  script: string;
  started_at: string;
  completed_at?: string;
  /** Windmill job ID — present for async calls. */
  jobId?: string;
  /** Payload sent to Windmill. */
  args: unknown;
  /** Result body from Windmill (sync only). */
  result?: unknown;
  /** Error message when the hook failed. */
  error?: string;
  /** Explicit status override. Defaults to success/failed based on `error`. */
  status?: "queued" | "completed" | "failed";
  duration_ms?: number;
}

async function trackHookInvocation(
  ctx: HookContext,
  params: TrackHookInvocationParams,
): Promise<void> {
  if (!ctx.orderId) return;
  try {
    const { Order } = await connectWithModels(ctx.tenantDb);
    const defaultStatus: "queued" | "completed" | "failed" =
      params.status ??
      (params.mode === "async" && !params.completed_at
        ? "queued"
        : params.error
          ? "failed"
          : "completed");
    await pushWindmillJobRef(Order, ctx.orderId, {
      job_id:
        params.jobId ||
        `sync-${params.phase}-${ctx.operation}-${params.started_at}`,
      script: params.script,
      phase: params.phase,
      operation: ctx.operation,
      mode: params.mode,
      status: defaultStatus,
      error: params.error,
      duration_ms: params.duration_ms,
      args: params.args,
      result: params.result,
      started_at: params.started_at,
      completed_at: params.completed_at,
    });
  } catch (err) {
    console.error(
      `[windmill-proxy] trackHookInvocation failed (${ctx.operation}/${params.phase}):`,
      err,
    );
  }
}

/**
 * Update the status of an existing Windmill job reference by job_id.
 * Uses MongoDB positional operator to update the matching array element.
 */
export async function updateWindmillJobStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  OrderModel: any,
  orderId: string,
  jobId: string,
  update: {
    status: "completed" | "failed";
    error?: string;
    duration_ms?: number;
  },
): Promise<void> {
  const $set: Record<string, unknown> = {
    "erp_data.windmill_jobs.$.status": update.status,
    "erp_data.windmill_jobs.$.completed_at": new Date().toISOString(),
  };
  if (update.duration_ms !== undefined) {
    $set["erp_data.windmill_jobs.$.duration_ms"] = update.duration_ms;
  }
  if (update.error) {
    $set["erp_data.windmill_jobs.$.error"] = update.error;
  }
  await OrderModel.updateOne(
    { order_id: orderId, "erp_data.windmill_jobs.job_id": jobId },
    { $set },
  );
}

// ─── ORDER ERP DATA MERGE ─────────────────────────────────────────

/**
 * Merge ERP data from an "on" hook response onto the order document.
 * Expects on.response.data to contain:
 *   { erp_data: {...}, erp_items?: [{ line_number, erp_data }] }
 */
// ─── ASYNC ON-HOOK (fire-and-forget, collect later) ─────────────

/**
 * Fire on-hook asynchronously. Returns job ID immediately.
 * The Windmill job runs independently — no HTTP connection dependency.
 * Use `collectOnHookJob()` on a subsequent request to merge the result.
 */
export async function runOnHookAsync(
  ctx: HookContext,
): Promise<{ hooked: boolean; jobId?: string }> {
  const settings = await getProxySettings(ctx.tenantDb);
  if (!settings) return { hooked: false };

  const hook = findHook(settings, ctx.channel, ctx.operation, "on");
  if (!hook) return { hooked: false };

  const payload = buildPayload(ctx, "on");
  const ws = workspace(settings);
  const baseUrl = process.env.WINDMILL_BASE_URL || settings.windmill_base_url || undefined;

  const startedIso = new Date().toISOString();
  try {
    const jobId = await windmillRunAsync(ws, hook.script_path, payload, baseUrl);
    await trackHookInvocation(ctx, {
      phase: "on",
      mode: "async",
      script: hook.script_path,
      started_at: startedIso,
      jobId,
      args: payload,
      status: "queued",
    });
    return { hooked: true, jobId };
  } catch (err) {
    console.error(`[windmill-proxy] async on ${ctx.operation} failed:`, err);
    await trackHookInvocation(ctx, {
      phase: "on",
      mode: "async",
      script: hook.script_path,
      started_at: startedIso,
      completed_at: new Date().toISOString(),
      args: payload,
      error: (err as Error).message,
      status: "failed",
    });
    return { hooked: false };
  }
}

// ─── ON PHASE — AUTO (respects hook mode setting) ───────────────

/**
 * Unified on-hook runner that respects the hook's `mode` setting:
 * - "async" → fire-and-forget (runOnHookAsync)
 * - "blocking" → wait for result (runOnHook)
 * - "blocking_with_fallback" → try sync, fallback to async on timeout
 */
export async function runOnHookAuto(
  ctx: HookContext,
): Promise<OnHookResult> {
  const settings = await getProxySettings(ctx.tenantDb);
  if (!settings) return { hooked: false, success: true, mode: "async" };

  const hook = findHook(settings, ctx.channel, ctx.operation, "on");
  if (!hook) return { hooked: false, success: true, mode: "async" };

  const mode = resolveMode(hook);

  if (mode === "async") {
    const result = await runOnHookAsync(ctx);
    return { hooked: result.hooked, success: true, mode: "async", async: true, jobId: result.jobId };
  }
  if (mode === "blocking_with_fallback") {
    return runOnHookWithAsyncFallback(ctx);
  }
  // "blocking" — sync, wait for ERP response
  return runOnHook(ctx);
}

/**
 * runOnHookAuto + merge ERP data + fire after hook.
 * When `orderId` is provided, pushes a job ref with status tracking for sync results.
 */
export async function runOnMergeAfterAuto(
  ctx: HookContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  OrderModel: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orderDbId: any,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _opts?: { orderId?: string },
): Promise<OnHookResult> {
  const on = await runOnHookAuto(ctx);
  if (on.hooked && !on.async && on.success && on.response?.data) {
    await mergeOrderErpData(OrderModel, orderDbId, on.response);
  }
  // Job refs are now pushed by the underlying runners when ctx.orderId is set.
  runAfterHook(ctx);
  return on;
}

/**
 * runOnHookAuto + merge ERP data. Does NOT fire the after hook —
 * use when the after phase is emitted by the service layer on status change.
 */
export async function runOnMergeAuto(
  ctx: HookContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  OrderModel: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orderDbId: any,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _opts?: { orderId?: string },
): Promise<OnHookResult> {
  const on = await runOnHookAuto(ctx);
  if (on.hooked && !on.async && on.success && on.response?.data) {
    await mergeOrderErpData(OrderModel, orderDbId, on.response);
  }
  // Job refs are now pushed by the underlying runners when ctx.orderId is set.
  return on;
}

/**
 * Check if an async on-hook job has completed. If so, merge the result.
 * Returns the merged response or null if not yet completed / not hooked.
 */
export async function collectOnHookJob(
  tenantDb: string,
  jobId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  OrderModel: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orderDbId: any,
): Promise<OnHookResponse | null> {
  const settings = await getProxySettings(tenantDb);
  const ws = settings?.workspace_name || process.env.WINDMILL_WORKSPACE || "";
  const baseUrl = process.env.WINDMILL_BASE_URL || settings?.windmill_base_url || undefined;

  try {
    const job = await windmillGetJobResult<OnHookResponse>(ws, jobId, baseUrl);
    if (!job.completed || !job.result) return null;

    const res = job.result;
    if (res.success !== false && res.data) {
      await mergeOrderErpData(OrderModel, orderDbId, res);
    }
    return res;
  } catch (err) {
    console.error(`[windmill-proxy] collectOnHookJob ${jobId} failed:`, err);
    return null;
  }
}

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
      ...(on?.hooked ? {
        on: {
          mode: on.mode,
          synced: on.success,
          timed_out: on.timedOut,
          ...(on.async ? { async: true } : {}),
          ...(on.jobId ? { jobId: on.jobId } : {}),
        },
      } : {}),
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = response.data as Record<string, any>;

  // New gift items from ERP (omaggio rows added by RisolviAnomalie)
  // Only push genuinely new items — check entity_code OR promo_code doesn't already exist as a gift
  // (VINC gifts may use a different article code than the ERP, e.g. VERNELSUPREME vs 519458)
  if (data.new_items?.length) {
    const order = await OrderModel.findById(orderId, { items: 1 }).lean();
    const existingGifts = (order?.items || []).filter((i: any) => i.is_gift_line);
    const existingGiftCodes = new Set(existingGifts.map((i: any) => i.entity_code));
    const existingGiftPromos = new Set(
      existingGifts.map((i: any) => i.promo_code || i.gift_with_purchase).filter(Boolean)
    );
    const trulyNew = (data.new_items as Array<Record<string, unknown>>).filter(
      (item) =>
        !existingGiftCodes.has(item.entity_code as string) &&
        (!item.promo_code || !existingGiftPromos.has(item.promo_code as string))
    );
    if (trulyNew.length > 0) {
      await OrderModel.updateOne(
        { _id: orderId },
        { $push: { items: { $each: trulyNew } } },
      );
    }
  }

  // NOTE: updated_items and removed_erp_lines are intentionally NOT applied.
  // The ERP may renumber rows after RisolviAnomalie, making erp_line-based
  // matching unreliable. VINC is authoritative for its own items — the ERP
  // is only authoritative for adding NEW gift rows (omaggio).
  // Price/qty corrections from the ERP are informational (stored in erp_data)
  // and the final truth is established at order confirmation via on-order-submit.
}

// ─── STATUS TRANSITION → HOOK EMITTER ────────────────────────────
//
// Called from the service layer whenever order.status changes, so the
// correct order.* after-hook fires regardless of which route / code path
// performed the transition. Before/on phases remain in route handlers.

const STATUS_TO_OPERATION: Record<string, Record<string, HookOperation>> = {
  draft: {
    pending: "order.submit",
    confirmed: "order.confirm",
  },
  pending: {
    confirmed: "order.confirm",
  },
  quotation: {
    confirmed: "order.confirm",
  },
  confirmed: {
    preparing: "order.preparing",
    shipped: "order.ship",
  },
  preparing: {
    shipped: "order.ship",
  },
  shipped: {
    delivered: "order.deliver",
  },
};

/**
 * Map an order.status transition to the canonical HookOperation.
 * Returns null for no-op, unmapped transitions, or reverts.
 * `* → cancelled` always maps to `order.cancel` regardless of source.
 */
export function operationForTransition(
  from: string | undefined,
  to: string,
): HookOperation | null {
  if (!to || from === to) return null;
  if (to === "cancelled") return "order.cancel";
  if (!from) return null;
  return STATUS_TO_OPERATION[from]?.[to] ?? null;
}

/**
 * Fire-and-forget after-hook for an order status transition. Computes the
 * operation from the from→to pair, builds the hook context from the saved
 * order, and dispatches to runAfterHook. No-op when the transition doesn't
 * map to any hook operation.
 *
 * Services call this exactly once per transition step after `.save()`
 * succeeds. For cascading transitions (e.g. submitOrder goes draft→pending→
 * confirmed in one save), call once per step so every hook fires.
 *
 * Note: `to` is passed explicitly rather than read from `order.status`, so
 * cascades can emit for intermediate steps after the order has already been
 * persisted at the final state.
 */
export function emitStatusChangeAfterHook(
  tenantDb: string,
  tenantId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order: any,
  transition: { from: string | undefined; to: string },
  opts?: { addressCode?: string; requestData?: Record<string, unknown> },
): void {
  const operation = operationForTransition(transition.from, transition.to);
  if (!operation) return;
  const plain = typeof order?.toObject === "function" ? order.toObject() : order;
  const ctx = buildHookCtxFromOrder(tenantDb, tenantId, operation, plain, opts);
  runAfterHook(ctx);
}

/**
 * Derive tenantId from a tenant db name (vinc-${tenantId} convention).
 * Centralized so services can emit hooks without taking tenantId as a param.
 */
export function tenantIdFromDbName(dbName: string): string {
  return dbName.startsWith("vinc-") ? dbName.slice(5) : dbName;
}
