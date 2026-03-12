/**
 * Order Notification Service
 *
 * Bridges the order lifecycle to the notification system.
 * Resolves recipient, builds template variables, and dispatches notifications
 * for order events (confirmation, shipped, delivered, cancelled, payment).
 *
 * Design: fire-and-forget from API routes — never blocks order operations.
 */

import { connectWithModels } from "@/lib/db/connection";
import { sendNotification } from "./send.service";
import { getCompanyInfo, companyInfoToRecord } from "./company-info";
import { getStorefrontPrimaryDomain } from "@/lib/services/b2c-storefront.service";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants/payment";
import type { PaymentMethod } from "@/lib/constants/payment";
import type { CompanyInfo } from "./company-info";
import type { IOrder, IAddressSnapshot, ILineItem } from "@/lib/db/models/order";
import type { NotificationTrigger } from "@/lib/constants/notification";
import type { NotificationUserType } from "@/lib/db/models/notification";
import type { OrderPayload } from "@/lib/types/notification-payload";
import type { IBankTransferProviderConfig } from "@/lib/db/models/tenant-payment-config";

// ============================================
// TYPES
// ============================================

export interface OrderNotificationExtra {
  /** Portal user ID for in-app notifications */
  portalUserId?: string;
  /** Whether recipient is portal_user or b2b_user */
  userType?: NotificationUserType;
  /** Payment amount (for payment_received trigger) */
  paymentAmount?: number;
  /** Payment method (for payment_received trigger) */
  paymentMethod?: string;
}

// ============================================
// MAIN DISPATCH
// ============================================

/**
 * Dispatch a notification for an order event.
 *
 * Resolves recipient email, builds template variables, and sends
 * via the notification system (email + push + in-app).
 */
export async function dispatchOrderNotification(
  tenantDb: string,
  trigger: NotificationTrigger,
  order: IOrder,
  extra?: OrderNotificationExtra
): Promise<void> {
  const email = await resolveRecipientEmail(tenantDb, order);
  if (!email) {
    console.warn(`[OrderNotification] No recipient email for order ${order.order_id}, skipping ${trigger}`);
    return;
  }

  const customerName = await resolveRecipientName(tenantDb, order);
  const companyInfo = await getCompanyInfo(tenantDb);
  const variables = await buildOrderVariables(tenantDb, trigger, order, companyInfo, customerName, extra);
  const payload = buildOrderPayload(order);

  await sendNotification({
    tenantDb,
    trigger,
    to: email,
    variables,
    immediate: false,
    targetUserId: extra?.portalUserId,
    targetUserType: extra?.userType || "portal_user",
    pushUserIds: extra?.portalUserId ? [extra.portalUserId] : undefined,
    payload,
  });
}

// ============================================
// RECIPIENT RESOLUTION
// ============================================

/**
 * Resolve the recipient email address from an order.
 *
 * Priority:
 * 1. B2C guest: order.buyer.email (embedded on order)
 * 2. B2B customer: lookup Customer.email by customer_id
 */
async function resolveRecipientEmail(
  tenantDb: string,
  order: IOrder
): Promise<string | null> {
  // B2C guest orders have buyer email embedded
  if (order.buyer?.email) {
    return order.buyer.email;
  }

  // B2B orders: lookup customer
  if (order.customer_id) {
    try {
      const { Customer } = await connectWithModels(tenantDb);
      const customer = await Customer.findOne({ customer_id: order.customer_id })
        .select("email")
        .lean();
      return (customer as { email?: string })?.email || null;
    } catch (error) {
      console.error(`[OrderNotification] Error looking up customer ${order.customer_id}:`, error);
    }
  }

  return null;
}

/**
 * Resolve the recipient name for template greeting.
 *
 * Priority:
 * 1. B2C guest: buyer first_name + last_name
 * 2. B2B customer: first_name + last_name, or company_name fallback
 */
async function resolveRecipientName(
  tenantDb: string,
  order: IOrder
): Promise<string> {
  // B2C guest
  if (order.buyer) {
    const parts = [order.buyer.first_name, order.buyer.last_name].filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
  }

  // B2B customer
  if (order.customer_id) {
    try {
      const { Customer } = await connectWithModels(tenantDb);
      const customer = await Customer.findOne({ customer_id: order.customer_id })
        .select("first_name last_name company_name")
        .lean() as { first_name?: string; last_name?: string; company_name?: string } | null;

      if (customer) {
        const nameParts = [customer.first_name, customer.last_name].filter(Boolean);
        if (nameParts.length > 0) return nameParts.join(" ");
        if (customer.company_name) return customer.company_name;
      }
    } catch (error) {
      console.error(`[OrderNotification] Error looking up customer name ${order.customer_id}:`, error);
    }
  }

  return "Cliente";
}

// ============================================
// TEMPLATE VARIABLES
// ============================================

/**
 * Build template variables for a specific order trigger.
 *
 * Merges order-specific variables with company info variables
 * (shop_name, primary_color, etc.) from the existing utility.
 */
async function buildOrderVariables(
  tenantDb: string,
  trigger: NotificationTrigger,
  order: IOrder,
  companyInfo: CompanyInfo,
  customerName: string,
  extra?: OrderNotificationExtra
): Promise<Record<string, string>> {
  const orderNumber = order.order_number
    ? `OR/${order.order_number}/${order.year || new Date().getFullYear()}`
    : order.order_id.slice(0, 8);

  // Base variables shared across all order triggers
  const base: Record<string, string> = {
    ...companyInfoToRecord(companyInfo),
    customer_name: customerName,
    order_number: orderNumber,
  };

  // Resolve frontend URL: channel storefront primary domain → fallback to shop_url
  const frontendUrl = await getStorefrontPrimaryDomain(tenantDb, order.channel)
    || companyInfo.shop_url;

  switch (trigger) {
    case "order_confirmation": {
      const paymentMethod = order.payment?.payment_method
        || order.payment?.payments?.[0]?.method
        || "";
      const vars: Record<string, string> = {
        ...base,
        order_date: formatDate(order.submitted_at || order.confirmed_at || new Date()),
        order_total: formatCurrency(order.order_total, order.currency),
        shipping_address: formatAddress(order.shipping_snapshot),
        billing_address: formatAddress(order.billing_snapshot),
        order_items_html: buildItemsTableHtml(order.items || [], order.currency),
        items_count: String((order.items || []).length),
        subtotal_net: formatCurrency(order.subtotal_net, order.currency),
        total_discount: (() => {
          if (!order.total_discount) return "";
          // When a coupon is present, subtract coupon discount to avoid double-counting
          const cpn = order.cart_discounts?.find((d) => d.reason === "coupon");
          const nonCouponDiscount = cpn
            ? order.total_discount - Math.abs(cpn.value)
            : order.total_discount;
          return nonCouponDiscount > 0 ? formatCurrency(nonCouponDiscount, order.currency) : "";
        })(),
        total_vat: formatCurrency(order.total_vat, order.currency),
        shipping_cost: order.shipping_cost ? formatCurrency(order.shipping_cost, order.currency) : "",
        payment_method: formatPaymentMethod(paymentMethod),
        payment_terms: order.payment?.payment_terms || "",
        coupon_code: order.coupon_code || "",
        coupon_discount: (() => {
          const cpn = order.cart_discounts?.find((d) => d.reason === "coupon");
          return cpn ? formatCurrency(Math.abs(cpn.value), order.currency) : "";
        })(),
        order_url: buildOrderUrl(frontendUrl, order.order_id),
        // Invoice / business fields
        invoice_company_name: order.invoice_data?.company_name || order.buyer?.company_name || "",
        invoice_vat_number: order.invoice_data?.vat_number || "",
        invoice_fiscal_code: order.invoice_data?.fiscal_code || "",
        invoice_pec: order.invoice_data?.pec_email || "",
        invoice_sdi: order.invoice_data?.sdi_code || "",
        // Bank transfer fields — empty by default, populated below if applicable
        bank_beneficiary: "",
        bank_iban: "",
        bank_bic_swift: "",
        bank_name: "",
        bank_causale: `Ordine ${orderNumber}`,
      };

      // Fetch bank transfer info only when payment is bank_transfer
      if (paymentMethod === "bank_transfer") {
        const bankInfo = await getBankTransferInfo(tenantDb);
        if (bankInfo) {
          vars.bank_beneficiary = bankInfo.beneficiary_name;
          vars.bank_iban = bankInfo.iban;
          vars.bank_bic_swift = bankInfo.bic_swift || "";
          vars.bank_name = bankInfo.bank_name || "";
        }
      }

      return vars;
    }

    case "order_shipped":
      return {
        ...base,
        tracking_number: order.delivery?.tracking_number || "N/A",
        carrier_name: order.delivery?.carrier || "N/A",
        tracking_url: order.delivery?.tracking_url || "",
        estimated_delivery: order.delivery?.estimated_delivery
          ? formatDate(order.delivery.estimated_delivery)
          : "Da confermare",
      };

    case "order_delivered":
      return {
        ...base,
        delivery_date: formatDate(order.delivered_at || new Date()),
        review_url: frontendUrl || "",
      };

    case "order_cancelled":
      return {
        ...base,
        cancel_reason: order.cancellation_reason || "Non specificato",
        refund_info: buildRefundInfo(order),
        support_email: companyInfo.email || "",
      };

    case "payment_received":
      return {
        ...base,
        payment_amount: extra?.paymentAmount
          ? formatCurrency(extra.paymentAmount, order.currency)
          : formatCurrency(order.order_total, order.currency),
        payment_method: extra?.paymentMethod || order.payment?.payment_method || "N/A",
        payment_date: formatDate(new Date()),
        order_total: formatCurrency(order.order_total, order.currency),
        amount_remaining: formatCurrency(
          order.payment?.amount_remaining ?? 0,
          order.currency
        ),
      };

    default:
      return base;
  }
}

// ============================================
// IN-APP / MOBILE PAYLOAD
// ============================================

/**
 * Build an OrderPayload for in-app and mobile notifications.
 */
function buildOrderPayload(order: IOrder): OrderPayload {
  return {
    category: "order",
    order: {
      id: order.order_id,
      number: order.order_number
        ? `OR/${order.order_number}/${order.year || new Date().getFullYear()}`
        : order.order_id.slice(0, 8),
      status: order.status,
      total: formatCurrency(order.order_total, order.currency),
      carrier: order.delivery?.carrier,
      tracking_code: order.delivery?.tracking_number,
      item_ref: order.order_id,
      items: (order.items || []).slice(0, 4).map((item) => ({
        sku: item.sku || item.entity_code,
        name: item.name || item.entity_code,
        image: item.image_url,
        quantity: item.quantity,
      })),
    },
  };
}

// ============================================
// FORMATTING HELPERS
// ============================================

function formatCurrency(amount: number | undefined, currency?: string): string {
  if (amount === undefined || amount === null) return "€0,00";
  const cur = currency || "EUR";
  try {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: cur,
    }).format(amount);
  } catch {
    return `€${amount.toFixed(2)}`;
  }
}

function formatDate(date: Date | string | undefined): string {
  if (!date) return "N/A";
  const d = date instanceof Date ? date : new Date(date);
  try {
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  } catch {
    return d.toISOString().split("T")[0];
  }
}

function formatAddress(snapshot: IAddressSnapshot | undefined): string {
  if (!snapshot) return "";
  const parts = [
    snapshot.street_address,
    snapshot.street_address_2,
    `${snapshot.postal_code} ${snapshot.city}`,
    snapshot.province ? `(${snapshot.province})` : "",
    snapshot.country,
  ].filter(Boolean);
  return parts.join(", ");
}

function buildOrderUrl(shopUrl: string, orderId: string): string {
  if (!shopUrl) return "";
  const base = shopUrl.endsWith("/") ? shopUrl.slice(0, -1) : shopUrl;
  return `${base}/public/orders/${orderId}`;
}

function buildRefundInfo(order: IOrder): string {
  if (!order.payment || order.payment.amount_paid <= 0) {
    return "Nessun pagamento da rimborsare.";
  }
  const paid = formatCurrency(order.payment.amount_paid, order.currency);
  return `Importo pagato: ${paid}. Il rimborso sarà elaborato secondo le modalità di pagamento utilizzate.`;
}

// ============================================
// ORDER CONFIRMATION HELPERS
// ============================================

/**
 * Map payment method code to human-readable Italian label.
 */
function formatPaymentMethod(method: string): string {
  if (!method) return "";
  return PAYMENT_METHOD_LABELS[method as PaymentMethod] || method;
}

/**
 * Build Outlook-safe HTML table rows for order line items.
 */
function buildItemsTableHtml(items: ILineItem[], currency?: string): string {
  if (!items.length) return "";

  const rows = items.map((item) => {
    const name = item.name || item.entity_code;
    const sku = item.sku || item.entity_code;
    const qty = item.quantity;
    const unitPrice = formatCurrency(item.unit_price, currency);
    const lineTotal = formatCurrency(item.line_net, currency);

    const imgHtml = item.image_url
      ? `<img src="${escapeHtml(item.image_url)}" alt="" width="44" height="44" style="display: block; width: 44px; height: 44px; object-fit: cover; border: 1px solid #e2e8f0;" />`
      : `<div style="width: 44px; height: 44px; background-color: #f1f5f9; border: 1px solid #e2e8f0;"></div>`;

    return `<tr>
  <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0;" valign="top" width="52">${imgHtml}</td>
  <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 13px;" valign="top">
    <strong>${escapeHtml(name)}</strong><br>
    <span style="color: #94a3b8; font-size: 12px;">${escapeHtml(sku)}</span>
  </td>
  <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 13px; text-align: center;" valign="top">${qty}</td>
  <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 13px; text-align: right;" valign="top">${unitPrice}</td>
  <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-size: 13px; font-weight: 600; text-align: right;" valign="top">${lineTotal}</td>
</tr>`;
  });

  return rows.join("\n");
}

/**
 * Escape HTML entities for safe template injection.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Fetch bank transfer configuration from tenant payment config.
 * Returns null if bank transfer is not configured or not enabled.
 */
async function getBankTransferInfo(
  tenantDb: string
): Promise<IBankTransferProviderConfig | null> {
  try {
    const { TenantPaymentConfig } = await connectWithModels(tenantDb);
    const config = await TenantPaymentConfig.findOne({})
      .select("providers.bank_transfer_provider")
      .lean();

    const bt = (config as { providers?: { bank_transfer_provider?: IBankTransferProviderConfig } })
      ?.providers?.bank_transfer_provider;

    if (bt?.enabled && bt.iban && bt.beneficiary_name) {
      return bt;
    }
    return null;
  } catch (error) {
    console.error("[OrderNotification] Error fetching bank transfer config:", error);
    return null;
  }
}

// ============================================
// TEST HELPERS (used by template test API)
// ============================================

/**
 * Build template variables from a real order ID.
 *
 * Used by the "Send Test Email" feature to render templates
 * with actual order data instead of empty placeholders.
 */
export async function buildOrderTestVariables(
  tenantDb: string,
  trigger: NotificationTrigger,
  orderId: string
): Promise<Record<string, string> | null> {
  const { Order } = await connectWithModels(tenantDb);
  const order = await Order.findOne({ order_id: orderId }).lean<IOrder>();
  if (!order) return null;

  const customerName = await resolveRecipientName(tenantDb, order);
  const companyInfo = await getCompanyInfo(tenantDb);

  return buildOrderVariables(tenantDb, trigger, order, companyInfo, customerName);
}
