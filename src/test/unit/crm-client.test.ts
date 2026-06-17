import { describe, it, expect, vi, afterEach } from "vitest";
import { TwentyClient, opportunityUrl, microsToNumber } from "@/lib/services/crm-client";

const cfg = { baseUrl: "https://vinc.crm.vendereincloud.it", apiKey: "tok" };
afterEach(() => vi.restoreAllMocks());

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("unit: TwentyClient", () => {
  it("creates an opportunity with amount in micros and Bearer auth", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ data: { createOpportunity: { id: "op1" } } }));
    vi.stubGlobal("fetch", fetchMock);
    const c = new TwentyClient(cfg);
    const r = await c.createOpportunity({ name: "Acme — b2b", stage: "NEW_LEAD", companyId: "c1", pointOfContactId: "p1", amountMicros: 1900000000, currencyCode: "EUR" });
    expect(r.id).toBe("op1");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string,string>).Authorization).toBe("Bearer tok");
  });

  it("microsToNumber converts amountMicros to a number", () => {
    expect(microsToNumber(1900000000)).toBe(1900);
    expect(microsToNumber(undefined)).toBeUndefined();
  });

  it("builds the opportunity URL", () => {
    expect(opportunityUrl(cfg.baseUrl, "op1")).toBe("https://vinc.crm.vendereincloud.it/object/opportunity/op1");
  });
});
