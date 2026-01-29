/**
 * Campaign Send API
 *
 * POST /api/b2b/notifications/campaigns/send - Send campaign to recipients
 *
 * Supports both B2B Session and API Key authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { sendEmail } from "@/lib/email";
import {
  buildCampaignEmail,
  generateCustomEmailHtml,
  generateGenericEmailHtml,
} from "@/lib/notifications/email-builder";
import { createInAppNotification } from "@/lib/notifications/in-app.service";
import { sendFCM, isFCMEnabled, getActiveTokens } from "@/lib/fcm";
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
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb } = auth;
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

    // Check if FCM is enabled for mobile channel
    let fcmEnabled = false;
    if (channels.includes("mobile")) {
      fcmEnabled = await isFCMEnabled(tenantDb);
      if (!fcmEnabled) {
        return NextResponse.json(
          { error: "FCM push notifications not enabled. Configure FCM in settings first." },
          { status: 400 }
        );
      }
    }

    // Get models once for reuse (DRY principle)
    const { PortalUser } = await connectWithModels(tenantDb);
    let recipients: { _id: string; portal_user_id: string; email: string; username?: string }[] = [];

    switch (recipient_type) {
      case "all":
        // Get all active portal users (they have the mobile app)
        recipients = await PortalUser.find({ is_active: true })
          .select("_id portal_user_id email username")
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
        // id should be portal_user_id
        recipients = selected_users.map((u) => ({
          _id: u.id,
          portal_user_id: u.id,
          email: u.email,
          username: u.name,
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
          await createInAppNotification({
            tenantDb,
            user_id: recipient.portal_user_id,
            trigger: "custom",
            title: title || "Nuova comunicazione",
            body: messageBody || "",
            icon: notificationIcon,
            action_url: url,
            payload: type === "product"
              ? { category: "product", products: products || [] }
              : { category: "generic", url, open_in_new_tab },
          });
          results.web_in_app.sent++;
        } catch {
          results.web_in_app.failed++;
        }
      }

      // Mobile push notification (FCM)
      if (channels.includes("mobile") && recipient.portal_user_id) {
        try {
          // Check if user has registered FCM tokens
          const tokens = await getActiveTokens(tenantDb, { userIds: [recipient.portal_user_id] });

          if (tokens.length > 0) {
            // Send FCM notification (queued for better performance)
            const fcmResult = await sendFCM({
              tenantDb,
              title: title || "Nuova comunicazione",
              body: messageBody || "",
              icon: notificationIcon,
              image: push_image || image,
              action_url: url,
              userIds: [recipient.portal_user_id],
              queue: true, // Queue for better performance on bulk sends
              priority: "normal",
              trigger: "campaign",
              data: {
                campaign_type: type,
                ...(type === "product" && products?.[0]?.sku
                  ? { sku: products[0].sku }
                  : {}),
              },
            });

            if (fcmResult.success) {
              results.mobile.sent += fcmResult.queued || fcmResult.sent || 1;
            } else {
              results.mobile.failed++;
            }
          }
          // If no tokens, silently skip (user hasn't registered a device)
        } catch {
          results.mobile.failed++;
        }
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
