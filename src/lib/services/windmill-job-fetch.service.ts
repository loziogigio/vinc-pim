/**
 * Windmill Job Fetch — retrieve full job details (args, result, logs)
 * for the Order Activity modal.
 *
 * Uses Windmill's job-introspection endpoints:
 *   - GET /api/w/{workspace}/jobs_u/get/{id}  (running or queued jobs)
 *   - GET /api/w/{workspace}/jobs_u/completed/get/{id}  (completed jobs)
 *
 * Falls back from "completed" to "get" when the job is still running.
 *
 * A small in-memory LRU cache prevents hammering Windmill when the feed
 * is repeatedly fetched (polling, tab focus, load-more). Completed jobs
 * are cached for 30s; running jobs for 3s.
 */

import { getProxySettings } from "./windmill-proxy.service";

export interface WindmillJobDetails {
  job_id: string;
  workspace_id?: string;
  script_path?: string;
  /** Input payload passed to the script. */
  args?: Record<string, unknown>;
  /** Output returned by the script (only when completed). */
  result?: unknown;
  /** Script stdout/stderr captured by Windmill. */
  logs?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  /** Maps Windmill states to a simpler status for UI colouring. */
  status: "running" | "queued" | "success" | "failure" | "unknown";
  /** When the job wasn't found (stale id in erp_data), we still return
   *  a details object so the UI can render a placeholder row. */
  not_found?: boolean;
  /** Set when the Windmill API call itself failed (timeout, 5xx). */
  fetch_error?: string;
}

// ─── CACHE ────────────────────────────────────────────────────────

const COMPLETED_TTL_MS = 30_000;
const RUNNING_TTL_MS = 3_000;
const MAX_ENTRIES = 500;

interface CacheEntry {
  details: WindmillJobDetails;
  expires: number;
}

/** Map preserves insertion order — we use that for LRU eviction. */
const cache = new Map<string, CacheEntry>();

function cacheKey(tenantDb: string, jobId: string): string {
  return `${tenantDb}:${jobId}`;
}

function readCache(key: string): WindmillJobDetails | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  // LRU: move to end
  cache.delete(key);
  cache.set(key, entry);
  return entry.details;
}

function writeCache(key: string, details: WindmillJobDetails): void {
  const ttl =
    details.status === "success" || details.status === "failure"
      ? COMPLETED_TTL_MS
      : RUNNING_TTL_MS;
  cache.set(key, { details, expires: Date.now() + ttl });
  if (cache.size > MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
}

// ─── WORKSPACE + AUTH RESOLUTION ─────────────────────────────────

async function resolveWorkspace(tenantDb: string): Promise<string | null> {
  const settings = await getProxySettings(tenantDb);
  const ws = settings?.workspace_name || process.env.WINDMILL_WORKSPACE || "";
  return ws || null;
}

function windmillHeaders(): Record<string, string> {
  const token = process.env.WINDMILL_TOKEN || "";
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function windmillBaseUrl(): string {
  return (process.env.WINDMILL_BASE_URL || "http://windmill:8000").replace(/\/+$/, "");
}

// ─── LOW-LEVEL FETCH ─────────────────────────────────────────────

type WindmillJobBody = Record<string, unknown> & {
  id?: string;
  workspace_id?: string;
  script_path?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  logs?: string;
  started_at?: string;
  completed?: boolean;
  success?: boolean;
  running?: boolean;
  duration_ms?: number;
  type?: string;
};

async function fetchWindmillEndpoint(
  workspace: string,
  path: string,
): Promise<WindmillJobBody | null> {
  const url = `${windmillBaseUrl()}/api/w/${workspace}/${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: windmillHeaders(),
      signal: controller.signal,
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Windmill ${res.status} at ${path}`);
    }
    return (await res.json()) as WindmillJobBody;
  } finally {
    clearTimeout(timeout);
  }
}

function toDetails(body: WindmillJobBody, jobId: string): WindmillJobDetails {
  const running = body.running === true;
  const completed = body.completed === true || body.type === "CompletedJob";
  let status: WindmillJobDetails["status"];
  if (completed) status = body.success ? "success" : "failure";
  else if (running) status = "running";
  else if (body.type === "QueuedJob") status = "queued";
  else status = "unknown";

  const started = body.started_at as string | undefined;
  const duration =
    typeof body.duration_ms === "number"
      ? body.duration_ms
      : started && completed
        ? Date.now() - new Date(started).getTime()
        : undefined;

  return {
    job_id: (body.id as string | undefined) || jobId,
    workspace_id: body.workspace_id,
    script_path: body.script_path,
    args: body.args,
    result: completed ? body.result : undefined,
    logs: typeof body.logs === "string" ? body.logs : undefined,
    started_at: started,
    completed_at: completed && started && duration ? new Date(new Date(started).getTime() + duration).toISOString() : undefined,
    duration_ms: duration,
    status,
  };
}

// ─── PUBLIC API ──────────────────────────────────────────────────

/**
 * Fetch detailed info for a single Windmill job. Uses an in-memory
 * cache keyed by (tenantDb, jobId). Always resolves — on failure
 * returns a details object with `fetch_error` or `not_found` set
 * so the UI can still render a timeline entry.
 */
export async function fetchWindmillJob(
  tenantDb: string,
  jobId: string,
): Promise<WindmillJobDetails> {
  if (!jobId) {
    return { job_id: jobId, status: "unknown", not_found: true };
  }

  const key = cacheKey(tenantDb, jobId);
  const cached = readCache(key);
  if (cached) return cached;

  const workspace = await resolveWorkspace(tenantDb);
  if (!workspace) {
    const details: WindmillJobDetails = {
      job_id: jobId,
      status: "unknown",
      fetch_error: "Windmill workspace not configured",
    };
    return details;
  }

  try {
    // Try completed endpoint first — most jobs on the timeline are done.
    let body = await fetchWindmillEndpoint(
      workspace,
      `jobs_u/completed/get/${jobId}`,
    );
    if (!body) {
      // Falls through to the generic /get endpoint for queued/running jobs.
      body = await fetchWindmillEndpoint(workspace, `jobs_u/get/${jobId}`);
    }
    if (!body) {
      const details: WindmillJobDetails = {
        job_id: jobId,
        status: "unknown",
        not_found: true,
      };
      writeCache(key, details);
      return details;
    }
    const details = toDetails(body, jobId);
    writeCache(key, details);
    return details;
  } catch (err) {
    const details: WindmillJobDetails = {
      job_id: jobId,
      status: "unknown",
      fetch_error: err instanceof Error ? err.message : String(err),
    };
    // Short TTL on errors so we retry soon.
    cache.set(key, { details, expires: Date.now() + RUNNING_TTL_MS });
    return details;
  }
}

/** Fetch multiple jobs in parallel, deduplicating ids. */
export async function fetchWindmillJobs(
  tenantDb: string,
  jobIds: string[],
): Promise<Map<string, WindmillJobDetails>> {
  const unique = Array.from(new Set(jobIds.filter(Boolean)));
  const entries = await Promise.all(
    unique.map(async (id) => [id, await fetchWindmillJob(tenantDb, id)] as const),
  );
  return new Map(entries);
}
