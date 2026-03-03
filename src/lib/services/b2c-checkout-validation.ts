/**
 * B2C Checkout Validation Service
 *
 * Pure validation for B2C checkout requests — validates buyer data,
 * Italian e-invoicing requirements, and address snapshots.
 *
 * Invoice requirement rules:
 * - No invoice requested → no fiscal fields required
 * - Private + invoice → fiscal_code required (16-char)
 * - Business + invoice → company_name, vat_number (IT+11), fiscal_code,
 *   + either pec_email or sdi_code
 */

import {
  validateVatNumber,
  validateFiscalCode,
  validateSdiCode,
} from "@/lib/db/models/customer";
import type {
  IBuyerSnapshot,
  IInvoiceData,
  IAddressSnapshot,
} from "@/lib/db/models/order";

export interface B2CCheckoutInput {
  buyer: IBuyerSnapshot;
  invoice_requested?: boolean;
  invoice_data?: IInvoiceData;
  shipping_snapshot: IAddressSnapshot;
  billing_snapshot?: IAddressSnapshot;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate buyer snapshot fields
 */
export function validateBuyer(buyer: IBuyerSnapshot): ValidationResult {
  const errors: string[] = [];

  if (!buyer.email || !buyer.email.includes("@")) {
    errors.push("Valid email is required");
  }
  if (!buyer.first_name?.trim()) {
    errors.push("First name is required");
  }
  if (!buyer.last_name?.trim()) {
    errors.push("Last name is required");
  }
  if (!buyer.customer_type || !["private", "business"].includes(buyer.customer_type)) {
    errors.push("customer_type must be 'private' or 'business'");
  }
  if (buyer.customer_type === "business" && !buyer.company_name?.trim()) {
    errors.push("Company name is required for business customers");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate Italian e-invoicing data based on buyer type
 */
export function validateInvoiceData(
  buyerType: "private" | "business",
  invoiceData?: IInvoiceData
): ValidationResult {
  const errors: string[] = [];

  if (!invoiceData) {
    errors.push("Invoice data is required when invoice is requested");
    return { valid: false, errors };
  }

  if (buyerType === "private") {
    // Private: fiscal_code required
    if (!invoiceData.fiscal_code) {
      errors.push("Codice fiscale is required for private invoices");
    } else if (!validateFiscalCode(invoiceData.fiscal_code)) {
      errors.push("Invalid codice fiscale format");
    }
  } else {
    // Business: vat_number + fiscal_code + (pec_email OR sdi_code)
    if (!invoiceData.vat_number) {
      errors.push("P.IVA is required for business invoices");
    } else if (!validateVatNumber(invoiceData.vat_number)) {
      errors.push("Invalid P.IVA format (expected IT + 11 digits)");
    }

    if (!invoiceData.fiscal_code) {
      errors.push("Codice fiscale is required for business invoices");
    } else if (!validateFiscalCode(invoiceData.fiscal_code)) {
      errors.push("Invalid codice fiscale format");
    }

    if (!invoiceData.pec_email && !invoiceData.sdi_code) {
      errors.push("Either PEC email or SDI code is required for business invoices");
    }

    if (invoiceData.sdi_code && !validateSdiCode(invoiceData.sdi_code)) {
      errors.push("Invalid SDI code format (expected 7 alphanumeric characters)");
    }

    if (invoiceData.pec_email && !invoiceData.pec_email.includes("@")) {
      errors.push("Invalid PEC email format");
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate an address snapshot
 */
export function validateAddressSnapshot(
  address: IAddressSnapshot,
  label: string
): ValidationResult {
  const errors: string[] = [];
  const required: (keyof IAddressSnapshot)[] = [
    "recipient_name",
    "street_address",
    "city",
    "province",
    "postal_code",
    "country",
  ];

  for (const field of required) {
    if (!address[field]?.toString().trim()) {
      errors.push(`${label}: ${field} is required`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Full B2C checkout validation
 *
 * Validates buyer, invoice data (if requested), and address snapshots.
 */
export function validateB2CCheckout(input: B2CCheckoutInput): ValidationResult {
  const errors: string[] = [];

  // Validate buyer
  const buyerResult = validateBuyer(input.buyer);
  errors.push(...buyerResult.errors);

  // Validate invoice data if requested
  if (input.invoice_requested && input.buyer.customer_type) {
    const invoiceResult = validateInvoiceData(
      input.buyer.customer_type,
      input.invoice_data
    );
    errors.push(...invoiceResult.errors);
  }

  // Validate shipping address
  const shippingResult = validateAddressSnapshot(input.shipping_snapshot, "Shipping address");
  errors.push(...shippingResult.errors);

  // Validate billing address (if separate)
  if (input.billing_snapshot) {
    const billingResult = validateAddressSnapshot(input.billing_snapshot, "Billing address");
    errors.push(...billingResult.errors);
  }

  return { valid: errors.length === 0, errors };
}
