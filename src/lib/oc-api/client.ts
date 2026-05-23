import type { OCAvailability, OCAvailabilityRequest } from "./types";

export class OCApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail);
    this.name = "OCApiError";
  }
}

interface OCApiConfig {
  baseUrl: string;
  gatewayKey: string;
  tenantId: string;
}

export class OCApiClient {
  constructor(private config: OCApiConfig) {}

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.config.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Key": this.config.gatewayKey,
        "X-Tenant-ID": this.config.tenantId,
        ...(options.headers as Record<string, string>),
      },
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        detail = body.detail || body.error || detail;
      } catch {
        /* non-JSON body */
      }
      throw new OCApiError(res.status, detail);
    }
    return res.json() as Promise<T>;
  }

  async getCruiseAvailability(input: OCAvailabilityRequest): Promise<OCAvailability> {
    const body = await this.request<{ data: OCAvailability }>(
      "/api/v1/gateway/availability",
      { method: "POST", body: JSON.stringify(input) },
    );
    return body.data;
  }
}

export function getOCApiForTenant(tenantId: string): OCApiClient {
  const baseUrl = process.env.OC_API_URL || "http://localhost:8000";
  const gatewayKey = process.env.OC_GATEWAY_KEY || "";
  return new OCApiClient({ baseUrl, gatewayKey, tenantId });
}
