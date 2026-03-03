/**
 * Order Snapshot Service
 *
 * Captures immutable snapshots of customer data onto orders.
 * Called during order submission (draft → pending) and confirmation
 * to freeze address, buyer identity, and fiscal data at order time.
 */

import mongoose from "mongoose";
import { getModelRegistry } from "@/lib/db/model-registry";
import type {
  IOrder,
  IAddressSnapshot,
  IBuyerSnapshot,
  IInvoiceData,
} from "@/lib/db/models/order";
import type { ICustomer, IAddress } from "@/lib/db/models/customer";

/**
 * Convert a customer address to an immutable address snapshot.
 */
export function addressToSnapshot(address: IAddress): IAddressSnapshot {
  return {
    recipient_name: address.recipient_name,
    street_address: address.street_address,
    street_address_2: address.street_address_2 || undefined,
    city: address.city,
    province: address.province,
    postal_code: address.postal_code,
    country: address.country,
    phone: address.phone || undefined,
  };
}

/**
 * Create a buyer snapshot from a customer document.
 */
export function customerToBuyerSnapshot(
  customer: ICustomer
): IBuyerSnapshot {
  return {
    email: customer.email,
    first_name: customer.first_name || "",
    last_name: customer.last_name || "",
    phone: customer.phone || undefined,
    customer_type: customer.customer_type as IBuyerSnapshot["customer_type"],
    company_name: customer.company_name || undefined,
    is_guest: customer.is_guest,
  };
}

/**
 * Create an invoice/fiscal data snapshot from a customer's legal_info.
 * Returns undefined if no fiscal data is available.
 */
export function customerToInvoiceData(
  customer: ICustomer
): IInvoiceData | undefined {
  const legal = customer.legal_info;
  if (!legal) return undefined;

  const hasData =
    legal.vat_number || legal.fiscal_code || legal.pec_email || legal.sdi_code;
  if (!hasData) return undefined;

  return {
    company_name: customer.company_name || undefined,
    fiscal_code: legal.fiscal_code || undefined,
    vat_number: legal.vat_number || undefined,
    pec_email: legal.pec_email || undefined,
    sdi_code: legal.sdi_code || undefined,
  };
}

/**
 * Populate snapshots on an order from the customer record.
 * Only fills in fields that are not already populated (idempotent).
 * Skips if no customer_id (guest orders should already have snapshots).
 *
 * @returns true if any snapshot field was updated
 */
export async function populateOrderSnapshots(
  tenantDb: mongoose.Connection,
  order: IOrder
): Promise<boolean> {
  if (!order.customer_id) return false;

  const registry = getModelRegistry(tenantDb);
  const Customer = registry.Customer;

  const customer = await Customer.findOne({
    customer_id: order.customer_id,
  }).lean<ICustomer>();
  if (!customer) return false;

  let updated = false;

  // Buyer snapshot (identity + type)
  if (!order.buyer) {
    order.buyer = customerToBuyerSnapshot(customer);
    updated = true;
  }

  // Invoice/fiscal data
  if (!order.invoice_data) {
    const invoiceData = customerToInvoiceData(customer);
    if (invoiceData) {
      order.invoice_data = invoiceData;
      updated = true;
    }
  }

  // Shipping address snapshot
  if (!order.shipping_snapshot && order.shipping_address_id) {
    const addr = customer.addresses?.find(
      (a) => a.address_id === order.shipping_address_id
    );
    if (addr) {
      order.shipping_snapshot = addressToSnapshot(addr);
      updated = true;
    }
  }

  // Billing address snapshot
  if (!order.billing_snapshot) {
    const billingId =
      order.billing_address_id || customer.default_billing_address_id;
    if (billingId) {
      const addr = customer.addresses?.find(
        (a) => a.address_id === billingId
      );
      if (addr) {
        order.billing_snapshot = addressToSnapshot(addr);
        updated = true;
      }
    }
  }

  return updated;
}
