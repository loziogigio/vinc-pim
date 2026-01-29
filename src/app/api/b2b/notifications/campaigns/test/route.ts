/**
 * Campaign Test API
 *
 * POST /api/b2b/notifications/campaigns/test - Send test notification
 *
 * Supports testing all 3 notification channels:
 * - email: Send test email to provided address
 * - mobile: Send FCM push notification to user's registered devices
 * - web_in_app: Create in-app notification for user
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

interface CampaignTestPayload {
  type: TemplateType;
  // Push notification fields
  title?: string;
  body?: string;
  // Email fields
  email_subject?: string;
  email_html?: string;
  products_url?: string;
  // Products (for product campaigns)
  products?: ITemplateProduct[];
  // Test
  channels: ("email" | "mobile" | "web_in_app")[];
  test_email: string;
  // Generic type (for backwards compatibility)
  url?: string;
  image?: string;
  open_in_new_tab?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb } = auth;
    const body: CampaignTestPayload = await req.json();

    const { type, title, body: messageBody, email_subject, email_html, products_url, products, channels, test_email, url, image, open_in_new_tab } = body;

    // Validate required fields
    if (!type || !["product", "generic"].includes(type)) {
      return NextResponse.json({ error: "Invalid campaign type" }, { status: 400 });
    }

    if (!test_email) {
      return NextResponse.json({ error: "Test email address is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(test_email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    // Check at least one channel is selected
    if (!channels || !Array.isArray(channels) || channels.length === 0) {
      return NextResponse.json(
        { error: "At least one channel must be selected" },
        { status: 400 }
      );
    }

    // Title and body required for push notifications (mobile/web_in_app)
    const hasPush = channels.includes("mobile") || channels.includes("web_in_app");
    if (hasPush) {
      if (!title?.trim()) {
        return NextResponse.json({ error: "Title is required for push notifications" }, { status: 400 });
      }
      if (!messageBody?.trim()) {
        return NextResponse.json({ error: "Message body is required for push notifications" }, { status: 400 });
      }
    }

    // Track results
    const results: Record<string, { sent: number; failed: number; error?: string }> = {};
    const channelsSent: string[] = [];

    // Get models once for reuse (DRY principle)
    const { PortalUser } = await connectWithModels(tenantDb);

    // Lookup portal user once if needed for mobile or web_in_app (DRY)
    let portalUser: { portal_user_id?: string } | null = null;
    if (hasPush) {
      portalUser = await PortalUser.findOne(
        { email: test_email.toLowerCase() },
        { portal_user_id: 1 }
      ).lean();
    }

    // =========================================
    // EMAIL CHANNEL
    // =========================================
    if (channels.includes("email")) {
      results.email = { sent: 0, failed: 0 };

      // Generate email content
      let emailContent: string;
      if (email_html) {
        emailContent = generateCustomEmailHtml(email_html, products_url, products);
      } else if (type === "generic") {
        emailContent = generateGenericEmailHtml(title || "Test", messageBody || "", url, image, open_in_new_tab);
      } else {
        emailContent = "<p>Nessun contenuto email configurato.</p>";
      }

      // Build complete email with header, wrapper, and footer
      const fullHtml = await buildCampaignEmail(tenantDb, emailContent);

      // Send test email
      const subject = email_subject || title || "Campagna";
      const emailResult = await sendEmail({
        to: test_email,
        subject: `[TEST] ${subject}`,
        html: fullHtml,
        text: messageBody || "Test email",
        immediate: true,
        tags: ["test", "campaign", type],
      });

      if (emailResult.success) {
        results.email.sent = 1;
        channelsSent.push("email");
      } else {
        results.email.failed = 1;
        results.email.error = emailResult.error;
      }
    }

    // =========================================
    // MOBILE CHANNEL (FCM)
    // =========================================
    if (channels.includes("mobile")) {
      results.mobile = { sent: 0, failed: 0 };

      // Check if FCM is enabled
      const fcmEnabled = await isFCMEnabled(tenantDb);
      if (!fcmEnabled) {
        results.mobile.error = "FCM not enabled for this tenant";
        results.mobile.failed = 1;
      } else {
        // Use pre-fetched portal user
        if (!portalUser || !portalUser.portal_user_id) {
          results.mobile.error = `No portal user found with email ${test_email}`;
          results.mobile.failed = 1;
        } else {
          // Check if user has registered devices
          const tokens = await getActiveTokens(tenantDb, { userIds: [portalUser.portal_user_id] });

          if (tokens.length === 0) {
            results.mobile.error = `User has no registered mobile devices`;
            results.mobile.failed = 1;
          } else {
            // Send FCM notification
            const fcmResult = await sendFCM({
              tenantDb,
              title: `[TEST] ${title}`,
              body: messageBody || "",
              icon: image,
              image: image,
              action_url: url,
              userIds: [portalUser.portal_user_id],
              queue: false, // Send immediately for test
              priority: "high",
              trigger: "campaign_test",
            });

            if (fcmResult.success && fcmResult.sent > 0) {
              results.mobile.sent = fcmResult.sent;
              channelsSent.push("mobile");
            } else {
              results.mobile.failed = fcmResult.failed || 1;
              results.mobile.error = fcmResult.errors?.[0]?.error || "Failed to send FCM";
            }
          }
        }
      }
    }

    // =========================================
    // WEB IN-APP CHANNEL
    // =========================================
    if (channels.includes("web_in_app")) {
      results.web_in_app = { sent: 0, failed: 0 };

      // Use pre-fetched portal user
      if (!portalUser || !portalUser.portal_user_id) {
        results.web_in_app.error = `No portal user found with email ${test_email}`;
        results.web_in_app.failed = 1;
      } else {
        try {
          await createInAppNotification({
            tenantDb,
            user_id: portalUser.portal_user_id,
            trigger: "custom",
            title: `[TEST] ${title}`,
            body: messageBody || "",
            icon: image,
            action_url: url,
            payload: type === "product"
              ? { category: "product", products: products || [] }
              : { category: "generic", url, open_in_new_tab },
          });
          results.web_in_app.sent = 1;
          channelsSent.push("web_in_app");
        } catch (err) {
          results.web_in_app.failed = 1;
          results.web_in_app.error = err instanceof Error ? err.message : "Failed to create notification";
        }
      }
    }

    // Check if any channel succeeded
    const anySuccess = channelsSent.length > 0;

    return NextResponse.json({
      success: anySuccess,
      message: anySuccess
        ? `Test sent via: ${channelsSent.join(", ")}`
        : "No test notifications were sent",
      test_email,
      channels_sent: channelsSent,
      results,
    });
  } catch (error) {
    console.error("Error sending test email:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send test email" },
      { status: 500 }
    );
  }
}
