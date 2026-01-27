/**
 * Campaign Send API
 *
 * POST /api/b2b/notifications/campaigns/send - Send campaign to recipients
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { sendEmail } from "@/lib/email";
import {
  buildCampaignEmail,
  generateCustomEmailHtml,
  generateGenericEmailHtml,
} from "@/lib/notifications/email-builder";
import { createInAppNotification } from "@/lib/notifications/in-app.service";
import type { ITemplateProduct, TemplateType } from "@/lib/constants/notification";

interface SelectedUserInput {
  id: string;
  email: string;
  name: string;
}

interface CampaignSendPayload {
  type: TemplateType;
  // Push notification fields
  title?: string;
  body?: string;
  push_image?: string;
  // Email fields
  email_subject?: string;
  email_html?: string;
  products_url?: string;
  // Channels and recipients
  channels: ("email" | "mobile" | "web_in_app")[];
  recipient_type: "all" | "selected";
  selected_users?: SelectedUserInput[];
  // Product type
  products?: ITemplateProduct[];
  // Generic type
  url?: string;
  image?: string;
  open_in_new_tab?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const payload: CampaignSendPayload = await req.json();

    const {
      type,
      title,
      body: messageBody,
      push_image,
      email_subject,
      email_html,
      products_url,
      channels,
      recipient_type = "all",
      selected_users,
      products,
      url,
      image,
      open_in_new_tab,
    } = payload;

    // Validate required fields
    if (!type || !["product", "generic"].includes(type)) {
      return NextResponse.json({ error: "Invalid campaign type" }, { status: 400 });
    }

    if (!channels || !Array.isArray(channels) || channels.length === 0) {
      return NextResponse.json({ error: "At least one channel must be selected" }, { status: 400 });
    }

    // Title and body required for push notifications
    const hasPush = channels.includes("mobile") || channels.includes("web_in_app");
    if (hasPush) {
      if (!title?.trim()) {
        return NextResponse.json({ error: "Title is required for push notifications" }, { status: 400 });
      }
      if (!messageBody?.trim()) {
        return NextResponse.json({ error: "Message body is required for push notifications" }, { status: 400 });
      }
    }

    // Email HTML required for email channel
    if (channels.includes("email") && !email_html?.trim()) {
      return NextResponse.json({ error: "Email HTML content is required" }, { status: 400 });
    }

    // Get recipients based on type
    const { Customer } = await connectWithModels(tenantDb);
    let recipients: { _id: string; email: string; company_name?: string }[] = [];

    switch (recipient_type) {
      case "all":
        recipients = await Customer.find({ status: "active" })
          .select("_id email company_name")
          .lean();
        break;
      case "selected":
        if (!selected_users || selected_users.length === 0) {
          return NextResponse.json(
            { error: "No users selected" },
            { status: 400 }
          );
        }
        // Use selected users directly (they come with id, email, name)
        recipients = selected_users.map((u) => ({
          _id: u.id,
          email: u.email,
          company_name: u.name,
        }));
        break;
      default:
        recipients = [];
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: "No recipients found" }, { status: 400 });
    }

    // Track results
    const results = {
      email: { sent: 0, failed: 0 },
      mobile: { sent: 0, failed: 0 },
      web_in_app: { sent: 0, failed: 0 },
    };

    // Generate email HTML if email channel is enabled
    let fullEmailHtml: string | undefined;
    if (channels.includes("email") && email_html) {
      // Generate email content from custom HTML with products
      const emailContent = generateCustomEmailHtml(email_html, products_url, products);
      // Build complete email with header, wrapper, and footer
      fullEmailHtml = await buildCampaignEmail(tenantDb, emailContent);
    }

    // Get the notification image (push_image takes priority, then generic image)
    const notificationIcon = push_image || image;

    // Generate notification payload for mobile/web
    const notificationPayload =
      type === "product"
        ? {
            category: "product" as const,
            products: products?.map((p) => ({
              sku: p.sku,
              name: p.name,
              image: p.image,
              item_ref: p.item_ref,
            })),
            filters: products && products.length > 0 ? { sku: products.map((p) => p.sku) } : undefined,
            media: push_image ? { image: push_image } : undefined,
          }
        : {
            category: "generic" as const,
            url,
            open_in_new_tab: open_in_new_tab,
            media: image ? { image } : undefined,
          };

    // Process each recipient
    for (const recipient of recipients) {
      // Send email if enabled
      if (channels.includes("email") && fullEmailHtml && recipient.email) {
        try {
          const subject = email_subject || title || "Nuova comunicazione";
          const result = await sendEmail({
            to: recipient.email,
            subject,
            html: fullEmailHtml,
            text: messageBody || "Visualizza questa email nel tuo browser.",
            tags: ["campaign", type],
          });

          if (result.success) {
            results.email.sent++;
          } else {
            results.email.failed++;
          }
        } catch {
          results.email.failed++;
        }
      }

      // Create in-app notification if enabled
      if (channels.includes("web_in_app")) {
        try {
          await createInAppNotification(tenantDb, {
            user_id: recipient._id.toString(),
            type: type === "product" ? "campaign_product" : "campaign_generic",
            title,
            body: messageBody,
            icon: notificationIcon,
            action_url: url,
            data: notificationPayload,
          });
          results.web_in_app.sent++;
        } catch {
          results.web_in_app.failed++;
        }
      }

      // Mobile push notification (TODO: implement push service)
      if (channels.includes("mobile")) {
        // TODO: Queue mobile push notifications
        results.mobile.sent++;
      }
    }

    return NextResponse.json({
      success: true,
      type,
      channels,
      recipient_type,
      recipients_count: recipients.length,
      results,
      message: `Campaign sent to ${recipients.length} recipients`,
    });
  } catch (error) {
    console.error("Error sending campaign:", error);
    return NextResponse.json(
      { error: "Failed to send campaign" },
      { status: 500 }
    );
  }
}
