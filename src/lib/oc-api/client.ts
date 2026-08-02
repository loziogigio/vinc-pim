import type {
  OCAvailability,
  OCAvailabilityRequest,
  OCCatalogCruise,
  OCCreateQuoteRequest,
  OCOrder,
  OCPassenger,
  OCQuote,
} from "./types";

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

  /** Create an OC quote for a cruise + cabin type + price type (PIM gateway). */
  async createQuote(input: OCCreateQuoteRequest): Promise<OCQuote> {
    const body = await this.request<{ data: OCQuote }>(
      "/api/v1/gateway/quotes",
      { method: "POST", body: JSON.stringify(input) },
    );
    return body.data;
  }

  /**
   * Submit a booking for an existing quote with `option_only: true` — creates
   * a real MSC cabin OPTION (guarantee cabin, no cabin selection) rather than
   * a firm booking. Never call this without option_only for immediate-confirm
   * cruises unless a firm booking is explicitly intended.
   */
  async bookOption(quoteUuid: string, passengers: OCPassenger[]): Promise<OCOrder> {
    const body = await this.request<{ data: OCOrder }>(
      `/api/v1/gateway/quotes/${quoteUuid}/book`,
      { method: "POST", body: JSON.stringify({ option_only: true, passengers }) },
    );
    return body.data;
  }

  /** Cancel an order created via bookOption/book (PIM gateway). */
  async cancelOrder(orderUuid: string, reason: string): Promise<OCOrder> {
    const body = await this.request<{ data: OCOrder }>(
      `/api/v1/gateway/orders/${orderUuid}/cancel`,
      { method: "POST", body: JSON.stringify({ reason }) },
    );
    return body.data;
  }

  /**
   * Public catalog cruise detail (no gateway key check on the OC side).
   * Used to resolve cabin_type_id/price_type_id from a cabin category code
   * when the stored quotation snapshot only has the code (e.g. "IB").
   */
  async getCatalogCruise(ocCruiseId: number): Promise<OCCatalogCruise> {
    const body = await this.request<{ data: OCCatalogCruise }>(
      `/api/v1/catalog/cruises/${ocCruiseId}`,
      { method: "GET" },
    );
    return body.data;
  }
}

export function getOCApiForTenant(tenantId: string): OCApiClient {
  const baseUrl = process.env.OC_API_URL || "http://localhost:8000";
  const gatewayKey = process.env.OC_GATEWAY_KEY || "";
  return new OCApiClient({ baseUrl, gatewayKey, tenantId });
}
