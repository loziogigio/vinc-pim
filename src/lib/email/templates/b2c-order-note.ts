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

export function renderOrderNoteEmail(options: OrderNoteEmailOptions): string {
  const { branding, data, storefrontName } = options;

  const content = `
    <h2 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 600; color: #1e293b;">
      New Order — #${data.order_number}
    </h2>
    <p style="margin: 0 0 24px 0; font-size: 15px; color: #64748b;">
      from <strong>${storefrontName}</strong>
    </p>

    <!-- Customer Notes -->
    ${data.notes ? `
    <div style="margin-top: 8px; padding: 16px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px;">
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
