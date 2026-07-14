// @vitest-environment node
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { FeedProduct } from "@/lib/feeds/canonical";

// Generate a throwaway RSA key so jose can sign the assertion for real.
import { generateKeyPairSync } from "crypto";
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PRIVATE_PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

const FP: FeedProduct = {
  entity_code: "LED-001", sku: "LED-001", title: "Lampada", description: "d",
  link: "https://x/p/1", image_link: undefined, additional_image_links: [],
  availability: "in_stock", quantity: 1, price: 10, currency: "EUR", condition: "new",
};

const fetchMock = vi.fn();

describe("GoogleMerchantClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  function tokenResponse() {
    return { ok: true, status: 200, json: async () => ({ access_token: "at_1", expires_in: 3600 }) };
  }

  it("authenticates then pushes products, capturing per-item errors", async () => {
    const { GoogleMerchantClient } = await import("@/lib/feeds/clients/google-client");
    fetchMock
      .mockResolvedValueOnce(tokenResponse()) // token exchange
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) }) // item 1 ok
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => '{"error":{"message":"missing gtin"}}' }); // item 2 fails

    const client = new GoogleMerchantClient({
      merchantAccountId: "123",
      serviceAccountJson: JSON.stringify({ client_email: "sa@x.iam.gserviceaccount.com", private_key: PRIVATE_PEM }),
      contentLanguage: "it",
      feedLabel: "IT",
    });
    const results = await client.pushProducts([FP, { ...FP, entity_code: "LED-002" }]);

    expect(results).toEqual([
      { entity_code: "LED-001", ok: true },
      { entity_code: "LED-002", ok: false, error: expect.stringContaining("missing gtin") },
    ]);
    // 1 token call + 2 insert calls
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [tokenUrl] = fetchMock.mock.calls[0];
    expect(String(tokenUrl)).toContain("oauth2.googleapis.com/token");
    const [insertUrl, insertInit] = fetchMock.mock.calls[1];
    expect(String(insertUrl)).toContain("/products/v1/accounts/123/productInputs:insert");
    expect((insertInit.headers as Record<string, string>).Authorization).toBe("Bearer at_1");
    const body = JSON.parse(insertInit.body as string);
    expect(body.offerId).toBe("LED-001");
  });

  it("reuses the cached token across calls and deletes by offer id", async () => {
    const { GoogleMerchantClient } = await import("@/lib/feeds/clients/google-client");
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

    const client = new GoogleMerchantClient({
      merchantAccountId: "123",
      serviceAccountJson: JSON.stringify({ client_email: "sa@x", private_key: PRIVATE_PEM }),
      contentLanguage: "it",
      feedLabel: "IT",
    });
    await client.pushProducts([FP]);
    const del = await client.deleteProducts(["LED-001"]);
    expect(del[0].ok).toBe(true);
    // token fetched exactly once
    const tokenCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes("/token"));
    expect(tokenCalls).toHaveLength(1);
  });
});
