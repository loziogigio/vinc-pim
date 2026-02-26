/**
 * Customer Profile Types
 *
 * Supports B2B customers with:
 * - Customer types: business, private, reseller
 * - Embedded addresses (delivery/billing)
 * - Italian e-invoicing legal info (VAT, Fiscal Code, PEC, SDI)
 * - Guest vs registered customers
 */

// Customer type enum
export type CustomerType = "business" | "private" | "reseller";

// Address type enum
export type AddressType = "delivery" | "billing" | "both";

/**
 * Italian e-invoicing legal information
 */
export interface LegalInfo {
  /** P.IVA (VAT number) - format: IT + 11 digits */
  vat_number?: string;
  /** Codice Fiscale - 16 chars for individuals, 11 digits for companies */
  fiscal_code?: string;
  /** PEC certified email address */
  pec_email?: string;
  /** SDI code for electronic invoicing - 7 alphanumeric chars */
  sdi_code?: string;
}

/**
 * Customer address (embedded in Customer)
 */
export interface Address {
  /** Internal ID - always generated (nanoid 8) */
  address_id: string;
  /** Optional ERP code for external system lookup */
  external_code?: string;

  // Type
  /** Address purpose: delivery, billing, or both */
  address_type: AddressType;
  /** Friendly name (e.g., "Main Office", "Warehouse") */
  label?: string;
  /** Is this the default address for its type */
  is_default: boolean;

  // Address fields
  /** Recipient or company name */
  recipient_name: string;
  /** Street address with number */
  street_address: string;
  /** Additional address line */
  street_address_2?: string;
  /** City */
  city: string;
  /** Province code (2 chars, e.g., "MI") */
  province: string;
  /** Postal code (CAP) */
  postal_code: string;
  /** Country code (ISO 3166-1 alpha-2, e.g., "IT") */
  country: string;

  // Contact
  /** Delivery phone number */
  phone?: string;
  /** Delivery instructions */
  delivery_notes?: string;

  // Timestamps
  created_at: Date;
  updated_at: Date;
}

/**
 * Customer profile
 */
export interface Customer {
  /** Unique customer ID (nanoid 12) */
  customer_id: string;
  /** Optional ERP customer code (internal of ERP) */
  external_code?: string;
  /** Public customer code for administrative purposes (invoices, documents) */
  public_code?: string;
  /** Tenant identifier */
  tenant_id: string;

  // Type
  /** Customer type: business, private, or reseller */
  customer_type: CustomerType;
  /** Guest (one-time) or registered customer */
  is_guest: boolean;

  // Contact
  /** Primary email address */
  email: string;
  /** Phone number */
  phone?: string;
  /** First name (for private customers) */
  first_name?: string;
  /** Last name (for private customers) */
  last_name?: string;
  /** Company name (for business/reseller) */
  company_name?: string;

  // Legal info
  /** Italian e-invoicing data */
  legal_info?: LegalInfo;

  // Addresses
  /** Embedded delivery/billing addresses */
  addresses: Address[];
  /** Default shipping address ID */
  default_shipping_address_id?: string;
  /** Default billing address ID */
  default_billing_address_id?: string;

  /** Sales channel this customer belongs to (e.g. "default", "b2c", "slovakia") */
  channel?: string;

  // Timestamps
  created_at: Date;
  updated_at: Date;
}

/**
 * Request to create a new customer
 */
export interface CreateCustomerRequest {
  /** Customer type (required) */
  customer_type: CustomerType;
  /** Primary email (required) */
  email: string;
  /** Guest or registered */
  is_guest?: boolean;
  /** Optional ERP code (internal of ERP) */
  external_code?: string;
  /** Public customer code for administrative purposes */
  public_code?: string;

  // Contact
  phone?: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;

  // Legal info
  legal_info?: LegalInfo;

  // Initial addresses
  addresses?: Omit<Address, "address_id" | "created_at" | "updated_at">[];

  /** Sales channel */
  channel?: string;
}

/**
 * Request to update a customer
 */
export interface UpdateCustomerRequest {
  customer_type?: CustomerType;
  email?: string;
  is_guest?: boolean;
  external_code?: string;
  public_code?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  legal_info?: LegalInfo;
  default_shipping_address_id?: string;
  default_billing_address_id?: string;
  channel?: string;
}

/**
 * Request to add an address to a customer
 */
export interface AddAddressRequest {
  external_code?: string;
  address_type: AddressType;
  label?: string;
  is_default?: boolean;
  recipient_name: string;
  street_address: string;
  street_address_2?: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  phone?: string;
  delivery_notes?: string;
}

/**
 * Request to update an address
 */
export interface UpdateAddressRequest {
  external_code?: string;
  address_type?: AddressType;
  label?: string;
  is_default?: boolean;
  recipient_name?: string;
  street_address?: string;
  street_address_2?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  phone?: string;
  delivery_notes?: string;
}
