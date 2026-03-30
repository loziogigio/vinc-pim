/**
 * Order Note Auto-Submission Service
 *
 * When a B2C order is submitted, this service:
 * 1. Finds the storefront linked to the order's channel
 * 2. Looks up the order_note form definition
 * 3. Creates a FormSubmission with order data
 * 4. Sends notification emails to configured recipients
 * 5. Optionally sends a copy to the customer
 */

import { connectWithModels } from "@/lib/db/connection";
import { sendEmail } from "@/lib/email";
import { getHomeSettings } from "@/lib/db/home-settings";
import { renderOrderNoteEmail } from "@/lib/email/templates/b2c-order-note";
import type { EmailBranding } from "@/lib/email/templates/base";
import type { IOrder, IAddressSnapshot, ILineItem } from "@/lib/db/models/order";
import type { OrderNoteEmailData, OrderNoteItem } from "@/lib/email/templates/b2c-order-note";

const logPrefix = "[order-note]";

/**
 * Format an address snapshot into a multi-line string
 */
function formatAddress(addr: IAddressSnapshot): string {
  const lines = [addr.recipient_name, addr.street_address];
  if (addr.street_address_2) lines.push(addr.street_address_2);
  lines.push(`${addr.postal_code} ${addr.city} (${addr.province})`);
  lines.push(addr.country);
  if (addr.phone) lines.push(addr.phone);
  return lines.join("\n");
}

/**
 * Build the order note data object from an order document
 */
function buildOrderNoteData(order: IOrder, storefrontName: string): OrderNoteEmailData {
  const buyer = order.buyer!;
  const buyerName = buyer.company_name
    ? `${buyer.company_name} (${buyer.first_name} ${buyer.last_name})`
    : `${buyer.first_name} ${buyer.last_name}`;

  const items: OrderNoteItem[] = order.items.map((item: ILineItem) => ({
    name: item.name,
    sku: item.sku,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: item.line_total,
  }));

  return {
    order_number: order.order_number
      ? `OR/${order.order_number}/${order.year}`
      : order.order_id,
    buyer_name: buyerName,
    buyer_email: buyer.email,
    buyer_phone: buyer.phone,
    buyer_type: buyer.customer_type,
    shipping_address: order.shipping_snapshot
      ? formatAddress(order.shipping_snapshot)
      : undefined,
    billing_address: order.billing_snapshot
      ? formatAddress(order.billing_snapshot)
      : undefined,
    payment_method: order.payment?.payment_method,
    shipping_method: order.shipping_method,
    shipping_cost: order.shipping_cost || undefined,
    items,
    subtotal: order.subtotal_net,
    total_vat: order.total_vat,
    order_total: order.order_total,
    notes: order.notes,
    coupon_code: order.coupon_code,
  };
}

/**
 * Create an order note form submission and send notification emails.
 * Called fire-and-forget after a B2C order is submitted.
 */
export async function createOrderNoteSubmission(
  tenantDb: string,
  order: IOrder
): Promise<void> {
  try {
    // 1. Find storefront by channel
    const channelCode = order.channel_ref || order.channel;
    if (!channelCode) {
      console.warn(`${logPrefix} Order ${order.order_id} has no channel — skipping`);
      return;
    }

    const { B2CStorefront, FormDefinition, FormSubmission } =
      await connectWithModels(tenantDb);

    const storefront = await B2CStorefront.findOne({
      $or: [{ slug: channelCode }, { channel: channelCode }],
      status: "active",
    }).lean();

    if (!storefront) {
      console.warn(
        `${logPrefix} No active storefront for channel "${channelCode}" — skipping`
      );
      return;
    }

    const storefrontSlug = (storefront as any).slug as string;
    const storefrontName = (storefront as any).name as string;

    // 2. Find order_note form definition
    const formDef = await FormDefinition.findOne({
      storefront_slug: storefrontSlug,
      slug: "order_note",
      enabled: true,
    }).lean();

    if (!formDef) {
      console.warn(
        `${logPrefix} No enabled order_note definition for storefront "${storefrontSlug}" — skipping`
      );
      return;
    }

    const def = formDef as any;

    // 3. Build submission data
    const noteData = buildOrderNoteData(order, storefrontName);

    // 4. Create form submission
    await FormSubmission.create({
      storefront_slug: storefrontSlug,
      form_type: "standalone",
      form_definition_slug: "order_note",
      order_id: order.order_id,
      data: noteData,
      submitter_email: order.buyer?.email,
      seen: false,
    });

    console.log(
      `${logPrefix} Created order_note submission for order ${order.order_id}`
    );

    // 5. Send notification emails
    // Check both notification_emails array and legacy config.notification_email
    const recipients: string[] = [
      ...(def.notification_emails || []),
      ...(def.config?.notification_email ? [def.config.notification_email] : []),
    ].filter((e: string) => e.trim())
      .filter((e: string, i: number, arr: string[]) => arr.indexOf(e) === i);
    const sendSubmitterCopy = def.send_submitter_copy && order.buyer?.email;

    if (recipients.length === 0 && !sendSubmitterCopy) {
      return; // No one to notify
    }

    // Resolve branding for email template
    const settings = await getHomeSettings(tenantDb);
    const branding: EmailBranding = {
      companyName: settings?.branding?.title || storefrontName,
      logo: settings?.branding?.logo,
      primaryColor: settings?.branding?.primaryColor || "#009f7f",
      secondaryColor: settings?.branding?.secondaryColor || "#02b290",
      companyInfo: settings?.company_info,
    };

    const html = renderOrderNoteEmail({
      branding,
      data: noteData,
      storefrontName,
    });

    const subject = `New Order #${noteData.order_number} — ${storefrontName}`;

    // Send to configured recipients
    if (recipients.length > 0) {
      sendEmail({
        to: recipients,
        subject,
        html,
        replyTo: order.buyer?.email,
        immediate: false,
        tenantDb,
        tags: ["order_note"],
      }).catch((err) => {
        console.error(`${logPrefix} Failed to send notification to recipients:`, err);
      });
    }

    // Send submitter copy
    if (sendSubmitterCopy) {
      sendEmail({
        to: order.buyer!.email,
        subject,
        html,
        immediate: false,
        tenantDb,
        tags: ["order_note", "submitter_copy"],
      }).catch((err) => {
        console.error(`${logPrefix} Failed to send submitter copy:`, err);
      });
    }
  } catch (error) {
    // Non-critical — log but don't throw
    console.error(
      `${logPrefix} Failed to create order note for order ${order.order_id}:`,
      error
    );
  }
}
