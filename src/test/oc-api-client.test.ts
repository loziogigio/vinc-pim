import { afterEach, describe, expect, it, vi } from "vitest";
import { OCApiClient, OCApiError } from "@/lib/oc-api/client";

const AVAIL = {
  source: "msc", oc_cruise_id: 6, category: "IR1", available: true,
  cabins_available: 128, guarantees_available: 0, price_code: "VIC00719IT6024EA",
  price: { currency: "EUR", per_pax: [{ pax_no: 1, type: "ADT", amount: "979.00" }],
           total_gross: "979.00", taxes: "0", commission: "0" },
};

afterEach(() => vi.restoreAllMocks());

describe("OCApiClient.getCruiseAvailability", () => {
  it("posts to the gateway endpoint with the gateway key and returns data", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: AVAIL }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new OCApiClient({ baseUrl: "http://oc:8000", gatewayKey: "k", tenantId: "t" });
    const res = await client.getCruiseAvailability({ oc_cruise_id: 6, category: "IR1", adults: 2, children: 0 });
    expect(res.available).toBe(true);
    expect(res.price.total_gross).toBe("979.00");
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("http://oc:8000/api/v1/gateway/availability");
    expect((opts.headers as Record<string, string>)["X-Gateway-Key"]).toBe("k");
    expect(JSON.parse(opts.body as string)).toEqual({ oc_cruise_id: 6, category: "IR1", adults: 2, children: 0 });
  });

  it("throws OCApiError on non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad", { status: 502 })));
    const client = new OCApiClient({ baseUrl: "http://oc:8000", gatewayKey: "k", tenantId: "t" });
    await expect(
      client.getCruiseAvailability({ oc_cruise_id: 6, category: "IR1", adults: 2, children: 0 }),
    ).rejects.toBeInstanceOf(OCApiError);
  });
});
