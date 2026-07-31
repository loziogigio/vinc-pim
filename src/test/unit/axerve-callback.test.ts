/**
 * Unit Tests for the Axerve/GestPay server-to-server callback service.
 *
 * DB, decrypt, and BullMQ are mocked — this tests authentication and routing logic only.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetProviderConfig = vi.fn();
const mockDecryptCallback = vi.fn();
const mockQueueAdd = vi.fn();

vi.mock("@/lib/db/connection", () => ({
  getPooledConnection: vi.fn().mockResolvedValue({ name: "vinc-test-tenant" }),
}));

vi.mock("@/lib/payments/payment.service", () => ({
  getProviderConfig: (...args: unknown[]) => mockGetProviderConfig(...args),
}));

vi.mock("@/lib/payments/providers/axerve/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/payments/providers/axerve/client")>();
  return {
    ...actual,
    decryptCallback: (...args: unknown[]) => mockDecryptCallback(...args),
  };
});

vi.mock("@/lib/queue/queues", () => ({
  paymentQueue: { add: (...args: unknown[]) => mockQueueAdd(...args) },
}));

import { processAxerveCallback } from "@/lib/payments/webhook.service";

// Dummy credential for the mocked SOAP layer — never reaches a network call.
const FAKE_CREDENTIAL = "sandbox-dummy-value";

const TENANT_CONFIG = {
  shop_login: "TESTSHOP",
  api_key: FAKE_CREDENTIAL,
  environment: "sandbox",
  enabled: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetProviderConfig.mockResolvedValue(TENANT_CONFIG);
  mockQueueAdd.mockResolvedValue(undefined);
});

describe("unit: processAxerveCallback authentication", () => {
  it("rejects a callback with no tenant", async () => {
    const result = await processAxerveCallback("", "TESTSHOP", "crypted");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/tenant/i);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it("rejects when the tenant has no axerve config", async () => {
    mockGetProviderConfig.mockResolvedValue(null);

    const result = await processAxerveCallback("test-tenant", "TESTSHOP", "crypted");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not configured/i);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it("rejects when the shopLogin does not match the tenant config", async () => {
    const result = await processAxerveCallback("test-tenant", "OTHERSHOP", "crypted");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/shop/i);
    expect(mockDecryptCallback).not.toHaveBeenCalled();
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it("rejects a forged crypted string that fails to decrypt", async () => {
    mockDecryptCallback.mockRejectedValue(new Error("Axerve SOAP error 500: bad data"));

    const result = await processAxerveCallback("test-tenant", "TESTSHOP", "forged");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/decrypt/i);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it("rejects a decrypted payload with no transaction result", async () => {
    mockDecryptCallback.mockResolvedValue({
      transaction_result: "",
      shop_transaction_id: "",
      bank_transaction_id: "",
      authorization_code: "",
      amount: "",
      currency: "",
      token: "",
      error_code: "9999",
      error_description: "Malformed",
    });

    const result = await processAxerveCallback("test-tenant", "TESTSHOP", "crypted");

    expect(result.success).toBe(false);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });
});

describe("unit: processAxerveCallback enqueueing", () => {
  it("enqueues payment.completed for an OK result", async () => {
    mockDecryptCallback.mockResolvedValue({
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

    const result = await processAxerveCallback("test-tenant", "TESTSHOP", "crypted");

    expect(result.success).toBe(true);
    expect(result.event_type).toBe("payment.completed");
    expect(result.event_id).toBe("1234567");

    const [jobName, jobData, jobOpts] = mockQueueAdd.mock.calls[0];
    expect(jobName).toBe("payment.webhook");
    expect(jobData.provider).toBe("axerve");
    expect(jobData.tenant_id).toBe("test-tenant");
    expect(jobData.event.data.shop_transaction_id).toBe("PA-12-2026");
    expect(jobOpts.jobId).toBe("webhook-axerve-1234567");
  });

  it("enqueues payment.failed for a KO result", async () => {
    mockDecryptCallback.mockResolvedValue({
      transaction_result: "KO",
      shop_transaction_id: "PA-13-2026",
      bank_transaction_id: "",
      authorization_code: "",
      amount: "10.00",
      currency: "242",
      token: "",
      error_code: "1119",
      error_description: "Transaction refused",
    });

    const result = await processAxerveCallback("test-tenant", "TESTSHOP", "crypted");

    expect(result.success).toBe(true);
    expect(result.event_type).toBe("payment.failed");
    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
  });

  it("still reports success when enqueueing fails (callback was authenticated)", async () => {
    mockDecryptCallback.mockResolvedValue({
      transaction_result: "OK",
      shop_transaction_id: "PA-14-2026",
      bank_transaction_id: "999",
      authorization_code: "X",
      amount: "5.00",
      currency: "242",
      token: "",
      error_code: "0",
      error_description: "",
    });
    mockQueueAdd.mockRejectedValue(new Error("redis down"));

    const result = await processAxerveCallback("test-tenant", "TESTSHOP", "crypted");

    expect(result.success).toBe(true);
  });
});
