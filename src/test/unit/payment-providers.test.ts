/**
 * Unit Tests for Payment Provider Registry & Implementations
 *
 * Tests the provider registry (register, lookup, list) and verifies
 * that each provider implementation matches its declared capabilities
 * from PROVIDER_CAPABILITIES.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  registerProvider,
  getProvider,
  getAllProviders,
  hasProvider,
} from "@/lib/payments/providers/provider-registry";
import { initializeProviders } from "@/lib/payments/providers/register-providers";
import { PROVIDER_CAPABILITIES, PAYMENT_PROVIDERS } from "@/lib/constants/payment";
import type { IPaymentProvider } from "@/lib/payments/providers/provider-interface";

// Initialize all providers before tests
beforeAll(() => {
  initializeProviders();
});

// ============================================
// PROVIDER REGISTRY
// ============================================

describe("unit: Payment Provider Registry", () => {
  it("should have all 5 implemented providers registered", () => {
    const implemented = ["stripe", "nexi", "axerve", "paypal", "mangopay"];
    for (const name of implemented) {
      expect(hasProvider(name)).toBe(true);
    }
  });

  it("should return undefined for unregistered providers", () => {
    expect(getProvider("unknown-provider")).toBeUndefined();
    expect(hasProvider("unknown-provider")).toBe(false);
  });

  it("should list all registered providers", () => {
    const all = getAllProviders();
    expect(all.length).toBeGreaterThanOrEqual(5);
  });

  it("should return provider by name", () => {
    const stripe = getProvider("stripe");
    expect(stripe).toBeDefined();
    expect(stripe?.name).toBe("stripe");
  });

  it("registerProvider should allow re-registration without error", () => {
    const stripe = getProvider("stripe");
    if (stripe) {
      expect(() => registerProvider(stripe)).not.toThrow();
    }
  });

  it("should return not registered for satispay and scalapay (not yet implemented)", () => {
    // These are in PAYMENT_PROVIDERS but not yet implemented
    expect(hasProvider("satispay")).toBe(false);
    expect(hasProvider("scalapay")).toBe(false);
    expect(hasProvider("manual")).toBe(false);
  });
});

// ============================================
// PROVIDER INTERFACE COMPLIANCE
// ============================================

describe("unit: Payment Provider Interface Compliance", () => {
  const implementedProviders = ["stripe", "nexi", "axerve", "paypal", "mangopay"];

  it("every provider should have a name matching its registry key", () => {
    for (const name of implementedProviders) {
      const provider = getProvider(name);
      expect(provider).toBeDefined();
      expect(provider!.name).toBe(name);
    }
  });

  it("every provider should have boolean capability flags", () => {
    for (const name of implementedProviders) {
      const provider = getProvider(name)!;
      expect(typeof provider.supportsMoto).toBe("boolean");
      expect(typeof provider.supportsOnClick).toBe("boolean");
      expect(typeof provider.supportsRecurring).toBe("boolean");
      expect(typeof provider.supportsAutomaticSplit).toBe("boolean");
    }
  });

  it("every provider should have core methods", () => {
    for (const name of implementedProviders) {
      const provider = getProvider(name)!;
      expect(typeof provider.createPayment).toBe("function");
      expect(typeof provider.capturePayment).toBe("function");
      expect(typeof provider.refundPayment).toBe("function");
      expect(typeof provider.getPaymentStatus).toBe("function");
      expect(typeof provider.verifyWebhookSignature).toBe("function");
      expect(typeof provider.parseWebhookEvent).toBe("function");
    }
  });

  it("providers with MOTO support should have createMotoPayment", () => {
    for (const name of implementedProviders) {
      const provider = getProvider(name)!;
      if (provider.supportsMoto) {
        expect(provider.createMotoPayment).toBeDefined();
        expect(typeof provider.createMotoPayment).toBe("function");
      }
    }
  });

  it("providers with recurring support should have contract methods", () => {
    for (const name of implementedProviders) {
      const provider = getProvider(name)!;
      if (provider.supportsRecurring) {
        expect(provider.createContract).toBeDefined();
        expect(typeof provider.createContract).toBe("function");
        expect(provider.chargeRecurring).toBeDefined();
        expect(typeof provider.chargeRecurring).toBe("function");
        expect(provider.cancelContract).toBeDefined();
        expect(typeof provider.cancelContract).toBe("function");
      }
    }
  });
});

// ============================================
// CAPABILITIES MATCH CONSTANTS
// ============================================

describe("unit: Payment Provider Capabilities Match Constants", () => {
  const implementedProviders = ["stripe", "nexi", "axerve", "paypal", "mangopay"];

  it("each provider's capability flags should match PROVIDER_CAPABILITIES", () => {
    for (const name of implementedProviders) {
      const provider = getProvider(name)!;
      const expected = PROVIDER_CAPABILITIES[name as keyof typeof PROVIDER_CAPABILITIES];

      expect(provider.supportsMoto).toBe(expected.supportsMoto);
      expect(provider.supportsOnClick).toBe(expected.supportsOnClick);
      expect(provider.supportsRecurring).toBe(expected.supportsRecurring);
      expect(provider.supportsAutomaticSplit).toBe(expected.supportsAutomaticSplit);
    }
  });
});

// ============================================
// INDIVIDUAL PROVIDER VERIFICATION
// ============================================

describe("unit: Stripe Provider", () => {
  let provider: IPaymentProvider;

  beforeAll(() => {
    provider = getProvider("stripe")!;
  });

  it("should support all 4 capabilities", () => {
    expect(provider.supportsMoto).toBe(true);
    expect(provider.supportsOnClick).toBe(true);
    expect(provider.supportsRecurring).toBe(true);
    expect(provider.supportsAutomaticSplit).toBe(true);
  });

  it("should have a fee calculator", () => {
    expect(provider.calculateFees).toBeDefined();
  });

  it("should calculate EU card fees (1.4% + €0.25)", () => {
    const fees = provider.calculateFees!(100, "EUR");
    expect(fees.fixed_fee).toBe(0.25);
    expect(fees.percentage_fee).toBe(1.4);
    expect(fees.total_fee).toBe(1.65);
    expect(fees.currency).toBe("EUR");
  });

  it("should parse webhook events", () => {
    const event = provider.parseWebhookEvent(
      JSON.stringify({
        id: "evt_123",
        type: "payment_intent.succeeded",
        created: 1700000000,
        data: { object: { id: "pi_abc" } },
      })
    );

    expect(event.provider).toBe("stripe");
    expect(event.event_type).toBe("payment_intent.succeeded");
    expect(event.event_id).toBe("evt_123");
    expect(event.data).toHaveProperty("id", "pi_abc");
  });
});

describe("unit: Nexi Provider", () => {
  let provider: IPaymentProvider;

  beforeAll(() => {
    provider = getProvider("nexi")!;
  });

  it("should support MOTO but not automatic split", () => {
    expect(provider.supportsMoto).toBe(true);
    expect(provider.supportsOnClick).toBe(true);
    expect(provider.supportsRecurring).toBe(true);
    expect(provider.supportsAutomaticSplit).toBe(false);
  });

  it("should parse webhook events", () => {
    const event = provider.parseWebhookEvent(
      JSON.stringify({
        operationId: "nexi-op-123",
        operationType: "CAPTURE",
        operationTime: "2025-01-15T10:00:00.000Z",
        operationResult: "AUTHORIZED",
      })
    );

    expect(event.provider).toBe("nexi");
    expect(event.event_id).toBe("nexi-op-123");
  });
});

describe("unit: Axerve Provider", () => {
  let provider: IPaymentProvider;

  beforeAll(() => {
    provider = getProvider("axerve")!;
  });

  it("should support MOTO but not automatic split", () => {
    expect(provider.supportsMoto).toBe(true);
    expect(provider.supportsOnClick).toBe(true);
    expect(provider.supportsRecurring).toBe(true);
    expect(provider.supportsAutomaticSplit).toBe(false);
  });

  it("should parse webhook events from XML/JSON payload", () => {
    const event = provider.parseWebhookEvent(
      JSON.stringify({
        ShopLogin: "SHOP123",
        BankTransactionID: "bt-456",
        TransactionResult: "OK",
      })
    );

    expect(event.provider).toBe("axerve");
    expect(event.event_id).toBe("bt-456");
    expect(event.event_type).toBe("payment.completed");
  });
});

describe("unit: PayPal Provider", () => {
  let provider: IPaymentProvider;

  beforeAll(() => {
    provider = getProvider("paypal")!;
  });

  it("should NOT support MOTO", () => {
    expect(provider.supportsMoto).toBe(false);
    expect(provider.supportsOnClick).toBe(true);
    expect(provider.supportsRecurring).toBe(true);
    expect(provider.supportsAutomaticSplit).toBe(false);
  });

  it("should have a fee calculator", () => {
    expect(provider.calculateFees).toBeDefined();
  });

  it("should calculate EU fees (2.49% + €0.35)", () => {
    const fees = provider.calculateFees!(100, "EUR");
    expect(fees.fixed_fee).toBe(0.35);
    expect(fees.percentage_fee).toBe(2.49);
    expect(fees.total_fee).toBe(2.84);
    expect(fees.currency).toBe("EUR");
  });

  it("should parse webhook events", () => {
    const event = provider.parseWebhookEvent(
      JSON.stringify({
        id: "WH-abc-123",
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        create_time: "2025-01-15T10:00:00Z",
        resource: { id: "cap-xyz" },
      })
    );

    expect(event.provider).toBe("paypal");
    expect(event.event_type).toBe("PAYMENT.CAPTURE.COMPLETED");
    expect(event.event_id).toBe("WH-abc-123");
    expect(event.data).toHaveProperty("id", "cap-xyz");
  });
});

describe("unit: Mangopay Provider", () => {
  let provider: IPaymentProvider;

  beforeAll(() => {
    provider = getProvider("mangopay")!;
  });

  it("should NOT support MOTO but support automatic split", () => {
    expect(provider.supportsMoto).toBe(false);
    expect(provider.supportsOnClick).toBe(true);
    expect(provider.supportsRecurring).toBe(true);
    expect(provider.supportsAutomaticSplit).toBe(true);
  });

  it("should have a fee calculator", () => {
    expect(provider.calculateFees).toBeDefined();
  });

  it("should calculate EU fees (1.8% + €0.18)", () => {
    const fees = provider.calculateFees!(100, "EUR");
    expect(fees.fixed_fee).toBe(0.18);
    expect(fees.percentage_fee).toBe(1.8);
    expect(fees.total_fee).toBe(1.98);
    expect(fees.currency).toBe("EUR");
  });

  it("should parse webhook events", () => {
    const event = provider.parseWebhookEvent(
      JSON.stringify({
        EventType: "PAYIN_NORMAL_SUCCEEDED",
        ResourceId: "res-789",
        Date: 1700000000,
      })
    );

    expect(event.provider).toBe("mangopay");
    expect(event.event_type).toBe("PAYIN_NORMAL_SUCCEEDED");
    expect(event.event_id).toBe("res-789");
  });
});

// ============================================
// FEE CALCULATION EDGE CASES
// ============================================

describe("unit: Provider Fee Calculations", () => {
  it("fees should always be positive for positive amounts", () => {
    const providers = getAllProviders().filter((p) => p.calculateFees);

    for (const provider of providers) {
      const fees = provider.calculateFees!(50, "EUR");
      expect(fees.total_fee).toBeGreaterThan(0);
      expect(fees.fixed_fee).toBeGreaterThanOrEqual(0);
      expect(fees.percentage_fee).toBeGreaterThanOrEqual(0);
    }
  });

  it("total_fee should equal fixed_fee + percentage_fee", () => {
    const providers = getAllProviders().filter((p) => p.calculateFees);

    for (const provider of providers) {
      const fees = provider.calculateFees!(200, "EUR");
      const sum = Math.round((fees.fixed_fee + fees.percentage_fee) * 100) / 100;
      expect(fees.total_fee).toBe(sum);
    }
  });

  it("fees should scale with amount", () => {
    const providers = getAllProviders().filter((p) => p.calculateFees);

    for (const provider of providers) {
      const feesSmall = provider.calculateFees!(10, "EUR");
      const feesLarge = provider.calculateFees!(1000, "EUR");
      expect(feesLarge.total_fee).toBeGreaterThan(feesSmall.total_fee);
    }
  });

  it("Stripe should be cheaper than PayPal for EU cards", () => {
    const stripe = getProvider("stripe")!;
    const paypal = getProvider("paypal")!;

    const stripeFees = stripe.calculateFees!(100, "EUR");
    const paypalFees = paypal.calculateFees!(100, "EUR");

    expect(stripeFees.total_fee).toBeLessThan(paypalFees.total_fee);
  });
});

// ============================================
// IDEMPOTENT INITIALIZATION
// ============================================

describe("unit: Provider Initialization", () => {
  it("should be safe to call initializeProviders() multiple times", () => {
    const countBefore = getAllProviders().length;
    initializeProviders();
    initializeProviders();
    initializeProviders();
    const countAfter = getAllProviders().length;

    expect(countAfter).toBe(countBefore);
  });
});
