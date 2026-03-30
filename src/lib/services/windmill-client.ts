/**
 * Windmill HTTP client.
 *
 * Thin fetch wrapper for Windmill's REST API.
 * Follows the same pattern as oc-client.ts (AbortController timeout, custom error).
 */

const WM_BASE_URL = (process.env.WINDMILL_BASE_URL || "http://windmill:8000").replace(/\/+$/, "");
const WM_TOKEN = process.env.WINDMILL_TOKEN || "";
const WM_DEFAULT_TIMEOUT_MS = 5_000;

/** Strip trailing slashes from a URL to prevent double-slash issues. */
function normalizeBaseUrl(url?: string): string {
  return (url || WM_BASE_URL).replace(/\/+$/, "");
}

export class WindmillError extends Error {
  constructor(
    message: string,
    public status: number,
    public upstream?: string,
  ) {
    super(message);
    this.name = "WindmillError";
  }
}

/** Headers shared by every Windmill request. */
function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(WM_TOKEN ? { Authorization: `Bearer ${WM_TOKEN}` } : {}),
  };
}

/**
 * Synchronous call — waits for the script result.
 *
 * POST /api/w/{workspace}/jobs/run_wait_result/p/{scriptPath}
 */
export async function windmillRun<T = unknown>(
  workspace: string,
  scriptPath: string,
  payload: Record<string, unknown>,
  timeoutMs = WM_DEFAULT_TIMEOUT_MS,
  baseUrl?: string,
): Promise<T> {
  const base = normalizeBaseUrl(baseUrl);
  const url = `${base}/api/w/${workspace}/jobs/run_wait_result/p/${scriptPath}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new WindmillError(
        `Windmill ${res.status}: ${scriptPath}`,
        res.status,
        body,
      );
    }

    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof WindmillError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new WindmillError("Windmill timeout", 504);
    }
    throw new WindmillError(
      `Windmill unreachable: ${(err as Error).message}`,
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Asynchronous call — fire-and-forget, returns the job ID.
 *
 * POST /api/w/{workspace}/jobs/run/p/{scriptPath}
 */
export async function windmillRunAsync(
  workspace: string,
  scriptPath: string,
  payload: Record<string, unknown>,
  baseUrl?: string,
): Promise<string> {
  const base = normalizeBaseUrl(baseUrl);
  const url = `${base}/api/w/${workspace}/jobs/run/p/${scriptPath}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new WindmillError(
        `Windmill async ${res.status}: ${scriptPath}`,
        res.status,
        body,
      );
    }

    // Windmill /jobs/run/p/ returns a plain UUID string, not JSON
    const text = await res.text();
    return text.trim().replace(/^"|"$/g, "");
  } catch (err) {
    if (err instanceof WindmillError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new WindmillError("Windmill async timeout", 504);
    }
    throw new WindmillError(
      `Windmill unreachable: ${(err as Error).message}`,
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Poll for a completed job result.
 *
 * GET /api/w/{workspace}/jobs_u/completed/get_result_maybe/{jobId}
 *
 * Returns { completed: true, result } if the job has finished,
 * or { completed: false } if still running.
 */
export async function windmillGetJobResult<T = unknown>(
  workspace: string,
  jobId: string,
  baseUrl?: string,
): Promise<{ completed: boolean; result?: T }> {
  const base = normalizeBaseUrl(baseUrl);
  const url = `${base}/api/w/${workspace}/jobs_u/completed/get_result_maybe/${jobId}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WM_DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: headers(),
      signal: controller.signal,
      cache: "no-store",
    });

    if (res.status === 200) {
      const body = await res.json();

      // Windmill get_result_maybe returns a job envelope: { started, success, completed, result }
      // If body has a `completed` field, unwrap the envelope
      if (body && typeof body === "object" && "completed" in body) {
        if (!body.completed) return { completed: false };
        return { completed: true, result: body.result as T };
      }

      // Direct result (some Windmill versions return the result directly)
      return { completed: true, result: body as T };
    }

    // 404 or other non-200 = job not yet completed or not found
    return { completed: false };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { completed: false };
    }
    throw new WindmillError(
      `Windmill job poll unreachable: ${(err as Error).message}`,
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Create a Windmill workspace for a tenant.
 * 409 = workspace already exists — not an error.
 */
export async function windmillCreateWorkspace(
  workspaceId: string,
  baseUrl?: string,
): Promise<void> {
  const base = normalizeBaseUrl(baseUrl);
  const url = `${base}/api/workspaces/create`;

  const res = await fetch(url, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ id: workspaceId, name: workspaceId }),
    cache: "no-store",
  });

  if (!res.ok && res.status !== 409) {
    const body = await res.text().catch(() => "");
    throw new WindmillError(
      `Windmill workspace creation failed: ${res.status}`,
      res.status,
      body,
    );
  }
}

/**
 * Create a folder in the shared Windmill workspace for tenant isolation.
 * Folder name: tenant_id with hyphens replaced by underscores.
 */
export async function windmillCreateFolder(
  tenantId: string,
  baseUrl?: string,
  workspace?: string,
): Promise<void> {
  const base = normalizeBaseUrl(baseUrl);
  const ws = workspace || process.env.WINDMILL_WORKSPACE || "";
  const url = `${base}/api/w/${ws}/folders/create`;
  const folderName = `vinc_${tenantId.replace(/-/g, "_")}`;

  const res = await fetch(url, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      name: folderName,
      extra_perms: {},
    }),
    cache: "no-store",
  });

  // 409/400 = folder already exists — not an error
  if (!res.ok && res.status !== 409 && res.status !== 400) {
    const body = await res.text().catch(() => "");
    throw new WindmillError(
      `Windmill folder creation failed: ${res.status}`,
      res.status,
      body,
    );
  }

  // Auto-create echo test script in the folder (best-effort)
  await windmillCreateEchoScript(folderName, base, ws);
}

/**
 * Create a simple echo script in the tenant folder for connectivity testing.
 * Silently skips if script already exists.
 */
async function windmillCreateEchoScript(
  folderName: string,
  baseUrl: string,
  workspace: string,
): Promise<void> {
  const scriptPath = `f/${folderName}/echo`;
  const url = `${baseUrl}/api/w/${workspace}/scripts/create`;

  const res = await fetch(url, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      path: scriptPath,
      summary: "VINC connectivity test",
      description: "Simple echo script for testing Windmill connectivity from VINC",
      content: "export async function main(args: any) {\n  return { success: true, message: \"Windmill connected\", timestamp: new Date().toISOString(), ...args };\n}",
      language: "deno",
      is_template: false,
    }),
    cache: "no-store",
  });

  // Script already exists — not an error
  if (!res.ok && res.status !== 409 && res.status !== 400) {
    console.warn(`[Windmill] Echo script creation failed (${res.status}), non-blocking`);
  }
}

/**
 * Create a user token for SSO into the Windmill UI.
 */
export async function windmillCreateUserToken(
  workspace: string,
  email: string,
  baseUrl?: string,
): Promise<string> {
  const base = normalizeBaseUrl(baseUrl);
  const url = `${base}/api/w/${workspace}/users/tokens/create`;

  const res = await fetch(url, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ email, label: "vinc-sso" }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new WindmillError(
      `Windmill token creation failed: ${res.status}`,
      res.status,
      body,
    );
  }

  return (await res.json()) as string;
}

/**
 * Log in to Windmill with email/password and get a session token.
 *
 * Used for SSO: VINC stores encrypted credentials and logs in on behalf of the user.
 * POST /api/auth/login → returns session token string.
 */
export async function windmillLogin(
  email: string,
  password: string,
  baseUrl?: string,
): Promise<string> {
  const base = normalizeBaseUrl(baseUrl);
  const url = `${base}/api/auth/login`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new WindmillError(
      `Windmill login failed: ${res.status}`,
      res.status,
      body,
    );
  }

  return (await res.json()) as string;
}
