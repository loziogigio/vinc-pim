/**
 * Campaign Send Service
 *
 * Handles bulk campaign notification sending. Extracted from send.service.ts
 * for better file organization (keep files under 500 lines).
 */

import { connectWithModels } from "@/lib/db/connection";
import {
  getTemplate,
  previewTemplateInline,
  generateNotificationPayload,
} from "./template.service";
import type { INotificationTemplate } from "@/lib/constants/notification";
import { sendEmail } from "@/lib/email";
import { sendFCM, isFCMEnabled } from "@/lib/fcm";
import { createInAppNotification } from "./in-app.service";
import type { NotificationPayload } from "@/lib/db/models/notification";

// ============================================
// DIRECT CAMPAIGN SENDING (No Template Lookup)
// ============================================

export interface SendCampaignDirectOptions {
  /** Tenant database name */
  tenantDb: string;
  /** Campaign content */
  content: {
    type: "product" | "generic";
    title: string;
    body: string;
    push_image?: string;
    email_subject?: string;
    email_html?: string;  // Pre-rendered HTML (already includes header/footer)
    products_url?: string;
    products?: Array<{ sku: string; name: string; image: string; item_ref: string }>;
    url?: string;
    image?: string;
    open_in_new_tab?: boolean;
    campaign_id?: string;
  };
  /** Recipients - array of { user_id, email, name?, user_type } */
  recipients: Array<{
    user_id: string;
    email: string;
    name?: string;
    /** User type: both use user_id (B2B uses VINC API user_id, Portal uses portal_user_id) */
    user_type: "b2b_user" | "portal_user";
  }>;
  /** Which channels to send via */
  channels: {
    email: boolean;
    mobile: boolean;
    web_in_app: boolean;
  };
  /** Queue notifications instead of sending immediately */
  queue?: boolean;
  /** User IDs with active FCM tokens - only these will receive mobile push */
  mobileEligibleUserIds?: Set<string>;
}

export interface SendCampaignDirectResult {
  success: boolean;
  recipients_count: number;
  email: { sent: number; failed: number };
  mobile: { sent: number; failed: number };
  web_in_app: { sent: number; failed: number };
  error?: string;
}

/**
 * Send a campaign notification directly with inline content (no template lookup).
 *
 * Used by campaign.service.ts when sending campaigns that have their own content.
 */
export async function sendCampaignDirect(
  options: SendCampaignDirectOptions
): Promise<SendCampaignDirectResult> {
  const { tenantDb, content, recipients, channels, queue = true, mobileEligibleUserIds } = options;

  const result: SendCampaignDirectResult = {
    success: false,
    recipients_count: recipients.length,
    email: { sent: 0, failed: 0 },
    mobile: { sent: 0, failed: 0 },
    web_in_app: { sent: 0, failed: 0 },
  };

  if (recipients.length === 0) {
    return { ...result, error: "No recipients" };
  }

  try {
    // Get notification icon (push_image takes priority)
    const notificationIcon = content.push_image || content.image;

    // Build payload for mobile/in-app
    const notificationPayload =
      content.type === "product"
        ? {
            category: "product" as const,
            products: content.products,
            products_url: content.products_url,
            campaign_id: content.campaign_id,
          }
        : {
            category: "generic" as const,
            // For generic, use products_url as the action URL
            url: content.products_url || content.url,
            open_in_new_tab: content.open_in_new_tab,
            campaign_id: content.campaign_id,
          };

    // Process each recipient
    for (const recipient of recipients) {
      // Email
      if (channels.email && content.email_html && recipient.email) {
        try {
          const subject = content.email_subject || content.title || "Nuova comunicazione";
          const emailResult = await sendEmail({
            to: recipient.email,
            subject,
            html: content.email_html,
            text: content.body || "Visualizza questa email nel tuo browser.",
            immediate: !queue,
            tenantDb,
            campaign_id: content.campaign_id,
          });

          if (emailResult.success) {
            result.email.sent++;
          } else {
            result.email.failed++;
          }
        } catch (error) {
          console.error(`[Campaign] Email error for ${recipient.email}:`, error);
          result.email.failed++;
        }
      }

      // Web In-App - create for both B2B and Portal users
      if (channels.web_in_app) {
        try {
          await createInAppNotification({
            tenantDb,
            user_id: recipient.user_id,
            user_type: recipient.user_type, // Use actual user type
            trigger: "custom",
            title: content.title,
            body: content.body,
            icon: notificationIcon,
            action_url: content.products_url || content.url,
            payload: notificationPayload as NotificationPayload,
            campaign_id: content.campaign_id,
          });
          result.web_in_app.sent++;
        } catch (error) {
          console.error(`[Campaign] In-app error for ${recipient.user_id}:`, error);
          result.web_in_app.failed++;
        }
      }

      // Mobile (FCM) - send if user has active FCM tokens
      const hasFCMToken = !mobileEligibleUserIds || mobileEligibleUserIds.has(recipient.user_id);
      if (channels.mobile && recipient.user_id && hasFCMToken) {
        try {
          const fcmEnabled = await isFCMEnabled(tenantDb);
          if (fcmEnabled) {
            const fcmResult = await sendFCM({
              tenantDb,
              title: content.title || "Nuova comunicazione",
              body: content.body || "",
              icon: notificationIcon,
              image: content.push_image || content.image,
              action_url: content.products_url || content.url,
              userIds: [recipient.user_id],
              queue,
              priority: "normal",
              trigger: "campaign",
              data: {
                campaign_type: content.type,
                ...(content.campaign_id ? { campaign_id: content.campaign_id } : {}),
                // Product SKU for single product detail navigation
                ...(content.type === "product" && content.products?.[0]?.sku
                  ? { sku: content.products[0].sku }
                  : {}),
                // URL for navigation (products_url for "See All" or generic action)
                ...(content.products_url ? { products_url: content.products_url } : {}),
                // Include open_in_new_tab setting (as string for FCM data)
                ...(content.open_in_new_tab !== undefined ? { open_in_new_tab: String(content.open_in_new_tab) } : {}),
              },
            });

            if (fcmResult.success) {
              result.mobile.sent += fcmResult.queued || fcmResult.sent || 1;
            } else {
              result.mobile.failed++;
            }
          }
        } catch (error) {
          console.error(`[Campaign] FCM error for ${recipient.user_id}:`, error);
          result.mobile.failed++;
        }
      }
    }

    result.success = true;
    console.log(
      `[Campaign] Direct send to ${recipients.length} recipients: ` +
        `email=${result.email.sent}/${result.email.failed}, ` +
        `mobile=${result.mobile.sent}/${result.mobile.failed}, ` +
        `in-app=${result.web_in_app.sent}/${result.web_in_app.failed}`
    );

    return result;
  } catch (error) {
    console.error(`[Campaign] Direct send error:`, error);
    return {
      ...result,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// TEMPLATE-BASED CAMPAIGN SENDING
// ============================================

export interface SendCampaignOptions {
  /** Tenant database name */
  tenantDb: string;
  /** Campaign template ID */
  templateId: string;
  /** Recipients - array of { user_id, email, name? } */
  recipients: Array<{
    user_id: string;
    email: string;
    name?: string;
  }>;
  /** Which channels to send via (defaults to all enabled in template) */
  channels?: {
    email?: boolean;
    mobile?: boolean;
    web_in_app?: boolean;
  };
  /** Queue emails/push instead of sending immediately */
  queue?: boolean;
}

export interface SendCampaignResult {
  success: boolean;
  template_id: string;
  recipients_count: number;
  channels_sent: string[];
  email_results?: {
    sent: number;
    failed: number;
    queued: number;
  };
  mobile_results?: {
    sent: number;
    failed: number;
    queued: number;
  };
  in_app_results?: {
    created: number;
    failed: number;
  };
  error?: string;
}

/**
 * Send a campaign notification to multiple recipients via enabled channels.
 *
 * Uses the new campaign template structure (type: product | generic).
 *
 * @example
 * ```ts
 * await sendCampaignNotification({
 *   tenantDb: "vinc-hidros-it",
 *   templateId: "campaign-product",
 *   recipients: [
 *     { user_id: "user1", email: "user1@example.com", name: "Mario" },
 *     { user_id: "user2", email: "user2@example.com", name: "Luigi" },
 *   ],
 * });
 * ```
 */
export async function sendCampaignNotification(
  options: SendCampaignOptions
): Promise<SendCampaignResult> {
  const {
    tenantDb,
    templateId,
    recipients,
    channels,
    queue = true,
  } = options;

  const result: SendCampaignResult = {
    success: false,
    template_id: templateId,
    recipients_count: recipients.length,
    channels_sent: [],
  };

  try {
    // 1. Get the campaign template
    const template = await getTemplate(tenantDb, templateId);

    if (!template) {
      return {
        ...result,
        error: `Template not found: ${templateId}`,
      };
    }

    if (!template.type) {
      return {
        ...result,
        error: `Template is not a campaign template (missing type): ${templateId}`,
      };
    }

    // 2. Determine which channels to use
    const templateChannels = template.template_channels || {};
    const shouldSendEmail = (channels?.email ?? templateChannels.email?.enabled) ?? false;
    const shouldSendMobile = (channels?.mobile ?? templateChannels.mobile?.enabled) ?? false;
    const shouldSendWebInApp = (channels?.web_in_app ?? templateChannels.web_in_app?.enabled) ?? false;

    if (!shouldSendEmail && !shouldSendMobile && !shouldSendWebInApp) {
      return {
        ...result,
        error: "No channels enabled for sending",
      };
    }

    // 3. Get SMTP config for email
    let smtpFrom: string | undefined;
    let smtpFromName: string | undefined;

    if (shouldSendEmail) {
      const { HomeSettings } = await connectWithModels(tenantDb);
      const settings = await HomeSettings.findOne({}).lean();
      const smtpSettings = (settings as { smtp_settings?: { from?: string; from_name?: string } })?.smtp_settings;
      smtpFrom = smtpSettings?.from;
      smtpFromName = smtpSettings?.from_name;

      if (!smtpFrom) {
        console.warn(`[Campaign] No SMTP config, skipping email channel`);
      }
    }

    // 4. Generate payload for mobile/in-app
    const payload = generateNotificationPayload(template as unknown as INotificationTemplate);

    // 5. Render email template once (not per-recipient for now)
    let renderedEmail: { subject: string; html: string } | null = null;

    if (shouldSendEmail && smtpFrom && templateChannels.email?.html_body) {
      renderedEmail = await previewTemplateInline(
        tenantDb,
        {
          html_body: templateChannels.email.html_body,
          subject: templateChannels.email.subject || template.title,
          use_default_header: template.use_default_header,
          use_default_footer: template.use_default_footer,
          header_id: template.header_id,
          footer_id: template.footer_id,
        },
        {
          title: template.title,
          body: template.body,
          url: template.url || "",
          image: template.image || "",
        }
      );
    }

    // 6. Send to each recipient
    const emailResults = { sent: 0, failed: 0, queued: 0 };
    const mobileResults = { sent: 0, failed: 0, queued: 0 };
    const inAppResults = { created: 0, failed: 0 };

    for (const recipient of recipients) {
      // Send email
      if (shouldSendEmail && smtpFrom && renderedEmail) {
        try {
          const emailResult = await sendEmail({
            to: recipient.email,
            subject: renderedEmail.subject,
            html: renderedEmail.html,
            from: smtpFrom,
            fromName: smtpFromName,
            immediate: !queue,
            tenantDb,
          });

          if (emailResult.success) {
            emailResults.sent++;
          } else {
            emailResults.failed++;
          }
        } catch (error) {
          console.error(`[Campaign] Email error for ${recipient.email}:`, error);
          emailResults.failed++;
        }
      }

      // Send mobile push (via FCM for native mobile apps)
      if (shouldSendMobile) {
        try {
          const fcmEnabled = await isFCMEnabled(tenantDb);
          if (fcmEnabled) {
            const fcmResult = await sendFCM({
              tenantDb,
              title: template.title,
              body: template.body,
              icon: templateChannels.mobile?.icon,
              action_url: templateChannels.mobile?.action_url || template.url,
              userIds: [recipient.user_id],
              templateId: template.template_id,
              trigger: template.trigger,
              queue,
            });
            if (fcmResult.sent) {
              mobileResults.sent += fcmResult.sent;
            }
            if (fcmResult.queued) {
              mobileResults.queued += fcmResult.queued;
            }
            if (fcmResult.failed) {
              mobileResults.failed += fcmResult.failed;
            }
          }
        } catch (error) {
          console.error(`[Campaign] FCM error for ${recipient.user_id}:`, error);
          mobileResults.failed++;
        }
      }

      // Create in-app notification
      if (shouldSendWebInApp) {
        try {
          await createInAppNotification({
            tenantDb,
            user_id: recipient.user_id,
            user_type: "b2b_user",
            trigger: template.trigger,
            title: template.title,
            body: template.body,
            icon: templateChannels.web_in_app?.icon,
            action_url: templateChannels.web_in_app?.action_url || template.url,
            payload: payload as NotificationPayload,
          });
          inAppResults.created++;
        } catch (error) {
          console.error(`[Campaign] In-app error for ${recipient.user_id}:`, error);
          inAppResults.failed++;
        }
      }
    }

    // 7. Build result
    if (shouldSendEmail) {
      result.channels_sent.push("email");
      result.email_results = emailResults;
    }
    if (shouldSendMobile) {
      result.channels_sent.push("mobile");
      result.mobile_results = mobileResults;
    }
    if (shouldSendWebInApp) {
      result.channels_sent.push("web_in_app");
      result.in_app_results = inAppResults;
    }

    result.success = true;
    console.log(`[Campaign] Sent ${templateId} to ${recipients.length} recipients via ${result.channels_sent.join(", ")}`);

    return result;
  } catch (error) {
    console.error(`[Campaign] Error sending ${templateId}:`, error);
    return {
      ...result,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
