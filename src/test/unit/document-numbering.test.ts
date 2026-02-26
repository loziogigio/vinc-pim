/**
 * Unit Tests for Document Numbering
 *
 * Tests the number formatting logic used for progressive document numbering.
 */

import { describe, it, expect } from "vitest";
import { formatDocumentNumber } from "@/lib/services/document-numbering.service";

// ============================================
// FORMAT DOCUMENT NUMBER
// ============================================

describe("unit: Document Numbering - formatDocumentNumber", () => {
  it("should format basic invoice number", () => {
    const result = formatDocumentNumber("INV-{YEAR}-{NUMBER}", 2026, 42, 5);
    expect(result).toBe("INV-2026-00042");
  });

  it("should format quotation number", () => {
    const result = formatDocumentNumber("Q-{YEAR}-{NUMBER}", 2026, 1, 5);
    expect(result).toBe("Q-2026-00001");
  });

  it("should format proforma number", () => {
    const result = formatDocumentNumber("PF-{YEAR}-{NUMBER}", 2026, 100, 5);
    expect(result).toBe("PF-2026-00100");
  });

  it("should format credit note number", () => {
    const result = formatDocumentNumber("NC-{YEAR}-{NUMBER}", 2026, 7, 5);
    expect(result).toBe("NC-2026-00007");
  });

  it("should handle padding of 3", () => {
    const result = formatDocumentNumber("INV-{YEAR}-{NUMBER}", 2026, 5, 3);
    expect(result).toBe("INV-2026-005");
  });

  it("should handle padding of 1 (no zero padding)", () => {
    const result = formatDocumentNumber("INV-{NUMBER}", 2026, 123, 1);
    expect(result).toBe("INV-123");
  });

  it("should handle large numbers that exceed padding", () => {
    const result = formatDocumentNumber("INV-{YEAR}-{NUMBER}", 2026, 123456, 5);
    expect(result).toBe("INV-2026-123456");
  });

  it("should handle custom format without year", () => {
    const result = formatDocumentNumber("FAT/{NUMBER}", 2026, 42, 4);
    expect(result).toBe("FAT/0042");
  });

  it("should handle format with year only", () => {
    const result = formatDocumentNumber("{YEAR}-{NUMBER}", 2025, 1, 6);
    expect(result).toBe("2025-000001");
  });

  it("should handle number 0", () => {
    const result = formatDocumentNumber("INV-{YEAR}-{NUMBER}", 2026, 0, 5);
    expect(result).toBe("INV-2026-00000");
  });

  it("should replace multiple occurrences of YEAR", () => {
    const result = formatDocumentNumber("{YEAR}/INV-{YEAR}-{NUMBER}", 2026, 10, 4);
    expect(result).toBe("2026/INV-2026-0010");
  });
});
