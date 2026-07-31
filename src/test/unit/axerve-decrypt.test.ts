/**
 * Unit Tests for the Axerve/GestPay Decrypt callback path.
 *
 * SOAP calls are mocked at the fetch layer — no live GestPay traffic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { decryptCallback, axerveProvider } from "@/lib/payments/providers/axerve/client";

// Dummy credential for the mocked SOAP layer — never reaches a network call.
const FAKE_CREDENTIAL = "sandbox-dummy-value";

const CONFIG = {
  shop_login: "TESTSHOP",
  api_key: FAKE_CREDENTIAL,
  environment: "sandbox" as const,
};

function soapResponse(inner: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Body>
    <DecryptResponse xmlns="https://ecomms2s.sella.it/">
      <DecryptResult>
        <GestPayCryptDecrypt>${inner}</GestPayCryptDecrypt>
      </DecryptResult>
    </DecryptResponse>
  </soap:Body>
</soap:Envelope>`;
}

function mockFetchOnce(body: string, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    text: async () => body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("unit: axerve decryptCallback", () => {
  it("parses a successful GestPay callback into typed fields", async () => {
    mockFetchOnce(
      soapResponse(`
        <TransactionResult>OK</TransactionResult>
        <ShopTransactionID>PA-12-2026</ShopTransactionID>
        <BankTransactionID>1234567</BankTransactionID>
        <AuthorizationCode>A1B2C3</AuthorizationCode>
        <Amount>149.90</Amount>
        <Currency>242</Currency>
        <ErrorCode>0</ErrorCode>
        <ErrorDescription></ErrorDescription>`)
    );

    const result = await decryptCallback(CONFIG, "crypted-blob");

    expect(result.transaction_result).toBe("OK");
    expect(result.shop_transaction_id).toBe("PA-12-2026");
    expect(result.bank_transaction_id).toBe("1234567");
    expect(result.authorization_code).toBe("A1B2C3");
    expect(result.amount).toBe("149.90");
    expect(result.currency).toBe("242");
    expect(result.error_code).toBe("0");
  });

  it("parses a KO callback with the GestPay error code and description", async () => {
    mockFetchOnce(
      soapResponse(`
        <TransactionResult>KO</TransactionResult>
        <ShopTransactionID>PA-13-2026</ShopTransactionID>
        <BankTransactionID></BankTransactionID>
        <ErrorCode>1119</ErrorCode>
        <ErrorDescription>Transaction refused</ErrorDescription>`)
    );

    const result = await decryptCallback(CONFIG, "crypted-blob");

    expect(result.transaction_result).toBe("KO");
    expect(result.error_code).toBe("1119");
    expect(result.error_description).toBe("Transaction refused");
    expect(result.bank_transaction_id).toBe("");
  });

  it("extracts the recurring TOKEN when GestPay returns one", async () => {
    mockFetchOnce(
      soapResponse(`
        <TransactionResult>OK</TransactionResult>
        <ShopTransactionID>PA-14-2026</ShopTransactionID>
        <BankTransactionID>987</BankTransactionID>
        <TOKEN>tok-abc-123</TOKEN>
        <ErrorCode>0</ErrorCode>`)
    );

    const result = await decryptCallback(CONFIG, "crypted-blob");

    expect(result.token).toBe("tok-abc-123");
  });

  it("posts to the sandbox WSCryptDecrypt endpoint with the Decrypt method", async () => {
    const fetchMock = mockFetchOnce(
      soapResponse(`<TransactionResult>OK</TransactionResult><ErrorCode>0</ErrorCode>`)
    );

    await decryptCallback(CONFIG, "crypted-blob");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://sandbox.gestpay.net/gestpay/gestpayws/WSCryptDecrypt.asmx");
    expect(init.body).toContain("<Decrypt");
    expect(init.body).toContain("<CryptedString>crypted-blob</CryptedString>");
    expect(init.body).toContain("<shopLogin>TESTSHOP</shopLogin>");
  });

  it("uses the production endpoint when environment is production", async () => {
    const fetchMock = mockFetchOnce(
      soapResponse(`<TransactionResult>OK</TransactionResult><ErrorCode>0</ErrorCode>`)
    );

    await decryptCallback({ ...CONFIG, environment: "production" }, "crypted-blob");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://ecomms2s.sella.it/gestpay/gestpayws/WSCryptDecrypt.asmx"
    );
  });

  it("throws when the SOAP request fails at the HTTP layer", async () => {
    mockFetchOnce("upstream exploded", false, 502);

    await expect(decryptCallback(CONFIG, "crypted-blob")).rejects.toThrow(/502/);
  });
});

describe("unit: axerve createPayment shopTransactionId", () => {
  it("uses the per-attempt payment_number (slashes replaced) as shopTransactionId", async () => {
    const fetchMock = mockFetchOnce(
      `<CryptDecryptString>ENCRYPTED</CryptDecryptString><ErrorCode>0</ErrorCode>`
    );

    const result = await axerveProvider.createPayment(CONFIG, {
      order_id: "ORD-1",
      amount: 149.9,
      currency: "EUR",
      metadata: { payment_number: "PA/12/2026" },
    });

    expect(fetchMock.mock.calls[0][1].body).toContain(
      "<shopTransactionId>PA-12-2026</shopTransactionId>"
    );
    expect(result.provider_payment_id).toBe("PA-12-2026");
  });

  it("falls back to order_id when no payment_number is supplied", async () => {
    const fetchMock = mockFetchOnce(
      `<CryptDecryptString>ENCRYPTED</CryptDecryptString><ErrorCode>0</ErrorCode>`
    );

    const result = await axerveProvider.createPayment(CONFIG, {
      order_id: "ORD-2",
      amount: 10,
      currency: "EUR",
    });

    expect(fetchMock.mock.calls[0][1].body).toContain(
      "<shopTransactionId>ORD-2</shopTransactionId>"
    );
    expect(result.provider_payment_id).toBe("ORD-2");
  });
});

describe("unit: axerve parseWebhookEvent", () => {
  it("maps a decrypted OK payload to payment.completed keyed on BankTransactionID", () => {
    const payload = JSON.stringify({
      transaction_result: "OK",
      shop_transaction_id: "PA-12-2026",
      bank_transaction_id: "1234567",
      authorization_code: "A1B2C3",
      amount: "149.90",
      currency: "242",
      token: "",
      error_code: "0",
      error_description: "",
    });

    const event = axerveProvider.parseWebhookEvent(payload);

    expect(event.provider).toBe("axerve");
    expect(event.event_type).toBe("payment.completed");
    expect(event.event_id).toBe("1234567");
    expect(event.data.shop_transaction_id).toBe("PA-12-2026");
  });

  it("maps a decrypted KO payload to payment.failed and falls back to the shop id", () => {
    const payload = JSON.stringify({
      transaction_result: "KO",
      shop_transaction_id: "PA-13-2026",
      bank_transaction_id: "",
      error_code: "1119",
      error_description: "Transaction refused",
    });

    const event = axerveProvider.parseWebhookEvent(payload);

    expect(event.event_type).toBe("payment.failed");
    expect(event.event_id).toBe("PA-13-2026");
  });
});
