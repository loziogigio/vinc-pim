/**
 * Unit Tests — Order Snapshot Service
 *
 * Tests the pure conversion functions that transform customer/address
 * data into immutable order snapshots.
 */

import { describe, it, expect } from "vitest";
import {
  addressToSnapshot,
  customerToBuyerSnapshot,
  customerToInvoiceData,
} from "@/lib/services/order-snapshot.service";
import type { IAddress, ICustomer } from "@/lib/db/models/customer";

// ============================================
// FIXTURES
// ============================================

function makeAddress(overrides: Partial<IAddress> = {}): IAddress {
  return {
    address_id: "addr-001",
    address_type: "delivery",
    is_default: true,
    recipient_name: "Mario Rossi",
    street_address: "Via Roma 1",
    street_address_2: "Piano 3",
    city: "Milano",
    province: "MI",
    postal_code: "20100",
    country: "IT",
    phone: "+39 02 1234567",
    delivery_notes: "Ring twice",
    tag_overrides: [],
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as IAddress;
}

function makeCustomer(overrides: Partial<ICustomer> = {}): ICustomer {
  return {
    customer_id: "cust-001",
    tenant_id: "test-tenant",
    customer_type: "business",
    is_guest: false,
    channel: "web",
    email: "mario@example.com",
    phone: "+39 333 1234567",
    first_name: "Mario",
    last_name: "Rossi",
    company_name: "Rossi S.r.l.",
    legal_info: {
      vat_number: "IT12345678901",
      fiscal_code: "RSSMRA80A01F205X",
      pec_email: "pec@rossi.it",
      sdi_code: "ABC1234",
    },
    tags: [],
    addresses: [],
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as unknown as ICustomer;
}

// ============================================
// addressToSnapshot
// ============================================

describe("unit: addressToSnapshot", () => {
  it("should convert a full address to a snapshot", () => {
    const address = makeAddress();
    const snapshot = addressToSnapshot(address);

    expect(snapshot.recipient_name).toBe("Mario Rossi");
    expect(snapshot.street_address).toBe("Via Roma 1");
    expect(snapshot.street_address_2).toBe("Piano 3");
    expect(snapshot.city).toBe("Milano");
    expect(snapshot.province).toBe("MI");
    expect(snapshot.postal_code).toBe("20100");
    expect(snapshot.country).toBe("IT");
    expect(snapshot.phone).toBe("+39 02 1234567");
  });

  it("should omit optional fields when empty", () => {
    const address = makeAddress({
      street_address_2: undefined,
      phone: undefined,
    });
    const snapshot = addressToSnapshot(address);

    expect(snapshot.street_address_2).toBeUndefined();
    expect(snapshot.phone).toBeUndefined();
  });

  it("should not include delivery_notes or tag_overrides", () => {
    const address = makeAddress({ delivery_notes: "Ring twice" });
    const snapshot = addressToSnapshot(address);

    expect(snapshot).not.toHaveProperty("delivery_notes");
    expect(snapshot).not.toHaveProperty("tag_overrides");
    expect(snapshot).not.toHaveProperty("address_id");
  });
});

// ============================================
// customerToBuyerSnapshot
// ============================================

describe("unit: customerToBuyerSnapshot", () => {
  it("should map business customer to buyer snapshot", () => {
    const customer = makeCustomer();
    const snapshot = customerToBuyerSnapshot(customer);

    expect(snapshot.email).toBe("mario@example.com");
    expect(snapshot.first_name).toBe("Mario");
    expect(snapshot.last_name).toBe("Rossi");
    expect(snapshot.phone).toBe("+39 333 1234567");
    expect(snapshot.customer_type).toBe("business");
    expect(snapshot.company_name).toBe("Rossi S.r.l.");
    expect(snapshot.is_guest).toBe(false);
  });

  it("should handle private customer type", () => {
    const customer = makeCustomer({
      customer_type: "private",
      company_name: undefined,
    });
    const snapshot = customerToBuyerSnapshot(customer);

    expect(snapshot.customer_type).toBe("private");
    expect(snapshot.company_name).toBeUndefined();
  });

  it("should handle reseller customer type", () => {
    const customer = makeCustomer({
      customer_type: "reseller",
      company_name: "Distribuzione S.r.l.",
    });
    const snapshot = customerToBuyerSnapshot(customer);

    expect(snapshot.customer_type).toBe("reseller");
    expect(snapshot.company_name).toBe("Distribuzione S.r.l.");
  });

  it("should handle guest customer", () => {
    const customer = makeCustomer({ is_guest: true });
    const snapshot = customerToBuyerSnapshot(customer);

    expect(snapshot.is_guest).toBe(true);
  });

  it("should default empty names to empty strings", () => {
    const customer = makeCustomer({
      first_name: undefined,
      last_name: undefined,
    });
    const snapshot = customerToBuyerSnapshot(customer);

    expect(snapshot.first_name).toBe("");
    expect(snapshot.last_name).toBe("");
  });
});

// ============================================
// customerToInvoiceData
// ============================================

describe("unit: customerToInvoiceData", () => {
  it("should map all fiscal fields from legal_info", () => {
    const customer = makeCustomer();
    const invoiceData = customerToInvoiceData(customer);

    expect(invoiceData).toBeDefined();
    expect(invoiceData!.company_name).toBe("Rossi S.r.l.");
    expect(invoiceData!.vat_number).toBe("IT12345678901");
    expect(invoiceData!.fiscal_code).toBe("RSSMRA80A01F205X");
    expect(invoiceData!.pec_email).toBe("pec@rossi.it");
    expect(invoiceData!.sdi_code).toBe("ABC1234");
  });

  it("should return undefined if customer has no legal_info", () => {
    const customer = makeCustomer({ legal_info: undefined });
    const invoiceData = customerToInvoiceData(customer);

    expect(invoiceData).toBeUndefined();
  });

  it("should return undefined if legal_info has no fiscal fields", () => {
    const customer = makeCustomer({
      legal_info: {
        vat_number: undefined,
        fiscal_code: undefined,
        pec_email: undefined,
        sdi_code: undefined,
      },
    });
    const invoiceData = customerToInvoiceData(customer);

    expect(invoiceData).toBeUndefined();
  });

  it("should include company_name from customer even with partial legal_info", () => {
    const customer = makeCustomer({
      company_name: "Azienda Test",
      legal_info: {
        vat_number: "IT99999999999",
      },
    });
    const invoiceData = customerToInvoiceData(customer);

    expect(invoiceData).toBeDefined();
    expect(invoiceData!.company_name).toBe("Azienda Test");
    expect(invoiceData!.vat_number).toBe("IT99999999999");
    expect(invoiceData!.fiscal_code).toBeUndefined();
    expect(invoiceData!.pec_email).toBeUndefined();
    expect(invoiceData!.sdi_code).toBeUndefined();
  });

  it("should return undefined company_name if customer has none", () => {
    const customer = makeCustomer({
      company_name: undefined,
      legal_info: { fiscal_code: "RSSMRA80A01F205X" },
    });
    const invoiceData = customerToInvoiceData(customer);

    expect(invoiceData).toBeDefined();
    expect(invoiceData!.company_name).toBeUndefined();
  });
});
