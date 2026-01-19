/**
 * Counter Model Unit Tests
 *
 * Tests for sequential counter generation including customer public codes.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
} from "../conftest";

import {
  CounterModel,
  getNextSequenceValue,
  getCurrentSequenceValue,
  setSequenceValue,
  getNextOrderNumber,
  getNextCartNumber,
  getNextCustomerPublicCode,
} from "@/lib/db/models/counter";

// ============================================
// TEST SETUP
// ============================================

describe("unit: Counter Model", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  // ============================================
  // getNextSequenceValue
  // ============================================

  describe("getNextSequenceValue", () => {
    it("should return 1 for new sequence", async () => {
      /**
       * Test that a new sequence starts at 1.
       */
      // Act
      const value = await getNextSequenceValue("test-sequence");

      // Assert
      expect(value).toBe(1);
    });

    it("should increment sequence on each call", async () => {
      /**
       * Test that sequence increments correctly.
       */
      // Act
      const value1 = await getNextSequenceValue("increment-test");
      const value2 = await getNextSequenceValue("increment-test");
      const value3 = await getNextSequenceValue("increment-test");

      // Assert
      expect(value1).toBe(1);
      expect(value2).toBe(2);
      expect(value3).toBe(3);
    });

    it("should maintain separate sequences", async () => {
      /**
       * Test that different sequences are independent.
       */
      // Act
      const seq1_val1 = await getNextSequenceValue("sequence-a");
      const seq2_val1 = await getNextSequenceValue("sequence-b");
      const seq1_val2 = await getNextSequenceValue("sequence-a");

      // Assert
      expect(seq1_val1).toBe(1);
      expect(seq2_val1).toBe(1);
      expect(seq1_val2).toBe(2);
    });
  });

  // ============================================
  // getCurrentSequenceValue
  // ============================================

  describe("getCurrentSequenceValue", () => {
    it("should return 0 for non-existent sequence", async () => {
      /**
       * Test that non-existent sequence returns 0.
       */
      // Act
      const value = await getCurrentSequenceValue("non-existent");

      // Assert
      expect(value).toBe(0);
    });

    it("should return current value without incrementing", async () => {
      /**
       * Test that getCurrentSequenceValue doesn't increment.
       */
      // Arrange
      await getNextSequenceValue("read-only-test"); // Sets to 1
      await getNextSequenceValue("read-only-test"); // Sets to 2

      // Act
      const value1 = await getCurrentSequenceValue("read-only-test");
      const value2 = await getCurrentSequenceValue("read-only-test");

      // Assert
      expect(value1).toBe(2);
      expect(value2).toBe(2); // Still 2, not incremented
    });
  });

  // ============================================
  // setSequenceValue
  // ============================================

  describe("setSequenceValue", () => {
    it("should set sequence to specific value", async () => {
      /**
       * Test manual sequence value setting.
       */
      // Act
      await setSequenceValue("manual-set", 100);
      const value = await getCurrentSequenceValue("manual-set");

      // Assert
      expect(value).toBe(100);
    });

    it("should continue from set value", async () => {
      /**
       * Test that sequence continues from manually set value.
       */
      // Arrange
      await setSequenceValue("continue-test", 50);

      // Act
      const nextValue = await getNextSequenceValue("continue-test");

      // Assert
      expect(nextValue).toBe(51);
    });
  });

  // ============================================
  // getNextOrderNumber
  // ============================================

  describe("getNextOrderNumber", () => {
    it("should return 1 for first order of year", async () => {
      /**
       * Test first order number generation.
       */
      // Act
      const orderNumber = await getNextOrderNumber(2025);

      // Assert
      expect(orderNumber).toBe(1);
    });

    it("should increment order number within same year", async () => {
      /**
       * Test order number increment.
       */
      // Act
      const order1 = await getNextOrderNumber(2025);
      const order2 = await getNextOrderNumber(2025);
      const order3 = await getNextOrderNumber(2025);

      // Assert
      expect(order1).toBe(1);
      expect(order2).toBe(2);
      expect(order3).toBe(3);
    });

    it("should maintain separate sequences per year", async () => {
      /**
       * Test that different years have separate sequences.
       */
      // Act
      const order2025 = await getNextOrderNumber(2025);
      const order2026 = await getNextOrderNumber(2026);
      const order2025_2 = await getNextOrderNumber(2025);

      // Assert
      expect(order2025).toBe(1);
      expect(order2026).toBe(1);
      expect(order2025_2).toBe(2);
    });
  });

  // ============================================
  // getNextCartNumber
  // ============================================

  describe("getNextCartNumber", () => {
    it("should return 1 for first cart of year", async () => {
      /**
       * Test first cart number generation.
       */
      // Act
      const cartNumber = await getNextCartNumber(2025);

      // Assert
      expect(cartNumber).toBe(1);
    });

    it("should increment cart number independently of orders", async () => {
      /**
       * Test that cart and order sequences are independent.
       */
      // Act
      const cart1 = await getNextCartNumber(2025);
      const order1 = await getNextOrderNumber(2025);
      const cart2 = await getNextCartNumber(2025);

      // Assert
      expect(cart1).toBe(1);
      expect(order1).toBe(1);
      expect(cart2).toBe(2);
    });
  });

  // ============================================
  // getNextCustomerPublicCode - Main Feature
  // ============================================

  describe("getNextCustomerPublicCode", () => {
    it("should return C-00001 for first customer", async () => {
      /**
       * Test that first customer code is C-00001.
       * Format: C-XXXXX (5 digits, zero-padded)
       */
      // Act
      const code = await getNextCustomerPublicCode("test-tenant");

      // Assert
      expect(code).toBe("C-00001");
    });

    it("should increment customer public code", async () => {
      /**
       * Test sequential increment of customer codes.
       */
      // Act
      const code1 = await getNextCustomerPublicCode("test-tenant");
      const code2 = await getNextCustomerPublicCode("test-tenant");
      const code3 = await getNextCustomerPublicCode("test-tenant");

      // Assert
      expect(code1).toBe("C-00001");
      expect(code2).toBe("C-00002");
      expect(code3).toBe("C-00003");
    });

    it("should maintain separate sequences per tenant", async () => {
      /**
       * Test that different tenants have separate sequences.
       */
      // Act
      const tenantA_code1 = await getNextCustomerPublicCode("tenant-a");
      const tenantB_code1 = await getNextCustomerPublicCode("tenant-b");
      const tenantA_code2 = await getNextCustomerPublicCode("tenant-a");

      // Assert
      expect(tenantA_code1).toBe("C-00001");
      expect(tenantB_code1).toBe("C-00001");
      expect(tenantA_code2).toBe("C-00002");
    });

    it("should format with correct zero-padding up to 99999", async () => {
      /**
       * Test zero-padding for various values.
       */
      // Arrange - Set counter to specific values
      await setSequenceValue("customer_public_code_padding-test", 9);
      const code10 = await getNextCustomerPublicCode("padding-test");

      await setSequenceValue("customer_public_code_padding-test", 99);
      const code100 = await getNextCustomerPublicCode("padding-test");

      await setSequenceValue("customer_public_code_padding-test", 999);
      const code1000 = await getNextCustomerPublicCode("padding-test");

      await setSequenceValue("customer_public_code_padding-test", 9999);
      const code10000 = await getNextCustomerPublicCode("padding-test");

      await setSequenceValue("customer_public_code_padding-test", 99998);
      const code99999 = await getNextCustomerPublicCode("padding-test");

      // Assert
      expect(code10).toBe("C-00010");
      expect(code100).toBe("C-00100");
      expect(code1000).toBe("C-01000");
      expect(code10000).toBe("C-10000");
      expect(code99999).toBe("C-99999");
    });

    it("should expand beyond C-99999 naturally", async () => {
      /**
       * Test that codes expand beyond 5 digits.
       * padStart(5, "0") doesn't truncate larger numbers.
       * C-99999 → C-100000 → C-100001
       */
      // Arrange - Set counter just before overflow
      await setSequenceValue("customer_public_code_overflow-test", 99999);

      // Act
      const code100000 = await getNextCustomerPublicCode("overflow-test");
      const code100001 = await getNextCustomerPublicCode("overflow-test");

      // Assert
      expect(code100000).toBe("C-100000"); // 6 digits
      expect(code100001).toBe("C-100001");
    });

    it("should handle million-scale codes", async () => {
      /**
       * Test very large counter values.
       */
      // Arrange
      await setSequenceValue("customer_public_code_million-test", 999999);

      // Act
      const code = await getNextCustomerPublicCode("million-test");

      // Assert
      expect(code).toBe("C-1000000"); // 7 digits
    });
  });

  // ============================================
  // Concurrent Access
  // ============================================

  describe("concurrent access", () => {
    it("should handle concurrent getNextCustomerPublicCode calls", async () => {
      /**
       * Test atomic increment under concurrent access.
       * MongoDB findOneAndUpdate with $inc is atomic.
       */
      // Arrange
      const concurrentCalls = 10;

      // Act - Fire 10 concurrent requests
      const promises = Array.from({ length: concurrentCalls }, () =>
        getNextCustomerPublicCode("concurrent-test")
      );
      const results = await Promise.all(promises);

      // Assert - All codes should be unique
      const uniqueCodes = new Set(results);
      expect(uniqueCodes.size).toBe(concurrentCalls);

      // All codes should be in range C-00001 to C-00010
      const validFormat = results.every((code) => /^C-\d{5}$/.test(code));
      expect(validFormat).toBe(true);
    });
  });
});
