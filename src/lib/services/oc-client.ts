/**
 * OC (offerte-crociere) API client.
 *
 * Thin fetch wrapper for the cruise aggregator backend.
 * Used by catalog proxy routes to forward requests to OC.
 */

const OC_BASE_URL = process.env.AGGREGATOR_BASE_URL || "http://localhost:8000";
const OC_API_KEY = process.env.AGGREGATOR_API_KEY || "";
const OC_TIMEOUT_MS = 5000;

export class OCClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public upstream?: string,
  ) {
    super(message);
    this.name = "OCClientError";
  }
}

export async function ocFetch<T = unknown>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  const url = new URL(`/api/v1${path}`, OC_BASE_URL);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OC_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        ...(OC_API_KEY ? { "X-API-Key": OC_API_KEY } : {}),
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new OCClientError(
        `OC API ${res.status}: ${path}`,
        res.status,
        body,
      );
    }

    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof OCClientError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new OCClientError("OC API timeout", 504);
    }
    throw new OCClientError(
      `OC API unreachable: ${(err as Error).message}`,
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}
