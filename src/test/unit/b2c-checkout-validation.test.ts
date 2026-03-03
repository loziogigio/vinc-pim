import { describe, it, expect } from "vitest";
import {
  validateBuyer,
  validateInvoiceData,
  validateAddressSnapshot,
  validateB2CCheckout,
} from "@/lib/services/b2c-checkout-validation";
import type {
  IBuyerSnapshot,
  IInvoiceData,
  IAddressSnapshot,
} from "@/lib/db/models/order";

// ── Helpers ──

const validPrivateBuyer: IBuyerSnapshot = {
  email: "mario@rossi.it",
  first_name: "Mario",
  last_name: "Rossi",
  phone: "+39 333 1234567",
  customer_type: "private",
  is_guest: true,
};

const validBusinessBuyer: IBuyerSnapshot = {
  email: "info@azienda.it",
  first_name: "Mario",
  last_name: "Rossi",
  customer_type: "business",
  company_name: "Azienda S.r.l.",
  is_guest: true,
};

const validAddress: IAddressSnapshot = {
  recipient_name: "Mario Rossi",
  street_address: "Via Roma 1",
  city: "Milano",
  province: "MI",
  postal_code: "20100",
  country: "IT",
};

// ── validateBuyer ──

describe("unit: validateBuyer", () => {
  it("should pass for valid private buyer", () => {
    const result = validateBuyer(validPrivateBuyer);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should pass for valid business buyer", () => {
    const result = validateBuyer(validBusinessBuyer);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fail if email missing", () => {
    const result = validateBuyer({ ...validPrivateBuyer, email: "" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Valid email is required");
  });

  it("should fail if first_name missing", () => {
    const result = validateBuyer({ ...validPrivateBuyer, first_name: "" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("First name is required");
  });

  it("should fail if business buyer has no company_name", () => {
    const result = validateBuyer({ ...validBusinessBuyer, company_name: "" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Company name is required for business customers");
  });
});

// ── validateInvoiceData ──

describe("unit: validateInvoiceData", () => {
  it("should pass for private with valid fiscal code", () => {
    const result = validateInvoiceData("private", {
      fiscal_code: "RSSMRA85M01H501Z",
    });
    expect(result.valid).toBe(true);
  });

  it("should fail for private with missing fiscal code", () => {
    const result = validateInvoiceData("private", {});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Codice fiscale is required for private invoices");
  });

  it("should fail for private with invalid fiscal code", () => {
    const result = validateInvoiceData("private", {
      fiscal_code: "INVALID",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Invalid codice fiscale format");
  });

  it("should pass for business with all fields + SDI", () => {
    const result = validateInvoiceData("business", {
      vat_number: "IT12345678901",
      fiscal_code: "12345678901",
      sdi_code: "A1B2C3D",
    });
    expect(result.valid).toBe(true);
  });

  it("should pass for business with all fields + PEC (no SDI)", () => {
    const result = validateInvoiceData("business", {
      vat_number: "IT12345678901",
      fiscal_code: "12345678901",
      pec_email: "azienda@pec.it",
    });
    expect(result.valid).toBe(true);
  });

  it("should fail for business with missing P.IVA", () => {
    const result = validateInvoiceData("business", {
      fiscal_code: "12345678901",
      sdi_code: "A1B2C3D",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("P.IVA is required for business invoices");
  });

  it("should fail for business with invalid P.IVA format", () => {
    const result = validateInvoiceData("business", {
      vat_number: "12345",
      fiscal_code: "12345678901",
      sdi_code: "A1B2C3D",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Invalid P.IVA format (expected IT + 11 digits)");
  });

  it("should fail for business without PEC or SDI", () => {
    const result = validateInvoiceData("business", {
      vat_number: "IT12345678901",
      fiscal_code: "12345678901",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Either PEC email or SDI code is required for business invoices"
    );
  });

  it("should fail for business with invalid SDI code", () => {
    const result = validateInvoiceData("business", {
      vat_number: "IT12345678901",
      fiscal_code: "12345678901",
      sdi_code: "AB",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Invalid SDI code format (expected 7 alphanumeric characters)");
  });

  it("should fail if no invoice_data provided at all", () => {
    const result = validateInvoiceData("private", undefined);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Invoice data is required when invoice is requested");
  });
});

// ── validateAddressSnapshot ──

describe("unit: validateAddressSnapshot", () => {
  it("should pass for valid address", () => {
    const result = validateAddressSnapshot(validAddress, "Shipping address");
    expect(result.valid).toBe(true);
  });

  it("should fail for missing city", () => {
    const result = validateAddressSnapshot(
      { ...validAddress, city: "" },
      "Shipping address"
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("city is required");
  });
});

// ── validateB2CCheckout (full validation) ──

describe("unit: validateB2CCheckout", () => {
  it("should pass for guest with no invoice", () => {
    const result = validateB2CCheckout({
      buyer: validPrivateBuyer,
      invoice_requested: false,
      shipping_snapshot: validAddress,
    });
    expect(result.valid).toBe(true);
  });

  it("should pass for private guest with valid invoice", () => {
    const result = validateB2CCheckout({
      buyer: validPrivateBuyer,
      invoice_requested: true,
      invoice_data: { fiscal_code: "RSSMRA85M01H501Z" },
      shipping_snapshot: validAddress,
    });
    expect(result.valid).toBe(true);
  });

  it("should pass for business guest with valid invoice (SDI)", () => {
    const result = validateB2CCheckout({
      buyer: validBusinessBuyer,
      invoice_requested: true,
      invoice_data: {
        vat_number: "IT12345678901",
        fiscal_code: "12345678901",
        sdi_code: "A1B2C3D",
      },
      shipping_snapshot: validAddress,
    });
    expect(result.valid).toBe(true);
  });

  it("should fail for private guest with invoice but missing fiscal code", () => {
    const result = validateB2CCheckout({
      buyer: validPrivateBuyer,
      invoice_requested: true,
      invoice_data: {},
      shipping_snapshot: validAddress,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should fail if shipping address is incomplete", () => {
    const result = validateB2CCheckout({
      buyer: validPrivateBuyer,
      shipping_snapshot: { ...validAddress, postal_code: "" },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("postal_code"))).toBe(true);
  });

  it("should validate billing address when provided", () => {
    const result = validateB2CCheckout({
      buyer: validPrivateBuyer,
      shipping_snapshot: validAddress,
      billing_snapshot: { ...validAddress, street_address: "" },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Billing address"))).toBe(true);
  });
});
