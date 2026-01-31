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
import {
  validateCampaignPayload,
  buildInAppPayload,
  getNotificationIcon,
  createResultsTracker,
  type CampaignPayload,
} from "@/lib/notifications/campaign.utils";
import type { NotificationChannel } from "@/lib/constants/notification";

interface CampaignTestPayload extends CampaignPayload {
  test_email: string;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb } = auth;
    const payload: CampaignTestPayload = await req.json();

    const {
      type,
      title,
      body: messageBody,
      push_image,
      email_subject,
      email_html,
      products_url,
      products,
      channels,
      test_email,
      url,
      image,
      open_in_new_tab,
    } = payload;

    // Validate test email
    if (!test_email) {
      return NextResponse.json({ error: "Test email address is required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(test_email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    // Use shared validation
    const validation = validateCampaignPayload(payload);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Track results using shared tracker
    const results = createResultsTracker() as Record<NotificationChannel, { sent: number; failed: number; error?: string }>;
    const channelsSent: string[] = [];

    const { PortalUser } = await connectWithModels(tenantDb);

    // Lookup portal user once if needed for mobile or web_in_app
    const hasPush = channels.includes("mobile") || channels.includes("web_in_app");
    let portalUser: { portal_user_id?: string } | null = null;
    if (hasPush) {
      portalUser = await PortalUser.findOne(
        { email: test_email.toLowerCase() },
        { portal_user_id: 1 }
      ).lean();
    }

    // Get notification icon using shared utility
    const notificationIcon = getNotificationIcon(push_image, image);

    // =========================================
    // EMAIL CHANNEL
    // =========================================
    if (channels.includes("email")) {
      let emailContent: string;
      if (email_html) {
        emailContent = generateCustomEmailHtml(email_html, products_url, products);
      } else if (type === "generic") {
        emailContent = generateGenericEmailHtml(title || "Test", messageBody || "", url, image, open_in_new_tab);
      } else {
        emailContent = "<p>Nessun contenuto email configurato.</p>";
      }

      const fullHtml = await buildCampaignEmail(tenantDb, emailContent);
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
      const fcmEnabled = await isFCMEnabled(tenantDb);
      if (!fcmEnabled) {
        results.mobile.error = "FCM not enabled for this tenant";
        results.mobile.failed = 1;
      } else if (!portalUser?.portal_user_id) {
        results.mobile.error = `No portal user found with email ${test_email}`;
        results.mobile.failed = 1;
      } else {
        const tokens = await getActiveTokens(tenantDb, { userIds: [portalUser.portal_user_id] });

        if (tokens.length === 0) {
          results.mobile.error = `User has no registered mobile devices`;
          results.mobile.failed = 1;
        } else {
          const fcmResult = await sendFCM({
            tenantDb,
            title: `[TEST] ${title}`,
            body: messageBody || "",
            icon: notificationIcon,
            image: push_image || image,
            action_url: url,
            userIds: [portalUser.portal_user_id],
            queue: false,
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

    // =========================================
    // WEB IN-APP CHANNEL
    // =========================================
    if (channels.includes("web_in_app")) {
      if (!portalUser?.portal_user_id) {
        results.web_in_app.error = `No portal user found with email ${test_email}`;
        results.web_in_app.failed = 1;
      } else {
        try {
          // Use shared payload builder
          const inAppPayload = buildInAppPayload(type, { products, url, open_in_new_tab });

          await createInAppNotification({
            tenantDb,
            user_id: portalUser.portal_user_id,
            trigger: "custom",
            title: `[TEST] ${title}`,
            body: messageBody || "",
            icon: notificationIcon,
            action_url: url,
            payload: inAppPayload,
          });
          results.web_in_app.sent = 1;
          channelsSent.push("web_in_app");
        } catch (err) {
          results.web_in_app.failed = 1;
          results.web_in_app.error = err instanceof Error ? err.message : "Failed to create notification";
        }
      }
    }

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
    console.error("Error sending test:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send test" },
      { status: 500 }
    );
  }
}
