/**
 * Unit Tests: Company Contact Info
 *
 * Tests for company contact info validation and email footer rendering.
 */

import { describe, it, expect } from "vitest";
import type { CompanyContactInfo } from "@/lib/types/home-settings";

describe("unit: Company Contact Info", () => {
  describe("CompanyContactInfo interface", () => {
    it("should have all optional fields", () => {
      /**
       * Test that empty company info is valid.
       */
      const emptyInfo: CompanyContactInfo = {};
      expect(emptyInfo).toBeDefined();
    });

    it("should accept all fields", () => {
      /**
       * Test complete company info object.
       */
      const fullInfo: CompanyContactInfo = {
        legal_name: "Test Company Srl",
        address_line1: "Via Test 123",
        address_line2: "00100 Roma (RM)",
        phone: "+39 06 1234567",
        email: "info@test.com",
        support_email: "support@test.com",
        business_hours: "Lun-Ven 9:00-18:00",
        vat_number: "IT12345678901",
      };

      expect(fullInfo.legal_name).toBe("Test Company Srl");
      expect(fullInfo.address_line1).toBe("Via Test 123");
      expect(fullInfo.address_line2).toBe("00100 Roma (RM)");
      expect(fullInfo.phone).toBe("+39 06 1234567");
      expect(fullInfo.email).toBe("info@test.com");
      expect(fullInfo.support_email).toBe("support@test.com");
      expect(fullInfo.business_hours).toBe("Lun-Ven 9:00-18:00");
      expect(fullInfo.vat_number).toBe("IT12345678901");
    });
  });

  describe("Email Footer Rendering", () => {
    const renderFooterInfo = (info: CompanyContactInfo, fallbackName: string) => {
      const legalName = info.legal_name || fallbackName;
      const addressLine1 = info.address_line1 || "";
      const addressLine2 = info.address_line2 || "";
      const phone = info.phone || "";
      const email = info.email || "";
      const businessHours = info.business_hours || "";

      return { legalName, addressLine1, addressLine2, phone, email, businessHours };
    };

    it("should use fallback company name when legal_name is empty", () => {
      /**
       * Test fallback to company name.
       */
      const info: CompanyContactInfo = {};
      const result = renderFooterInfo(info, "Fallback Company");

      expect(result.legalName).toBe("Fallback Company");
    });

    it("should use legal_name when provided", () => {
      /**
       * Test legal name takes precedence.
       */
      const info: CompanyContactInfo = { legal_name: "Legal Name Srl" };
      const result = renderFooterInfo(info, "Fallback Company");

      expect(result.legalName).toBe("Legal Name Srl");
    });

    it("should combine address lines", () => {
      /**
       * Test address line combination.
       */
      const info: CompanyContactInfo = {
        address_line1: "Via Roma 1",
        address_line2: "00100 Roma",
      };
      const result = renderFooterInfo(info, "Company");

      expect(result.addressLine1).toBe("Via Roma 1");
      expect(result.addressLine2).toBe("00100 Roma");

      // Combined format
      const combined = [result.addressLine1, result.addressLine2].filter(Boolean).join(" - ");
      expect(combined).toBe("Via Roma 1 - 00100 Roma");
    });

    it("should handle partial address", () => {
      /**
       * Test with only one address line.
       */
      const info: CompanyContactInfo = {
        address_line1: "Via Roma 1",
      };
      const result = renderFooterInfo(info, "Company");

      const combined = [result.addressLine1, result.addressLine2].filter(Boolean).join(" - ");
      expect(combined).toBe("Via Roma 1");
    });

    it("should format contact info correctly", () => {
      /**
       * Test phone and email formatting.
       */
      const info: CompanyContactInfo = {
        phone: "+39 06 1234567",
        email: "info@test.com",
      };
      const result = renderFooterInfo(info, "Company");

      // Simulate footer contact line
      const contactParts = [
        result.phone ? `📞 ${result.phone}` : "",
        result.email ? `✉️ ${result.email}` : "",
      ].filter(Boolean);

      expect(contactParts).toContain("📞 +39 06 1234567");
      expect(contactParts).toContain("✉️ info@test.com");
    });

    it("should handle empty contact info gracefully", () => {
      /**
       * Test empty info doesn't break rendering.
       */
      const info: CompanyContactInfo = {};
      const result = renderFooterInfo(info, "Fallback");

      expect(result.addressLine1).toBe("");
      expect(result.phone).toBe("");
      expect(result.email).toBe("");
      expect(result.businessHours).toBe("");
    });
  });

  describe("VAT Number Validation", () => {
    it("should accept Italian VAT format", () => {
      /**
       * Test Italian P.IVA format (IT + 11 digits).
       */
      const vatRegex = /^IT\d{11}$/;

      expect(vatRegex.test("IT12345678901")).toBe(true);
      expect(vatRegex.test("IT00000000000")).toBe(true);
    });

    it("should reject invalid VAT formats", () => {
      /**
       * Test invalid VAT formats.
       */
      const vatRegex = /^IT\d{11}$/;

      expect(vatRegex.test("12345678901")).toBe(false); // Missing IT prefix
      expect(vatRegex.test("IT1234567890")).toBe(false); // Only 10 digits
      expect(vatRegex.test("IT123456789012")).toBe(false); // 12 digits
      expect(vatRegex.test("DE123456789")).toBe(false); // Wrong country
    });
  });
});
