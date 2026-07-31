/**
 * Unit Tests for axerve callback completion and worker event routing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WebhookEvent } from "@/lib/types/payment";

const mockRecordGatewayPayment = vi.fn();

vi.mock("@/lib/services/order-lifecycle.service", () => ({
  recordGatewayPayment: (...args: unknown[]) => mockRecordGatewayPayment(...args),
  reverseGatewayPayment: vi.fn(),
}));

const mockFindOne = vi.fn();

vi.mock("@/lib/db/model-registry", () => ({
  getModelRegistry: () => ({
    PaymentTransaction: { findOne: (...args: unknown[]) => mockFindOne(...args) },
  }),
}));

import {
  completeTransactionFromCallback,
  failTransactionFromCallback,
} from "@/lib/payments/payment.service";
import { extractProviderPaymentId } from "@/lib/payments/callback-events";

function fakeTransaction(overrides: Record<string, unknown> = {}) {
  return {
    transaction_id: "txn_abc",
    tenant_id: "test-tenant",
    order_id: "ORD-1",
    provider: "axerve",
    provider_payment_id: "PA-12-2026",
    provider_capture_id: "",
    payment_type: "onclick",
    payment_number: "PA/12/2026",
    gross_amount: 149.9,
    status: "processing",
    events: [] as unknown[],
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const connection = { name: "vinc-test-tenant" } as never;

beforeEach(() => {
  vi.clearAllMocks();
  mockRecordGatewayPayment.mockResolvedValue(undefined);
});

describe("unit: completeTransactionFromCallback", () => {
  it("completes a processing transaction and stores the bank transaction id", async () => {
    const txn = fakeTransaction();
    mockFindOne.mockResolvedValue(txn);

    const result = await completeTransactionFromCallback(connection, "PA-12-2026", "axerve", {
      provider_capture_id: "1234567",
      authorization_code: "A1B2C3",
    });

    expect(result.success).toBe(true);
    expect(txn.status).toBe("completed");
    expect(txn.provider_capture_id).toBe("1234567");
    expect(txn.completed_at).toBeInstanceOf(Date);
    expect(txn.save).toHaveBeenCalled();
  });

  it("records the payment on the order", async () => {
    mockFindOne.mockResolvedValue(fakeTransaction());

    await completeTransactionFromCallback(connection, "PA-12-2026", "axerve", {
      provider_capture_id: "1234567",
    });

    expect(mockRecordGatewayPayment).toHaveBeenCalledTimes(1);
    const [, orderId, payload] = mockRecordGatewayPayment.mock.calls[0];
    expect(orderId).toBe("ORD-1");
    expect(payload.amount).toBe(149.9);
    expect(payload.provider).toBe("axerve");
    expect(payload.provider_capture_id).toBe("1234567");
  });

  it("is idempotent — a replayed callback does not re-record the order payment", async () => {
    const txn = fakeTransaction({ status: "completed" });
    mockFindOne.mockResolvedValue(txn);

    const result = await completeTransactionFromCallback(connection, "PA-12-2026", "axerve", {
      provider_capture_id: "1234567",
    });

    expect(result.success).toBe(true);
    expect(result.already_completed).toBe(true);
    expect(mockRecordGatewayPayment).not.toHaveBeenCalled();
  });

  it("returns an error when no transaction matches", async () => {
    mockFindOne.mockResolvedValue(null);

    const result = await completeTransactionFromCallback(connection, "PA-99-2026", "axerve", {});

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it("still completes the transaction when recording on the order throws", async () => {
    const txn = fakeTransaction();
    mockFindOne.mockResolvedValue(txn);
    mockRecordGatewayPayment.mockRejectedValue(new Error("order locked"));

    const result = await completeTransactionFromCallback(connection, "PA-12-2026", "axerve", {
      provider_capture_id: "1234567",
    });

    expect(result.success).toBe(true);
    expect(txn.status).toBe("completed");
  });
});

describe("unit: failTransactionFromCallback", () => {
  it("marks a processing transaction failed with the GestPay error", async () => {
    const txn = fakeTransaction();
    mockFindOne.mockResolvedValue(txn);

    const result = await failTransactionFromCallback(connection, "PA-12-2026", "axerve", {
      reason: "Transaction refused",
      code: "1119",
    });

    expect(result.success).toBe(true);
    expect(txn.status).toBe("failed");
    expect(txn.failure_reason).toBe("Transaction refused");
    expect(txn.failure_code).toBe("1119");
  });

  it("never downgrades an already completed payment", async () => {
    const txn = fakeTransaction({ status: "completed" });
    mockFindOne.mockResolvedValue(txn);

    await failTransactionFromCallback(connection, "PA-12-2026", "axerve", {
      reason: "late KO",
    });

    expect(txn.status).toBe("completed");
  });
});

describe("unit: extractProviderPaymentId", () => {
  function event(data: Record<string, unknown>): WebhookEvent {
    return {
      provider: "axerve",
      event_type: "payment.completed",
      event_id: "1234567",
      timestamp: new Date(),
      data,
      raw_payload: "",
    };
  }

  it("uses shop_transaction_id for axerve", () => {
    const id = extractProviderPaymentId(
      "axerve",
      event({ shop_transaction_id: "PA-12-2026", bank_transaction_id: "1234567" })
    );

    expect(id).toBe("PA-12-2026");
  });

  it("returns null for axerve when the shop transaction id is missing", () => {
    expect(extractProviderPaymentId("axerve", event({ bank_transaction_id: "1234567" }))).toBeNull();
  });

  it("still uses id for paypal", () => {
    const ev = { ...event({ id: "PAYPAL-1" }), provider: "paypal" };
    expect(extractProviderPaymentId("paypal", ev)).toBe("PAYPAL-1");
  });

  it("still uses payment_intent for stripe", () => {
    const ev = { ...event({ payment_intent: "pi_123" }), provider: "stripe" };
    expect(extractProviderPaymentId("stripe", ev)).toBe("pi_123");
  });
});
