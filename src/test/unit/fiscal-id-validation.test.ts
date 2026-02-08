/**
 * Unit Tests for Fiscal ID Validation
 *
 * Tests Italian P.IVA/CF, Slovak IČ DPH/DIČ/IČO, and generic dispatcher.
 */

import { describe, it, expect } from "vitest";
import {
  validateItalianVAT,
  validateItalianFiscalCode,
  validateSlovakVAT,
  validateSlovakTaxId,
  validateSlovakCompanyId,
  validateFiscalId,
} from "@/lib/validation/fiscal-id";

// ============================================
// ITALIAN VAT (P.IVA)
// ============================================

describe("unit: Fiscal ID - Italian VAT (P.IVA)", () => {
  it("should accept valid IT VAT numbers", () => {
    expect(validateItalianVAT("IT01234567890")).toBe(true);
    expect(validateItalianVAT("IT12345678901")).toBe(true);
  });

  it("should reject missing IT prefix", () => {
    expect(validateItalianVAT("01234567890")).toBe(false);
  });

  it("should reject wrong digit count", () => {
    expect(validateItalianVAT("IT0123456789")).toBe(false);
    expect(validateItalianVAT("IT012345678901")).toBe(false);
  });

  it("should reject non-numeric after prefix", () => {
    expect(validateItalianVAT("ITABCDEFGHIJK")).toBe(false);
  });

  it("should handle whitespace", () => {
    expect(validateItalianVAT(" IT01234567890 ")).toBe(true);
  });

  it("should be case insensitive", () => {
    expect(validateItalianVAT("it01234567890")).toBe(true);
  });
});

// ============================================
// ITALIAN FISCAL CODE (C.F.)
// ============================================

describe("unit: Fiscal ID - Italian Fiscal Code (C.F.)", () => {
  it("should accept valid fiscal codes", () => {
    expect(validateItalianFiscalCode("RSSMRA80A01H501U")).toBe(true);
  });

  it("should reject wrong length", () => {
    expect(validateItalianFiscalCode("RSSMRA80A01H501")).toBe(false);
    expect(validateItalianFiscalCode("RSSMRA80A01H501UX")).toBe(false);
  });

  it("should reject invalid format", () => {
    expect(validateItalianFiscalCode("1234567890123456")).toBe(false);
  });

  it("should be case insensitive", () => {
    expect(validateItalianFiscalCode("rssmra80a01h501u")).toBe(true);
  });
});

// ============================================
// SLOVAK VAT (IČ DPH)
// ============================================

describe("unit: Fiscal ID - Slovak VAT (IČ DPH)", () => {
  it("should accept valid SK VAT numbers", () => {
    expect(validateSlovakVAT("SK1234567890")).toBe(true);
    expect(validateSlovakVAT("SK0000000001")).toBe(true);
  });

  it("should reject missing SK prefix", () => {
    expect(validateSlovakVAT("1234567890")).toBe(false);
  });

  it("should reject wrong digit count", () => {
    expect(validateSlovakVAT("SK123456789")).toBe(false);
    expect(validateSlovakVAT("SK12345678901")).toBe(false);
  });

  it("should be case insensitive", () => {
    expect(validateSlovakVAT("sk1234567890")).toBe(true);
  });
});

// ============================================
// SLOVAK TAX ID (DIČ)
// ============================================

describe("unit: Fiscal ID - Slovak Tax ID (DIČ)", () => {
  it("should accept valid 10-digit DIČ", () => {
    expect(validateSlovakTaxId("1234567890")).toBe(true);
  });

  it("should reject non-10-digit values", () => {
    expect(validateSlovakTaxId("123456789")).toBe(false);
    expect(validateSlovakTaxId("12345678901")).toBe(false);
  });

  it("should reject non-numeric", () => {
    expect(validateSlovakTaxId("123456789A")).toBe(false);
  });
});

// ============================================
// SLOVAK COMPANY ID (IČO)
// ============================================

describe("unit: Fiscal ID - Slovak Company ID (IČO)", () => {
  it("should accept valid 8-digit IČO", () => {
    expect(validateSlovakCompanyId("12345678")).toBe(true);
  });

  it("should reject non-8-digit values", () => {
    expect(validateSlovakCompanyId("1234567")).toBe(false);
    expect(validateSlovakCompanyId("123456789")).toBe(false);
  });

  it("should reject non-numeric", () => {
    expect(validateSlovakCompanyId("1234567A")).toBe(false);
  });
});

// ============================================
// GENERIC DISPATCHER
// ============================================

describe("unit: Fiscal ID - Generic validateFiscalId", () => {
  it("should validate IT vat_number correctly", () => {
    expect(validateFiscalId("IT", "vat_number", "IT01234567890").valid).toBe(true);
    expect(validateFiscalId("IT", "vat_number", "INVALID").valid).toBe(false);
  });

  it("should validate IT fiscal_code correctly", () => {
    expect(validateFiscalId("IT", "fiscal_code", "RSSMRA80A01H501U").valid).toBe(true);
    expect(validateFiscalId("IT", "fiscal_code", "INVALID").valid).toBe(false);
  });

  it("should validate SK vat_number correctly", () => {
    expect(validateFiscalId("SK", "vat_number", "SK1234567890").valid).toBe(true);
    expect(validateFiscalId("SK", "vat_number", "INVALID").valid).toBe(false);
  });

  it("should validate SK company_id correctly", () => {
    expect(validateFiscalId("SK", "company_id", "12345678").valid).toBe(true);
    expect(validateFiscalId("SK", "company_id", "123").valid).toBe(false);
  });

  it("should validate SK tax_id correctly", () => {
    expect(validateFiscalId("SK", "tax_id", "1234567890").valid).toBe(true);
    expect(validateFiscalId("SK", "tax_id", "123").valid).toBe(false);
  });

  it("should return valid for unknown country", () => {
    expect(validateFiscalId("XX", "vat_number", "anything").valid).toBe(true);
  });

  it("should return valid for unknown field", () => {
    expect(validateFiscalId("IT", "unknown_field", "anything").valid).toBe(true);
  });

  it("should return invalid for empty value", () => {
    expect(validateFiscalId("IT", "vat_number", "").valid).toBe(false);
    expect(validateFiscalId("IT", "vat_number", "   ").valid).toBe(false);
  });

  it("should return an error message on invalid input", () => {
    const result = validateFiscalId("IT", "vat_number", "WRONG");
    expect(result.valid).toBe(false);
    expect(result.message).toBeDefined();
    expect(result.message!.length).toBeGreaterThan(0);
  });
});
