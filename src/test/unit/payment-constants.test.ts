/**
 * Unit Tests for Payment Constants
 *
 * Tests payment providers, types, statuses, methods, commissions,
 * subscriptions, contract types, provider capabilities, and default values.
 */

import { describe, it, expect } from "vitest";
import {
  PAYMENT_PROVIDERS,
  PAYMENT_PROVIDER_LABELS,
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABELS,
  PAYMENT_TYPE_DESCRIPTIONS,
  TRANSACTION_STATUSES,
  TRANSACTION_STATUS_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  COMMISSION_STATUSES,
  COMMISSION_STATUS_LABELS,
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_STATUS_LABELS,
  CONTRACT_TYPES,
  CONTRACT_TYPE_LABELS,
  PROVIDER_CAPABILITIES,
  PAYMENT_DEFAULTS,
} from "@/lib/constants/payment";
import type {
  PaymentProvider,
  PaymentType,
  TransactionStatus,
  PaymentMethod,
  CommissionStatus,
  SubscriptionStatus,
  ContractType,
} from "@/lib/constants/payment";

// ============================================
// PAYMENT PROVIDERS
// ============================================

describe("unit: Payment Constants - Providers", () => {
  it("should have exactly 8 providers", () => {
    expect(PAYMENT_PROVIDERS).toHaveLength(8);
  });

  it("should include all expected providers", () => {
    const expected = [
      "stripe",
      "mangopay",
      "paypal",
      "nexi",
      "axerve",
      "satispay",
      "scalapay",
      "manual",
    ];
    expected.forEach((p) => {
      expect(PAYMENT_PROVIDERS).toContain(p);
    });
  });

  it("should have a label for every provider", () => {
    for (const provider of PAYMENT_PROVIDERS) {
      expect(PAYMENT_PROVIDER_LABELS[provider]).toBeDefined();
      expect(PAYMENT_PROVIDER_LABELS[provider]).not.toBe("");
    }
  });

  it("should have correct Italian/display labels", () => {
    expect(PAYMENT_PROVIDER_LABELS.stripe).toBe("Stripe");
    expect(PAYMENT_PROVIDER_LABELS.nexi).toBe("Nexi XPay");
    expect(PAYMENT_PROVIDER_LABELS.axerve).toBe("Axerve (Fabrick)");
    expect(PAYMENT_PROVIDER_LABELS.manual).toBe("Manuale");
  });

  it("should not have extra labels beyond defined providers", () => {
    const labelKeys = Object.keys(PAYMENT_PROVIDER_LABELS);
    expect(labelKeys.length).toBe(PAYMENT_PROVIDERS.length);
  });
});

// ============================================
// PAYMENT TYPES
// ============================================

describe("unit: Payment Constants - Payment Types", () => {
  it("should have exactly 3 payment types", () => {
    expect(PAYMENT_TYPES).toHaveLength(3);
  });

  it("should include onclick, moto, and recurrent", () => {
    expect(PAYMENT_TYPES).toContain("onclick");
    expect(PAYMENT_TYPES).toContain("moto");
    expect(PAYMENT_TYPES).toContain("recurrent");
  });

  it("should have a label for every type", () => {
    for (const type of PAYMENT_TYPES) {
      expect(PAYMENT_TYPE_LABELS[type]).toBeDefined();
      expect(PAYMENT_TYPE_LABELS[type]).not.toBe("");
    }
  });

  it("should have a description for every type", () => {
    for (const type of PAYMENT_TYPES) {
      expect(PAYMENT_TYPE_DESCRIPTIONS[type]).toBeDefined();
      expect(PAYMENT_TYPE_DESCRIPTIONS[type].length).toBeGreaterThan(10);
    }
  });

  it("should mention 3DS in onclick and moto descriptions", () => {
    expect(PAYMENT_TYPE_DESCRIPTIONS.onclick).toContain("3DS");
    expect(PAYMENT_TYPE_DESCRIPTIONS.moto).toContain("3DS");
  });

  it("should have correct Italian labels", () => {
    expect(PAYMENT_TYPE_LABELS.moto).toContain("MOTO");
    expect(PAYMENT_TYPE_LABELS.recurrent).toBe("Ricorrente");
  });
});

// ============================================
// TRANSACTION STATUSES
// ============================================

describe("unit: Payment Constants - Transaction Statuses", () => {
  it("should have exactly 9 statuses", () => {
    expect(TRANSACTION_STATUSES).toHaveLength(9);
  });

  it("should include all lifecycle statuses", () => {
    const expected = [
      "pending",
      "processing",
      "authorized",
      "captured",
      "completed",
      "failed",
      "cancelled",
      "refunded",
      "partial_refund",
    ];
    expected.forEach((s) => {
      expect(TRANSACTION_STATUSES).toContain(s);
    });
  });

  it("should have a label for every status", () => {
    for (const status of TRANSACTION_STATUSES) {
      expect(TRANSACTION_STATUS_LABELS[status]).toBeDefined();
      expect(TRANSACTION_STATUS_LABELS[status]).not.toBe("");
    }
  });

  it("should have correct Italian labels", () => {
    expect(TRANSACTION_STATUS_LABELS.pending).toBe("In Attesa");
    expect(TRANSACTION_STATUS_LABELS.completed).toBe("Completato");
    expect(TRANSACTION_STATUS_LABELS.refunded).toBe("Rimborsato");
    expect(TRANSACTION_STATUS_LABELS.partial_refund).toBe("Rimborso Parziale");
  });

  it("should not have extra labels beyond defined statuses", () => {
    const labelKeys = Object.keys(TRANSACTION_STATUS_LABELS);
    expect(labelKeys.length).toBe(TRANSACTION_STATUSES.length);
  });
});

// ============================================
// PAYMENT METHODS
// ============================================

describe("unit: Payment Constants - Payment Methods", () => {
  it("should have exactly 10 methods", () => {
    expect(PAYMENT_METHODS).toHaveLength(10);
  });

  it("should include key payment methods", () => {
    expect(PAYMENT_METHODS).toContain("credit_card");
    expect(PAYMENT_METHODS).toContain("debit_card");
    expect(PAYMENT_METHODS).toContain("bank_transfer");
    expect(PAYMENT_METHODS).toContain("paypal");
    expect(PAYMENT_METHODS).toContain("apple_pay");
    expect(PAYMENT_METHODS).toContain("google_pay");
    expect(PAYMENT_METHODS).toContain("sepa_direct_debit");
  });

  it("should have a label for every method", () => {
    for (const method of PAYMENT_METHODS) {
      expect(PAYMENT_METHOD_LABELS[method]).toBeDefined();
      expect(PAYMENT_METHOD_LABELS[method]).not.toBe("");
    }
  });

  it("should have Italian labels for card and transfer methods", () => {
    expect(PAYMENT_METHOD_LABELS.credit_card).toBe("Carta di Credito");
    expect(PAYMENT_METHOD_LABELS.bank_transfer).toBe("Bonifico Bancario");
    expect(PAYMENT_METHOD_LABELS.sepa_direct_debit).toBe("Addebito Diretto SEPA");
  });
});

// ============================================
// COMMISSION STATUSES
// ============================================

describe("unit: Payment Constants - Commission Statuses", () => {
  it("should have exactly 3 statuses", () => {
    expect(COMMISSION_STATUSES).toHaveLength(3);
  });

  it("should include pending, collected, and paid_out", () => {
    expect(COMMISSION_STATUSES).toContain("pending");
    expect(COMMISSION_STATUSES).toContain("collected");
    expect(COMMISSION_STATUSES).toContain("paid_out");
  });

  it("should have a label for every status", () => {
    for (const status of COMMISSION_STATUSES) {
      expect(COMMISSION_STATUS_LABELS[status]).toBeDefined();
    }
  });

  it("should have correct Italian labels", () => {
    expect(COMMISSION_STATUS_LABELS.pending).toBe("In Attesa");
    expect(COMMISSION_STATUS_LABELS.collected).toBe("Incassato");
    expect(COMMISSION_STATUS_LABELS.paid_out).toBe("Pagato");
  });
});

// ============================================
// SUBSCRIPTION STATUSES
// ============================================

describe("unit: Payment Constants - Subscription Statuses", () => {
  it("should have exactly 7 statuses", () => {
    expect(SUBSCRIPTION_STATUSES).toHaveLength(7);
  });

  it("should include all subscription lifecycle states", () => {
    const expected = [
      "trialing",
      "active",
      "past_due",
      "paused",
      "cancelled",
      "unpaid",
      "expired",
    ];
    expected.forEach((s) => {
      expect(SUBSCRIPTION_STATUSES).toContain(s);
    });
  });

  it("should have a label for every status", () => {
    for (const status of SUBSCRIPTION_STATUSES) {
      expect(SUBSCRIPTION_STATUS_LABELS[status]).toBeDefined();
      expect(SUBSCRIPTION_STATUS_LABELS[status]).not.toBe("");
    }
  });

  it("should have correct Italian labels", () => {
    expect(SUBSCRIPTION_STATUS_LABELS.trialing).toBe("Periodo di Prova");
    expect(SUBSCRIPTION_STATUS_LABELS.active).toBe("Attivo");
    expect(SUBSCRIPTION_STATUS_LABELS.cancelled).toBe("Cancellato");
  });
});

// ============================================
// CONTRACT TYPES
// ============================================

describe("unit: Payment Constants - Contract Types", () => {
  it("should have exactly 2 contract types", () => {
    expect(CONTRACT_TYPES).toHaveLength(2);
  });

  it("should include scheduled and unscheduled", () => {
    expect(CONTRACT_TYPES).toContain("scheduled");
    expect(CONTRACT_TYPES).toContain("unscheduled");
  });

  it("should have a label for every type", () => {
    for (const type of CONTRACT_TYPES) {
      expect(CONTRACT_TYPE_LABELS[type]).toBeDefined();
      expect(CONTRACT_TYPE_LABELS[type]).not.toBe("");
    }
  });
});

// ============================================
// PROVIDER CAPABILITIES
// ============================================

describe("unit: Payment Constants - Provider Capabilities", () => {
  it("should have capabilities for every provider", () => {
    for (const provider of PAYMENT_PROVIDERS) {
      expect(PROVIDER_CAPABILITIES[provider]).toBeDefined();
      const caps = PROVIDER_CAPABILITIES[provider];
      expect(typeof caps.supportsMoto).toBe("boolean");
      expect(typeof caps.supportsOnClick).toBe("boolean");
      expect(typeof caps.supportsRecurring).toBe("boolean");
      expect(typeof caps.supportsAutomaticSplit).toBe("boolean");
    }
  });

  it("Stripe should support all capabilities", () => {
    expect(PROVIDER_CAPABILITIES.stripe.supportsMoto).toBe(true);
    expect(PROVIDER_CAPABILITIES.stripe.supportsOnClick).toBe(true);
    expect(PROVIDER_CAPABILITIES.stripe.supportsRecurring).toBe(true);
    expect(PROVIDER_CAPABILITIES.stripe.supportsAutomaticSplit).toBe(true);
  });

  it("Nexi and Axerve should support MOTO but not automatic split", () => {
    for (const provider of ["nexi", "axerve"] as PaymentProvider[]) {
      expect(PROVIDER_CAPABILITIES[provider].supportsMoto).toBe(true);
      expect(PROVIDER_CAPABILITIES[provider].supportsOnClick).toBe(true);
      expect(PROVIDER_CAPABILITIES[provider].supportsRecurring).toBe(true);
      expect(PROVIDER_CAPABILITIES[provider].supportsAutomaticSplit).toBe(false);
    }
  });

  it("PayPal and Mangopay should not support MOTO", () => {
    expect(PROVIDER_CAPABILITIES.paypal.supportsMoto).toBe(false);
    expect(PROVIDER_CAPABILITIES.mangopay.supportsMoto).toBe(false);
  });

  it("Satispay and Scalapay should only support OnClick", () => {
    for (const provider of ["satispay", "scalapay"] as PaymentProvider[]) {
      expect(PROVIDER_CAPABILITIES[provider].supportsOnClick).toBe(true);
      expect(PROVIDER_CAPABILITIES[provider].supportsMoto).toBe(false);
      expect(PROVIDER_CAPABILITIES[provider].supportsRecurring).toBe(false);
      expect(PROVIDER_CAPABILITIES[provider].supportsAutomaticSplit).toBe(false);
    }
  });

  it("manual should support no capabilities", () => {
    const manual = PROVIDER_CAPABILITIES.manual;
    expect(manual.supportsMoto).toBe(false);
    expect(manual.supportsOnClick).toBe(false);
    expect(manual.supportsRecurring).toBe(false);
    expect(manual.supportsAutomaticSplit).toBe(false);
  });

  it("should have at least 3 providers with MOTO support", () => {
    const motoProviders = PAYMENT_PROVIDERS.filter(
      (p) => PROVIDER_CAPABILITIES[p].supportsMoto
    );
    expect(motoProviders.length).toBeGreaterThanOrEqual(3);
    expect(motoProviders).toContain("stripe");
    expect(motoProviders).toContain("nexi");
    expect(motoProviders).toContain("axerve");
  });

  it("should have at least 2 providers with automatic split", () => {
    const splitProviders = PAYMENT_PROVIDERS.filter(
      (p) => PROVIDER_CAPABILITIES[p].supportsAutomaticSplit
    );
    expect(splitProviders.length).toBeGreaterThanOrEqual(2);
    expect(splitProviders).toContain("stripe");
    expect(splitProviders).toContain("mangopay");
  });
});

// ============================================
// PAYMENT DEFAULTS
// ============================================

describe("unit: Payment Constants - Default Values", () => {
  it("should have a commission rate of 2.5%", () => {
    expect(PAYMENT_DEFAULTS.COMMISSION_RATE).toBe(0.025);
  });

  it("should have idempotency TTL of 24 hours (86400 seconds)", () => {
    expect(PAYMENT_DEFAULTS.IDEMPOTENCY_TTL).toBe(86400);
  });

  it("should default to EUR currency", () => {
    expect(PAYMENT_DEFAULTS.CURRENCY).toBe("EUR");
  });

  it("should have webhook max retries of 5", () => {
    expect(PAYMENT_DEFAULTS.WEBHOOK_MAX_RETRIES).toBe(5);
  });

  it("should have trial period of 14 days", () => {
    expect(PAYMENT_DEFAULTS.TRIAL_DAYS).toBe(14);
  });
});

// ============================================
// TYPE SAFETY
// ============================================

describe("unit: Payment Constants - Type Safety", () => {
  it("should allow valid PaymentProvider types", () => {
    const valid: PaymentProvider = "stripe";
    expect(PAYMENT_PROVIDERS).toContain(valid);
  });

  it("should allow valid PaymentType types", () => {
    const valid: PaymentType = "moto";
    expect(PAYMENT_TYPES).toContain(valid);
  });

  it("should allow valid TransactionStatus types", () => {
    const valid: TransactionStatus = "completed";
    expect(TRANSACTION_STATUSES).toContain(valid);
  });

  it("should allow valid PaymentMethod types", () => {
    const valid: PaymentMethod = "credit_card";
    expect(PAYMENT_METHODS).toContain(valid);
  });

  it("should allow valid CommissionStatus types", () => {
    const valid: CommissionStatus = "collected";
    expect(COMMISSION_STATUSES).toContain(valid);
  });

  it("should allow valid SubscriptionStatus types", () => {
    const valid: SubscriptionStatus = "active";
    expect(SUBSCRIPTION_STATUSES).toContain(valid);
  });

  it("should allow valid ContractType types", () => {
    const valid: ContractType = "scheduled";
    expect(CONTRACT_TYPES).toContain(valid);
  });
});
