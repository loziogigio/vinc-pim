import { nanoid } from "nanoid";
import type { ICustomer, IAddress, ILegalInfo } from "@/lib/db/models/customer";
import { connectWithModels } from "@/lib/db/connection";
import { getNextCustomerPublicCode } from "@/lib/db/models/counter";
import {
  upsertCustomerTagsBatch,
  upsertAddressTagOverridesBatch,
} from "@/lib/services/tag-pricing.service";

/**
 * Customer Service
 *
 * Provides lookup-or-create functionality for customers and addresses.
 * Used during order creation to automatically find or create customers.
 */

// ============================================
// TYPES
// ============================================

export interface CustomerInput {
  external_code?: string;
  public_code?: string;
  email?: string;
  customer_type?: "business" | "private" | "reseller";
  is_guest?: boolean;
  phone?: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  legal_info?: ILegalInfo;
  addresses?: AddressInput[];
  /** Full tag strings to upsert (e.g., ["categoria-di-sconto:sconto-45"]) */
  tags?: string[];
}

export interface AddressInput {
  external_code?: string;
  address_type?: "delivery" | "billing" | "both";
  label?: string;
  is_default?: boolean;
  recipient_name: string;
  street_address: string;
  street_address_2?: string;
  city: string;
  province: string;
  postal_code: string;
  country?: string;
  phone?: string;
  delivery_notes?: string;
  /** Full tag strings for address-level overrides (e.g., ["categoria-di-sconto:sconto-50"]) */
  tag_overrides?: string[];
}

export interface FindOrCreateCustomerInput {
  customer_id?: string;
  customer_code?: string; // external_code
  customer?: CustomerInput;
}

export interface FindOrCreateCustomerResult {
  customer: ICustomer;
  isNew: boolean;
}

export interface FindOrCreateAddressInput {
  address_id?: string;
  address?: AddressInput;
}

// ============================================
// CUSTOMER LOOKUP/CREATE
// ============================================

/**
 * Find or create a customer based on lookup strategies.
 *
 * Lookup priority:
 * 1. customer_id (internal ID)
 * 2. customer_code / external_code (ERP code)
 * 3. public_code (administrative code)
 * 4. Create new customer
 *
 * @param tenant_id - Tenant identifier
 * @param input - Lookup parameters
 * @returns Found or created customer
 */
export async function findOrCreateCustomer(
  tenant_id: string,
  input: FindOrCreateCustomerInput
): Promise<FindOrCreateCustomerResult> {
  // Get tenant-specific Customer model from connection pool
  const tenantDb = `vinc-${tenant_id}`;
  const { Customer: CustomerModel } = await connectWithModels(tenantDb);

  // Helper: upsert tags on found customer if provided
  async function applyTags(customer: ICustomer): Promise<ICustomer> {
    if (input.customer?.tags && input.customer.tags.length > 0) {
      await upsertCustomerTagsBatch(
        tenantDb, tenant_id, customer.customer_id, input.customer.tags,
      );
      // Re-fetch to get updated tags
      const updated = await CustomerModel.findOne({
        tenant_id, customer_id: customer.customer_id,
      });
      if (updated) return updated as ICustomer;
    }
    return customer;
  }

  // 1. Try lookup by customer_id (internal)
  if (input.customer_id) {
    const customer = await CustomerModel.findOne({
      tenant_id,
      customer_id: input.customer_id,
    });
    if (customer) {
      return { customer: await applyTags(customer as ICustomer), isNew: false };
    }
  }

  // 2. Try lookup by external_code (from customer_code parameter)
  if (input.customer_code) {
    const customer = await CustomerModel.findOne({
      tenant_id,
      external_code: input.customer_code,
    });
    if (customer) {
      return { customer: await applyTags(customer as ICustomer), isNew: false };
    }
  }

  // 3. If customer object provided, try additional lookups
  if (input.customer) {
    // 3a. Try by external_code in customer object
    if (input.customer.external_code) {
      const customer = await CustomerModel.findOne({
        tenant_id,
        external_code: input.customer.external_code,
      });
      if (customer) {
        return { customer: await applyTags(customer as ICustomer), isNew: false };
      }
    }

    // 3b. Try by public_code in customer object
    if (input.customer.public_code) {
      const customer = await CustomerModel.findOne({
        tenant_id,
        public_code: input.customer.public_code,
      });
      if (customer) {
        return { customer: await applyTags(customer as ICustomer), isNew: false };
      }
    }

    // 3c. Try by VAT number for business customers
    if (input.customer.legal_info?.vat_number) {
      const customer = await CustomerModel.findOne({
        tenant_id,
        "legal_info.vat_number": input.customer.legal_info.vat_number,
      });
      if (customer) {
        return { customer: await applyTags(customer as ICustomer), isNew: false };
      }
    }

    // 3d. Create new customer
    const addresses: IAddress[] = [];
    if (input.customer.addresses && input.customer.addresses.length > 0) {
      for (const addr of input.customer.addresses) {
        addresses.push({
          address_id: nanoid(8),
          address_type: addr.address_type || "both",
          is_default: addr.is_default ?? addresses.length === 0, // First address is default
          recipient_name: addr.recipient_name,
          street_address: addr.street_address,
          street_address_2: addr.street_address_2,
          city: addr.city,
          province: addr.province,
          postal_code: addr.postal_code,
          country: addr.country || "IT",
          phone: addr.phone,
          delivery_notes: addr.delivery_notes,
          external_code: addr.external_code,
          label: addr.label,
          tag_overrides: [],
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
    }

    // Auto-generate public_code if not provided
    const public_code = input.customer.public_code || await getNextCustomerPublicCode(tenantDb);

    const newCustomer = await CustomerModel.create({
      customer_id: nanoid(12),
      tenant_id,
      external_code: input.customer.external_code,
      public_code,
      customer_type: input.customer.customer_type || "business",
      is_guest: input.customer.is_guest ?? false,
      email: input.customer.email,
      phone: input.customer.phone,
      first_name: input.customer.first_name,
      last_name: input.customer.last_name,
      company_name: input.customer.company_name,
      legal_info: input.customer.legal_info,
      addresses,
      default_shipping_address_id: addresses[0]?.address_id,
      default_billing_address_id: addresses[0]?.address_id,
    });

    // Apply customer-level tags if provided
    const finalCustomer = await applyTags(newCustomer as ICustomer);

    // Apply address-level tag overrides if provided
    if (input.customer.addresses) {
      for (let i = 0; i < input.customer.addresses.length; i++) {
        const addrInput = input.customer.addresses[i];
        if (addrInput.tag_overrides && addrInput.tag_overrides.length > 0 && addresses[i]) {
          await upsertAddressTagOverridesBatch(
            tenantDb, tenant_id, finalCustomer.customer_id,
            addresses[i].address_id, addrInput.tag_overrides,
          );
        }
      }
    }

    // Re-fetch if address overrides were applied
    const hasAddressOverrides = input.customer.addresses?.some(
      (a) => a.tag_overrides && a.tag_overrides.length > 0,
    );
    if (hasAddressOverrides) {
      const refreshed = await CustomerModel.findOne({
        tenant_id, customer_id: finalCustomer.customer_id,
      });
      if (refreshed) return { customer: refreshed as ICustomer, isNew: true };
    }

    return { customer: finalCustomer, isNew: true };
  }

  throw new Error("Customer not found and no data to create");
}

// ============================================
// ADDRESS LOOKUP/CREATE
// ============================================

/**
 * Find or create an address for a customer.
 *
 * Lookup priority:
 * 1. address_id (internal ID)
 * 2. external_code (ERP code)
 * 3. Create new address and add to customer
 * 4. Return default address if exists
 *
 * @param customer - Customer document
 * @param input - Lookup parameters
 * @returns Found or created address
 */
export async function findOrCreateAddress(
  customer: ICustomer,
  input: FindOrCreateAddressInput,
  tenant_id?: string,
): Promise<IAddress> {
  // 1. Try lookup by address_id (internal)
  if (input.address_id) {
    const address = customer.addresses.find(
      (a) => a.address_id === input.address_id
    );
    if (address) return address;
  }

  // 2. If address object provided
  if (input.address) {
    // 2a. Try by external_code
    if (input.address.external_code) {
      const address = customer.addresses.find(
        (a) => a.external_code === input.address!.external_code
      );
      if (address) return address;
    }

    // 2b. Create new address and add to customer
    const newAddress: IAddress = {
      address_id: nanoid(8),
      address_type: input.address.address_type || "both",
      is_default: input.address.is_default ?? customer.addresses.length === 0,
      recipient_name: input.address.recipient_name,
      street_address: input.address.street_address,
      street_address_2: input.address.street_address_2,
      city: input.address.city,
      province: input.address.province,
      postal_code: input.address.postal_code,
      country: input.address.country || "IT",
      phone: input.address.phone,
      delivery_notes: input.address.delivery_notes,
      external_code: input.address.external_code,
      label: input.address.label,
      tag_overrides: [],
      created_at: new Date(),
      updated_at: new Date(),
    };

    customer.addresses.push(newAddress);
    await customer.save();

    // Apply address-level tag overrides if provided and tenant context available
    if (tenant_id && input.address.tag_overrides && input.address.tag_overrides.length > 0) {
      const tenantDb = `vinc-${tenant_id}`;
      await upsertAddressTagOverridesBatch(
        tenantDb, tenant_id, customer.customer_id,
        newAddress.address_id, input.address.tag_overrides,
      );
    }

    return newAddress;
  }

  // 3. Return default address if exists
  const defaultAddress = customer.addresses.find((a) => a.is_default);
  if (defaultAddress) return defaultAddress;

  // 4. Return first address if exists
  if (customer.addresses.length > 0) {
    return customer.addresses[0];
  }

  throw new Error("Address not found and no data to create");
}

/**
 * Find customer by ID (internal or external)
 */
export async function findCustomerById(
  tenant_id: string,
  customer_id?: string,
  external_code?: string
): Promise<ICustomer | null> {
  // Get tenant-specific Customer model from connection pool
  const tenantDb = `vinc-${tenant_id}`;
  const { Customer: CustomerModel } = await connectWithModels(tenantDb);

  if (customer_id) {
    return CustomerModel.findOne({ tenant_id, customer_id }) as Promise<ICustomer | null>;
  }
  if (external_code) {
    return CustomerModel.findOne({ tenant_id, external_code }) as Promise<ICustomer | null>;
  }
  return null;
}
