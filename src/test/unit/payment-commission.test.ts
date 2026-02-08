/**
 * Unit Tests for Commission Service
 *
 * Tests calculateCommission() — a pure function that computes
 * commission breakdowns from gross amount, rate, and currency.
 * No database, no external dependencies.
 */

import { describe, it, expect } from "vitest";
import { calculateCommission } from "@/lib/payments/commission.service";
import { PAYMENT_DEFAULTS } from "@/lib/constants/payment";

// ============================================
// calculateCommission
// ============================================

describe("unit: calculateCommission", () => {
  it("should calculate commission at default rate (2.5%)", () => {
    /**
     * 100 EUR at 2.5% commission
     * commission = 100 * 0.025 = 2.50
     * net = 100 - 2.50 = 97.50
     */
    const result = calculateCommission(100, PAYMENT_DEFAULTS.COMMISSION_RATE);

    expect(result.gross_amount).toBe(100);
    expect(result.commission_rate).toBe(0.025);
    expect(result.commission_amount).toBe(2.5);
    expect(result.net_amount).toBe(97.5);
    expect(result.currency).toBe("EUR");
  });

  it("should calculate commission with custom rate", () => {
    /**
     * 250 EUR at 3% commission
     * commission = 250 * 0.03 = 7.50
     * net = 250 - 7.50 = 242.50
     */
    const result = calculateCommission(250, 0.03, "EUR");

    expect(result.gross_amount).toBe(250);
    expect(result.commission_rate).toBe(0.03);
    expect(result.commission_amount).toBe(7.5);
    expect(result.net_amount).toBe(242.5);
  });

  it("should round commission to 2 decimal places", () => {
    /**
     * 99.99 EUR at 2.5%
     * commission = 99.99 * 0.025 = 2.49975 → rounds to 2.50
     * net = 99.99 - 2.50 = 97.49
     */
    const result = calculateCommission(99.99, 0.025);

    expect(result.commission_amount).toBe(2.5);
    expect(result.net_amount).toBe(97.49);
  });

  it("should round net_amount to 2 decimal places", () => {
    /**
     * 33.33 EUR at 1.5%
     * commission = 33.33 * 0.015 = 0.49995 → rounds to 0.50
     * net = 33.33 - 0.50 = 32.83
     */
    const result = calculateCommission(33.33, 0.015);

    expect(result.commission_amount).toBe(0.5);
    expect(result.net_amount).toBe(32.83);
  });

  it("should handle zero amount", () => {
    const result = calculateCommission(0, 0.025);

    expect(result.gross_amount).toBe(0);
    expect(result.commission_amount).toBe(0);
    expect(result.net_amount).toBe(0);
  });

  it("should handle zero commission rate", () => {
    const result = calculateCommission(100, 0);

    expect(result.commission_amount).toBe(0);
    expect(result.net_amount).toBe(100);
  });

  it("should handle 100% commission rate", () => {
    const result = calculateCommission(100, 1.0);

    expect(result.commission_amount).toBe(100);
    expect(result.net_amount).toBe(0);
  });

  it("should use default EUR currency when not specified", () => {
    const result = calculateCommission(100, 0.025);
    expect(result.currency).toBe("EUR");
  });

  it("should use custom currency when specified", () => {
    const result = calculateCommission(100, 0.025, "USD");
    expect(result.currency).toBe("USD");
  });

  it("should handle large amounts correctly", () => {
    /**
     * 10,000 EUR at 2.5%
     * commission = 10000 * 0.025 = 250.00
     * net = 10000 - 250 = 9750.00
     */
    const result = calculateCommission(10000, 0.025);

    expect(result.commission_amount).toBe(250);
    expect(result.net_amount).toBe(9750);
  });

  it("should handle small amounts correctly", () => {
    /**
     * 0.50 EUR at 2.5%
     * commission = 0.50 * 0.025 = 0.0125 → rounds to 0.01
     * net = 0.50 - 0.01 = 0.49
     */
    const result = calculateCommission(0.5, 0.025);

    expect(result.commission_amount).toBe(0.01);
    expect(result.net_amount).toBe(0.49);
  });

  it("should ensure gross = commission + net", () => {
    /**
     * Verify the fundamental invariant:
     * gross_amount = commission_amount + net_amount
     * (within rounding tolerance)
     */
    const testCases = [
      { amount: 100, rate: 0.025 },
      { amount: 99.99, rate: 0.03 },
      { amount: 1234.56, rate: 0.015 },
      { amount: 0.01, rate: 0.1 },
      { amount: 50000, rate: 0.025 },
    ];

    for (const { amount, rate } of testCases) {
      const result = calculateCommission(amount, rate);
      const reconstructed = result.commission_amount + result.net_amount;
      // Allow ±0.01 rounding tolerance
      expect(Math.abs(result.gross_amount - reconstructed)).toBeLessThanOrEqual(0.01);
    }
  });

  it("should return all required fields", () => {
    const result = calculateCommission(100, 0.025, "EUR");

    expect(result).toHaveProperty("gross_amount");
    expect(result).toHaveProperty("commission_rate");
    expect(result).toHaveProperty("commission_amount");
    expect(result).toHaveProperty("net_amount");
    expect(result).toHaveProperty("currency");
  });

  it("should preserve the original rate in the result", () => {
    const customRate = 0.0175;
    const result = calculateCommission(100, customRate);
    expect(result.commission_rate).toBe(customRate);
  });
});
