import mongoose, { Schema, Document } from "mongoose";

/**
 * Customer Model
 *
 * B2B customer profiles with embedded addresses and Italian e-invoicing legal info.
 * Supports guest (one-time) and registered customers.
 *
 * Collection: customers (lowercase, pluralized per CLAUDE.md)
 */

// ============================================
// INTERFACES
// ============================================

export interface ILegalInfo {
  /** P.IVA (VAT number) - format: IT + 11 digits */
  vat_number?: string;
  /** Codice Fiscale - 16 chars for individuals, 11 digits for companies */
  fiscal_code?: string;
  /** PEC certified email address */
  pec_email?: string;
  /** SDI code for electronic invoicing - 7 alphanumeric chars */
  sdi_code?: string;
}

export interface IAddress {
  /** Internal ID - always generated (nanoid 8) */
  address_id: string;
  /** Optional ERP code for external system lookup */
  external_code?: string;

  // Type
  address_type: "delivery" | "billing" | "both";
  label?: string;
  is_default: boolean;

  // Address fields
  recipient_name: string;
  street_address: string;
  street_address_2?: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;

  // Contact
  phone?: string;
  delivery_notes?: string;

  // Timestamps
  created_at: Date;
  updated_at: Date;
}

export interface ICustomer extends Document {
  // Identity
  customer_id: string;
  /** ERP internal code for external system lookup */
  external_code?: string;
  /** Public customer code for administrative purposes (invoices, documents) */
  public_code?: string;
  tenant_id: string;

  // Type
  customer_type: "business" | "private" | "reseller";
  is_guest: boolean;

  // Contact
  email: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;

  // Legal info
  legal_info?: ILegalInfo;

  // Addresses
  addresses: IAddress[];
  default_shipping_address_id?: string;
  default_billing_address_id?: string;

  // Timestamps
  created_at: Date;
  updated_at: Date;
}

// ============================================
// SCHEMAS
// ============================================

const LegalInfoSchema = new Schema<ILegalInfo>(
  {
    vat_number: { type: String },
    fiscal_code: { type: String },
    pec_email: { type: String },
    sdi_code: { type: String },
  },
  { _id: false }
);

const AddressSchema = new Schema<IAddress>(
  {
    // Identity
    address_id: { type: String, required: true },
    external_code: { type: String },

    // Type
    address_type: {
      type: String,
      required: true,
      enum: ["delivery", "billing", "both"],
    },
    label: { type: String },
    is_default: { type: Boolean, default: false },

    // Address fields
    recipient_name: { type: String, required: true },
    street_address: { type: String, required: true },
    street_address_2: { type: String },
    city: { type: String, required: true },
    province: { type: String, required: true },
    postal_code: { type: String, required: true },
    country: { type: String, required: true, default: "IT" },

    // Contact
    phone: { type: String },
    delivery_notes: { type: String },

    // Timestamps
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const CustomerSchema = new Schema<ICustomer>(
  {
    // Identity
    customer_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    external_code: { type: String },
    public_code: { type: String },
    tenant_id: { type: String, required: true, index: true },

    // Type
    customer_type: {
      type: String,
      required: true,
      enum: ["business", "private", "reseller"],
    },
    is_guest: { type: Boolean, default: false },

    // Contact
    email: { type: String, required: true },
    phone: { type: String },
    first_name: { type: String },
    last_name: { type: String },
    company_name: { type: String },

    // Legal info
    legal_info: { type: LegalInfoSchema },

    // Addresses
    addresses: { type: [AddressSchema], default: [] },
    default_shipping_address_id: { type: String },
    default_billing_address_id: { type: String },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// ============================================
// INDEXES
// ============================================

// Email lookup (not unique - multiple customers can share email)
CustomerSchema.index({ tenant_id: 1, email: 1 });

// ERP lookup
CustomerSchema.index(
  { tenant_id: 1, external_code: 1 },
  {
    unique: true,
    partialFilterExpression: { external_code: { $exists: true, $ne: null } },
  }
);

// Public code lookup (for administrative purposes)
CustomerSchema.index(
  { tenant_id: 1, public_code: 1 },
  {
    unique: true,
    partialFilterExpression: { public_code: { $exists: true, $ne: null } },
  }
);

// Filter by type
CustomerSchema.index({ tenant_id: 1, customer_type: 1 });

// VAT lookup
CustomerSchema.index(
  { "legal_info.vat_number": 1 },
  {
    partialFilterExpression: {
      "legal_info.vat_number": { $exists: true, $ne: null },
    },
  }
);

// Address external code lookup
CustomerSchema.index(
  { "addresses.external_code": 1 },
  {
    partialFilterExpression: {
      "addresses.external_code": { $exists: true, $ne: null },
    },
  }
);

// ============================================
// EXPORT
// ============================================

export { CustomerSchema };

export const CustomerModel =
  mongoose.models.Customer ||
  mongoose.model<ICustomer>("Customer", CustomerSchema);

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validate Italian VAT number (P.IVA)
 * Format: IT + 11 digits
 */
export function validateVatNumber(vat: string): boolean {
  if (!vat) return true; // Optional field
  return /^IT\d{11}$/.test(vat);
}

/**
 * Validate Italian Fiscal Code
 * Format: 16 alphanumeric chars for individuals OR 11 digits for companies
 */
export function validateFiscalCode(fc: string): boolean {
  if (!fc) return true; // Optional field
  // Individual format: 6 letters + 2 digits + 1 letter + 2 digits + 1 letter + 3 digits + 1 letter
  const individualPattern = /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i;
  // Company format: 11 digits (same as VAT without IT prefix)
  const companyPattern = /^\d{11}$/;
  return individualPattern.test(fc) || companyPattern.test(fc);
}

/**
 * Validate SDI code
 * Format: 7 alphanumeric characters
 */
export function validateSdiCode(sdi: string): boolean {
  if (!sdi) return true; // Optional field
  return /^[A-Z0-9]{7}$/i.test(sdi);
}

/**
 * Validate all legal info fields
 */
export function validateLegalInfo(
  legalInfo: ILegalInfo
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (legalInfo.vat_number && !validateVatNumber(legalInfo.vat_number)) {
    errors.push("Invalid VAT number format (expected: IT + 11 digits)");
  }

  if (legalInfo.fiscal_code && !validateFiscalCode(legalInfo.fiscal_code)) {
    errors.push(
      "Invalid fiscal code format (expected: 16 chars for individuals or 11 digits for companies)"
    );
  }

  if (legalInfo.sdi_code && !validateSdiCode(legalInfo.sdi_code)) {
    errors.push("Invalid SDI code format (expected: 7 alphanumeric characters)");
  }

  if (legalInfo.pec_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(legalInfo.pec_email)) {
    errors.push("Invalid PEC email format");
  }

  return { valid: errors.length === 0, errors };
}
