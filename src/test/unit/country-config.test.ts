/**
 * Unit Tests for Country Configuration
 *
 * Tests country configs, labels completeness, VAT rates, fiscal ID fields,
 * fallback behavior, and backwards compatibility with Italian defaults.
 */

import { describe, it, expect } from "vitest";
import {
  COUNTRY_CONFIGS,
  SUPPORTED_COUNTRIES,
  DEFAULT_COUNTRY_CODE,
  getCountryConfig,
  getLabels,
  getVatRates,
  getFiscalIdFields,
  isCountrySupported,
  getLocale,
} from "@/lib/constants/countries";
import {
  DOCUMENT_TYPES,
  DOCUMENT_STATUSES,
  PAYMENT_TERMS,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
} from "@/lib/constants/document";

// ============================================
// REGISTRY
// ============================================

describe("unit: Country Config - Registry", () => {
  it("should have IT and SK configs", () => {
    expect(SUPPORTED_COUNTRIES).toContain("IT");
    expect(SUPPORTED_COUNTRIES).toContain("SK");
    expect(SUPPORTED_COUNTRIES.length).toBeGreaterThanOrEqual(2);
  });

  it("should default to IT", () => {
    expect(DEFAULT_COUNTRY_CODE).toBe("IT");
  });

  it("isCountrySupported returns true for IT and SK", () => {
    expect(isCountrySupported("IT")).toBe(true);
    expect(isCountrySupported("SK")).toBe(true);
    expect(isCountrySupported("XX")).toBe(false);
  });

  it("should be case insensitive", () => {
    expect(isCountrySupported("it")).toBe(true);
    expect(isCountrySupported("sk")).toBe(true);
  });
});

// ============================================
// GET COUNTRY CONFIG
// ============================================

describe("unit: Country Config - getCountryConfig", () => {
  it("should return IT config", () => {
    const config = getCountryConfig("IT");
    expect(config.code).toBe("IT");
    expect(config.name).toBe("Italy");
    expect(config.default_currency).toBe("EUR");
    expect(config.primary_language).toBe("it");
  });

  it("should return SK config", () => {
    const config = getCountryConfig("SK");
    expect(config.code).toBe("SK");
    expect(config.name).toBe("Slovakia");
    expect(config.default_currency).toBe("EUR");
    expect(config.primary_language).toBe("sk");
  });

  it("should fall back to IT for unknown country", () => {
    const config = getCountryConfig("ZZ");
    expect(config.code).toBe("IT");
  });

  it("should be case insensitive", () => {
    expect(getCountryConfig("it").code).toBe("IT");
    expect(getCountryConfig("sk").code).toBe("SK");
  });

  it("each country should have 2 supported languages", () => {
    for (const config of Object.values(COUNTRY_CONFIGS)) {
      expect(config.supported_languages.length).toBe(2);
      expect(config.supported_languages).toContain("en");
      expect(config.supported_languages).toContain(config.primary_language);
    }
  });
});

// ============================================
// LABELS COMPLETENESS
// ============================================

describe("unit: Country Config - Labels completeness", () => {
  for (const [code, config] of Object.entries(COUNTRY_CONFIGS)) {
    for (const lang of config.supported_languages) {
      const labels = config.labels[lang];
      if (!labels) continue;

      it(`${code}/${lang} should have all document type labels`, () => {
        for (const type of DOCUMENT_TYPES) {
          expect(labels.document_types[type]).toBeDefined();
          expect(labels.document_types[type]).not.toBe("");
        }
      });

      it(`${code}/${lang} should have all document status labels`, () => {
        for (const status of DOCUMENT_STATUSES) {
          expect(labels.document_statuses[status]).toBeDefined();
          expect(labels.document_statuses[status]).not.toBe("");
        }
      });

      it(`${code}/${lang} should have all payment terms labels`, () => {
        for (const term of PAYMENT_TERMS) {
          expect(labels.payment_terms[term]).toBeDefined();
          expect(labels.payment_terms[term]).not.toBe("");
        }
      });

      it(`${code}/${lang} should have all required template labels`, () => {
        const requiredKeys = [
          "recipient", "description", "quantity", "unit_price",
          "discount", "vat", "total", "subtotal", "notes",
          "date", "due_date", "draft",
        ] as const;
        for (const key of requiredKeys) {
          expect(labels.template[key]).toBeDefined();
          expect(labels.template[key]).not.toBe("");
        }
      });

      it(`${code}/${lang} should have all email labels`, () => {
        expect(labels.email.dear_customer).toBeDefined();
        expect(labels.email.attached_document).toBeDefined();
        expect(labels.email.pdf_format).toBeDefined();
        expect(labels.email.regards).toBeDefined();
      });

      it(`${code}/${lang} should have a valid locale`, () => {
        expect(labels.locale).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
      });
    }
  }
});

// ============================================
// BACKWARDS COMPATIBILITY
// ============================================

describe("unit: Country Config - IT backward compat", () => {
  it("IT/it labels should match existing hardcoded DOCUMENT_TYPE_LABELS", () => {
    const labels = getLabels("IT", "it");
    for (const type of DOCUMENT_TYPES) {
      expect(labels.document_types[type]).toBe(DOCUMENT_TYPE_LABELS[type]);
    }
  });

  it("IT/it labels should match existing hardcoded DOCUMENT_STATUS_LABELS", () => {
    const labels = getLabels("IT", "it");
    for (const status of DOCUMENT_STATUSES) {
      expect(labels.document_statuses[status]).toBe(DOCUMENT_STATUS_LABELS[status]);
    }
  });

  it("IT/it template labels should match current Italian strings", () => {
    const labels = getLabels("IT", "it");
    expect(labels.template.recipient).toBe("Destinatario");
    expect(labels.template.vat_number).toBe("P.IVA");
    expect(labels.template.fiscal_code).toBe("C.F.");
    expect(labels.template.subtotal).toBe("Imponibile");
    expect(labels.template.dear_customer).toBe("Spett.le");
    expect(labels.template.draft).toBe("BOZZA");
  });
});

// ============================================
// VAT RATES
// ============================================

describe("unit: Country Config - VAT Rates", () => {
  it("IT should have 4 VAT rates (22, 10, 4, 0)", () => {
    const rates = getVatRates("IT");
    expect(rates.length).toBe(4);
    const values = rates.map((r) => r.rate);
    expect(values).toContain(22);
    expect(values).toContain(10);
    expect(values).toContain(4);
    expect(values).toContain(0);
  });

  it("SK should have 2 VAT rates (20, 10)", () => {
    const rates = getVatRates("SK");
    expect(rates.length).toBe(2);
    const values = rates.map((r) => r.rate);
    expect(values).toContain(20);
    expect(values).toContain(10);
  });

  it("each VAT rate should have a label_key", () => {
    for (const config of Object.values(COUNTRY_CONFIGS)) {
      for (const rate of config.vat_rates) {
        expect(rate.label_key).toBeDefined();
        expect(rate.label_key).not.toBe("");
      }
    }
  });
});

// ============================================
// FISCAL ID FIELDS
// ============================================

describe("unit: Country Config - Fiscal ID Fields", () => {
  it("IT should have vat_number and fiscal_code", () => {
    const fields = getFiscalIdFields("IT");
    const keys = fields.map((f) => f.field_key);
    expect(keys).toContain("vat_number");
    expect(keys).toContain("fiscal_code");
    expect(fields.length).toBe(2);
  });

  it("SK should have vat_number, tax_id, and company_id", () => {
    const fields = getFiscalIdFields("SK");
    const keys = fields.map((f) => f.field_key);
    expect(keys).toContain("vat_number");
    expect(keys).toContain("tax_id");
    expect(keys).toContain("company_id");
    expect(fields.length).toBe(3);
  });

  it("each field should have a pattern and format_hint", () => {
    for (const config of Object.values(COUNTRY_CONFIGS)) {
      for (const field of config.fiscal_id_fields) {
        expect(field.pattern).toBeInstanceOf(RegExp);
        expect(field.format_hint).toBeDefined();
        expect(field.format_hint.length).toBeGreaterThan(5);
      }
    }
  });
});

// ============================================
// FALLBACKS
// ============================================

describe("unit: Country Config - Fallbacks", () => {
  it("getLabels should fallback to primary language for unsupported lang", () => {
    const labels = getLabels("IT", "sk");
    expect(labels.document_types.invoice).toBe("Fattura");
  });

  it("getLabels should fallback to IT for unknown country", () => {
    const labels = getLabels("XX");
    expect(labels.document_types.invoice).toBe("Fattura");
  });

  it("getLabels with no language should use primary", () => {
    const itLabels = getLabels("IT");
    expect(itLabels.locale).toBe("it-IT");
    const skLabels = getLabels("SK");
    expect(skLabels.locale).toBe("sk-SK");
  });

  it("getLocale should return correct locale", () => {
    expect(getLocale("IT", "it")).toBe("it-IT");
    expect(getLocale("IT", "en")).toBe("en-GB");
    expect(getLocale("SK", "sk")).toBe("sk-SK");
    expect(getLocale("SK", "en")).toBe("en-GB");
  });
});

// ============================================
// SLOVAK SPECIFIC LABELS
// ============================================

describe("unit: Country Config - Slovak labels", () => {
  it("SK/sk should have correct Slovak labels", () => {
    const labels = getLabels("SK", "sk");
    expect(labels.document_types.invoice).toBe("Faktúra");
    expect(labels.document_types.quotation).toBe("Cenová ponuka");
    expect(labels.document_types.credit_note).toBe("Dobropis");
    expect(labels.document_statuses.draft).toBe("Koncept");
    expect(labels.template.vat).toBe("DPH");
    expect(labels.template.ico).toBe("IČO");
    expect(labels.template.dic).toBe("DIČ");
    expect(labels.template.ic_dph).toBe("IČ DPH");
  });

  it("SK/en should have English labels", () => {
    const labels = getLabels("SK", "en");
    expect(labels.document_types.invoice).toBe("Invoice");
    expect(labels.template.vat).toBe("VAT");
  });
});
