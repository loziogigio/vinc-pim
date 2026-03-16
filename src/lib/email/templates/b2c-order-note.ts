/**
 * B2C Order Note Email Template
 * Sent to configured recipients when a B2C order is placed
 */

import { renderBaseTemplate, type EmailBranding } from "./base";

export interface OrderNoteItem {
  name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface OrderNoteEmailData {
  order_number: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone?: string;
  buyer_type: string;
  shipping_address?: string;
  billing_address?: string;
  payment_method?: string;
  shipping_method?: string;
  shipping_cost?: number;
  items: OrderNoteItem[];
  subtotal: number;
  total_vat: number;
  order_total: number;
  notes?: string;
  coupon_code?: string;
}

export interface OrderNoteEmailOptions {
  branding: EmailBranding;
  data: OrderNoteEmailData;
  storefrontName: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(amount);
}

export function renderOrderNoteEmail(options: OrderNoteEmailOptions): string {
  const { branding, data, storefrontName } = options;
  const pc = branding.primaryColor;

  const itemRows = data.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #334155;">
        ${item.name}<br/>
        <span style="font-size: 12px; color: #94a3b8;">SKU: ${item.sku}</span>
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #334155; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #334155; text-align: right;">${formatCurrency(item.unit_price)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #334155; text-align: right;">${formatCurrency(item.line_total)}</td>
    </tr>`
    )
    .join("");

  const content = `
    <h2 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 600; color: #1e293b;">
      New Order — #${data.order_number}
    </h2>
    <p style="margin: 0 0 24px 0; font-size: 15px; color: #64748b;">
      from <strong>${storefrontName}</strong>
    </p>

    <!-- Buyer Info -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <tr>
        <td style="padding: 16px;">
          <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 600; color: ${pc}; text-transform: uppercase; letter-spacing: 0.5px;">Buyer</p>
          <p style="margin: 0; font-size: 15px; color: #334155; font-weight: 600;">${data.buyer_name}</p>
          <p style="margin: 4px 0 0 0; font-size: 14px; color: #64748b;">
            <a href="mailto:${data.buyer_email}" style="color: ${pc};">${data.buyer_email}</a>
            ${data.buyer_phone ? ` &middot; ${data.buyer_phone}` : ""}
          </p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">${data.buyer_type}</p>
        </td>
      </tr>
    </table>

    <!-- Addresses -->
    ${data.shipping_address ? `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
      <tr>
        <td style="padding: 12px 16px; background: #f8fafc; border-radius: 8px; width: 50%; vertical-align: top;">
          <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase;">Shipping</p>
          <p style="margin: 0; font-size: 14px; color: #334155; white-space: pre-line;">${data.shipping_address}</p>
        </td>
        ${data.billing_address ? `
        <td style="width: 12px;"></td>
        <td style="padding: 12px 16px; background: #f8fafc; border-radius: 8px; width: 50%; vertical-align: top;">
          <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase;">Billing</p>
          <p style="margin: 0; font-size: 14px; color: #334155; white-space: pre-line;">${data.billing_address}</p>
        </td>` : ""}
      </tr>
    </table>` : ""}

    <!-- Items -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background: #f8fafc;">
          <th style="padding: 10px 12px; font-size: 12px; font-weight: 600; color: #64748b; text-align: left; text-transform: uppercase;">Item</th>
          <th style="padding: 10px 12px; font-size: 12px; font-weight: 600; color: #64748b; text-align: center; text-transform: uppercase;">Qty</th>
          <th style="padding: 10px 12px; font-size: 12px; font-weight: 600; color: #64748b; text-align: right; text-transform: uppercase;">Price</th>
          <th style="padding: 10px 12px; font-size: 12px; font-weight: 600; color: #64748b; text-align: right; text-transform: uppercase;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <!-- Totals -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
      <tr>
        <td style="padding: 6px 0; font-size: 14px; color: #64748b;">Subtotal</td>
        <td style="padding: 6px 0; font-size: 14px; color: #334155; text-align: right;">${formatCurrency(data.subtotal)}</td>
      </tr>
      ${data.shipping_cost != null ? `
      <tr>
        <td style="padding: 6px 0; font-size: 14px; color: #64748b;">Shipping${data.shipping_method ? ` (${data.shipping_method})` : ""}</td>
        <td style="padding: 6px 0; font-size: 14px; color: #334155; text-align: right;">${formatCurrency(data.shipping_cost)}</td>
      </tr>` : ""}
      ${data.coupon_code ? `
      <tr>
        <td style="padding: 6px 0; font-size: 14px; color: #64748b;">Coupon: ${data.coupon_code}</td>
        <td style="padding: 6px 0; font-size: 14px; color: #16a34a; text-align: right;">Applied</td>
      </tr>` : ""}
      <tr>
        <td style="padding: 6px 0; font-size: 14px; color: #64748b;">VAT</td>
        <td style="padding: 6px 0; font-size: 14px; color: #334155; text-align: right;">${formatCurrency(data.total_vat)}</td>
      </tr>
      <tr>
        <td style="padding: 12px 0 0 0; font-size: 18px; font-weight: 700; color: #1e293b; border-top: 2px solid #e2e8f0;">Total</td>
        <td style="padding: 12px 0 0 0; font-size: 18px; font-weight: 700; color: ${pc}; text-align: right; border-top: 2px solid #e2e8f0;">${formatCurrency(data.order_total)}</td>
      </tr>
    </table>

    <!-- Payment -->
    ${data.payment_method ? `
    <p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b;">
      Payment: <strong style="color: #334155;">${data.payment_method.replace(/_/g, " ")}</strong>
    </p>` : ""}

    <!-- Notes -->
    ${data.notes ? `
    <div style="margin-top: 16px; padding: 16px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px;">
      <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #92400e; text-transform: uppercase;">Customer Notes</p>
      <p style="margin: 0; font-size: 14px; color: #78350f; white-space: pre-line;">${data.notes}</p>
    </div>` : ""}
  `;

  return renderBaseTemplate({
    branding,
    preheader: `New order #${data.order_number} from ${storefrontName}`,
    content,
    footerText: "Order Note Notification",
  });
}
