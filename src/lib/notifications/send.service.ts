/**
 * Notification Send Service
 *
 * Sends notifications using templates with tenant-specific SMTP configuration.
 * Supports email and web push channels with header/footer components for email.
 */

import { connectWithModels } from "@/lib/db/connection";
import {
  getTemplateByTrigger,
  getTemplate,
  previewTemplate,
  previewTemplateInline,
  generateNotificationPayload,
} from "./template.service";
import type { INotificationTemplate } from "@/lib/constants/notification";
import { sendEmail } from "@/lib/email";
import { sendPush, isWebPushEnabled } from "@/lib/push";
import { sendFCM, isFCMEnabled } from "@/lib/fcm";
import type { SendFCMResult } from "@/lib/fcm/types";
import { createInAppNotification } from "./in-app.service";
import type { NotificationTrigger } from "@/lib/db/models/notification-template";
import type { PushPreferences, SendPushResult } from "@/lib/push/types";
import type { NotificationUserType, NotificationPayload } from "@/lib/db/models/notification";

// ============================================
// TYPES
// ============================================

export interface SendNotificationOptions {
  /** Tenant database name (e.g., "vinc-hidros-it") */
  tenantDb: string;
  /** Notification trigger type */
  trigger: NotificationTrigger;
  /** Recipient email address */
  to: string;
  /** Template variables to replace */
  variables: Record<string, string>;
  /** Send immediately (default: true) */
  immediate?: boolean;
  /** Reply-to email address */
  replyTo?: string;
  /** Target user IDs for push notifications (optional) */
  pushUserIds?: string[];
  /** Push preference type to filter subscribers */
  pushPreferenceType?: keyof PushPreferences;
  /** Queue push notifications instead of sending immediately */
  queuePush?: boolean;
  /** Target user ID for in-app notifications */
  targetUserId?: string;
  /** Target user type for in-app notifications */
  targetUserType?: NotificationUserType;
  /** Typed payload for in-app/mobile notifications (generic, product, order, price) */
  payload?: NotificationPayload;
}

export interface SendNotificationResult {
  success: boolean;
  emailId?: string;
  messageId?: string;
  error?: string;
  /** Web Push notification results */
  pushResult?: SendPushResult;
  /** FCM (mobile push) notification results */
  fcmResult?: SendFCMResult;
  /** In-app notification ID if created */
  inAppNotificationId?: string;
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Send a notification using the template system.
 *
 * 1. Fetches the active template for the trigger
 * 2. Renders the template with variables (including header/footer)
 * 3. Sends the email using tenant SMTP config
 *
 * @example
 * ```ts
 * await sendNotification({
 *   tenantDb: "vinc-hidros-it",
 *   trigger: "forgot_password",
 *   to: "user@example.com",
 *   variables: {
 *     customer_name: "Mario Rossi",
 *     temporary_password: "Abc123!@#",
 *     login_url: "https://shop.example.com/login"
 *   }
 * });
 * ```
 */
export async function sendNotification(
  options: SendNotificationOptions
): Promise<SendNotificationResult> {
  const {
    tenantDb,
    trigger,
    to,
    variables,
    immediate = true,
    replyTo,
    pushUserIds,
    pushPreferenceType,
    queuePush = true,
    targetUserId,
    targetUserType = "b2b_user",
    payload,
  } = options;

  try {
    // 1. Get template for trigger
    const template = await getTemplateByTrigger(tenantDb, trigger);

    if (!template) {
      console.warn(`[Notifications] No active template found for trigger: ${trigger}`);
      return {
        success: false,
        error: `No active template found for trigger: ${trigger}`,
      };
    }

    // Check if email channel is enabled
    if (!template.channels?.email?.enabled) {
      console.warn(`[Notifications] Email channel not enabled for template: ${template.template_id}`);
      return {
        success: false,
        error: `Email channel not enabled for template: ${template.template_id}`,
      };
    }

    // 2. Render template with variables (includes header/footer)
    const rendered = await previewTemplate(tenantDb, template.template_id, variables);

    if (!rendered) {
      return {
        success: false,
        error: "Failed to render template",
      };
    }

    // 3. Get SMTP config from tenant home settings
    const { HomeSettings } = await connectWithModels(tenantDb);
    const settings = await HomeSettings.findOne({}).lean();

    // Build from address
    const smtpSettings = (settings as { smtp_settings?: { from?: string; from_name?: string } })?.smtp_settings;
    const from = smtpSettings?.from;
    const fromName = smtpSettings?.from_name;

    if (!from) {
      console.warn(`[Notifications] No SMTP from address configured for tenant: ${tenantDb}`);
      return {
        success: false,
        error: "SMTP not configured for tenant",
      };
    }

    // 4. Send email
    const result = await sendEmail({
      to,
      subject: rendered.subject,
      html: rendered.html,
      from,
      fromName,
      replyTo,
      immediate,
      tenantDb,
    });

    if (result.success) {
      console.log(`[Notifications] Sent ${trigger} to ${to} via template ${template.template_id}`);
    }

    // 5. Send push notification if web_push channel is enabled
    let pushResult: SendPushResult | undefined;

    if (template.channels?.web_push?.enabled) {
      try {
        const pushEnabled = await isWebPushEnabled(tenantDb);

        if (pushEnabled) {
          // Replace variables in push content
          let pushTitle = template.channels.web_push.title || "";
          let pushBody = template.channels.web_push.body || "";
          let pushActionUrl = template.channels.web_push.action_url || "";

          for (const [key, value] of Object.entries(variables)) {
            const pattern = new RegExp(`{{\\s*${key}\\s*}}`, "g");
            pushTitle = pushTitle.replace(pattern, value);
            pushBody = pushBody.replace(pattern, value);
            pushActionUrl = pushActionUrl.replace(pattern, value);
          }

          pushResult = await sendPush({
            tenantDb,
            title: pushTitle,
            body: pushBody,
            icon: template.channels.web_push.icon,
            action_url: pushActionUrl || undefined,
            userIds: pushUserIds,
            preferenceType: pushPreferenceType,
            templateId: template.template_id,
            trigger,
            queue: queuePush,
          });

          if (pushResult.sent || pushResult.queued) {
            console.log(
              `[Notifications] Push ${trigger}: ${pushResult.queued ? `queued ${pushResult.queued}` : `sent ${pushResult.sent}`}`
            );
          }
        }
      } catch (pushError) {
        console.error(`[Notifications] Push error for ${trigger}:`, pushError);
        // Don't fail the overall notification if push fails
      }
    }

    // 6. Send FCM (mobile push) notification if mobile channel is enabled
    let fcmResult: SendFCMResult | undefined;

    if (template.channels?.mobile?.enabled) {
      try {
        const fcmEnabled = await isFCMEnabled(tenantDb);

        if (fcmEnabled) {
          // Replace variables in mobile content
          let mobileTitle = template.channels.mobile.title || "";
          let mobileBody = template.channels.mobile.body || "";
          let mobileActionUrl = template.channels.mobile.action_url || "";

          for (const [key, value] of Object.entries(variables)) {
            const pattern = new RegExp(`{{\\s*${key}\\s*}}`, "g");
            mobileTitle = mobileTitle.replace(pattern, value);
            mobileBody = mobileBody.replace(pattern, value);
            mobileActionUrl = mobileActionUrl.replace(pattern, value);
          }

          fcmResult = await sendFCM({
            tenantDb,
            title: mobileTitle,
            body: mobileBody,
            icon: template.channels.mobile.icon,
            action_url: mobileActionUrl || undefined,
            userIds: pushUserIds,
            preferenceType: pushPreferenceType,
            templateId: template.template_id,
            trigger,
            queue: queuePush,
          });

          if (fcmResult.sent || fcmResult.queued) {
            console.log(
              `[Notifications] FCM ${trigger}: ${fcmResult.queued ? `queued ${fcmResult.queued}` : `sent ${fcmResult.sent}`}`
            );
          }
        }
      } catch (fcmError) {
        console.error(`[Notifications] FCM error for ${trigger}:`, fcmError);
        // Don't fail the overall notification if FCM fails
      }
    }

    // 7. Create in-app notification if in_app channel is enabled
    let inAppNotificationId: string | undefined;

    if (template.channels?.in_app?.enabled && targetUserId) {
      try {
        // Replace variables in in-app content
        let inAppTitle = template.channels.in_app.title || "";
        let inAppBody = template.channels.in_app.body || "";
        let inAppActionUrl = template.channels.in_app.action_url || "";

        for (const [key, value] of Object.entries(variables)) {
          const pattern = new RegExp(`{{\\s*${key}\\s*}}`, "g");
          inAppTitle = inAppTitle.replace(pattern, value);
          inAppBody = inAppBody.replace(pattern, value);
          inAppActionUrl = inAppActionUrl.replace(pattern, value);
        }

        const inAppNotification = await createInAppNotification({
          tenantDb,
          user_id: targetUserId,
          user_type: targetUserType,
          trigger,
          title: inAppTitle,
          body: inAppBody,
          icon: template.channels.in_app.icon,
          action_url: inAppActionUrl || undefined,
          payload,
        });

        inAppNotificationId = inAppNotification.notification_id;
        console.log(`[Notifications] In-app ${trigger} created for user ${targetUserId}`);
      } catch (inAppError) {
        console.error(`[Notifications] In-app error for ${trigger}:`, inAppError);
        // Don't fail the overall notification if in-app fails
      }
    }

    return {
      success: result.success,
      emailId: result.emailId,
      messageId: result.messageId,
      error: result.error,
      pushResult,
      fcmResult,
      inAppNotificationId,
    };
  } catch (error) {
    console.error(`[Notifications] Error sending ${trigger}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send forgot password email with temporary password.
 *
 * Convenience wrapper around sendNotification for forgot_password trigger.
 */
export async function sendForgotPasswordNotification(
  tenantDb: string,
  to: string,
  variables: {
    customer_name?: string;
    temporary_password: string;
    login_url?: string;
  }
): Promise<SendNotificationResult> {
  // Get shop name from home settings for variables
  const { HomeSettings } = await connectWithModels(tenantDb);
  const settings = await HomeSettings.findOne({}).lean();
  const branding = (settings as { branding?: { title?: string; shopUrl?: string } })?.branding;

  const shopName = branding?.title || "VINC B2B";
  const loginUrl = variables.login_url || branding?.shopUrl || "http://localhost:3000/login";

  return sendNotification({
    tenantDb,
    trigger: "forgot_password",
    to,
    variables: {
      customer_name: variables.customer_name || "Cliente",
      temporary_password: variables.temporary_password,
      login_url: loginUrl,
      shop_name: shopName,
    },
  });
}

/**
 * Send welcome email with credentials.
 *
 * Convenience wrapper around sendNotification for welcome trigger.
 */
export async function sendWelcomeNotification(
  tenantDb: string,
  to: string,
  variables: {
    customer_name: string;
    company_name: string;
    username: string;
    password: string;
    login_url?: string;
  }
): Promise<SendNotificationResult> {
  const { HomeSettings } = await connectWithModels(tenantDb);
  const settings = await HomeSettings.findOne({}).lean();
  const branding = (settings as { branding?: { title?: string; shopUrl?: string } })?.branding;

  const shopName = branding?.title || "VINC B2B";
  const loginUrl = variables.login_url || branding?.shopUrl || "http://localhost:3000/login";

  return sendNotification({
    tenantDb,
    trigger: "welcome",
    to,
    variables: {
      customer_name: variables.customer_name,
      company_name: variables.company_name,
      username: variables.username,
      password: variables.password,
      login_url: loginUrl,
      shop_name: shopName,
    },
  });
}

/**
 * Send password reset confirmation email.
 *
 * Convenience wrapper around sendNotification for reset_password trigger.
 */
export async function sendPasswordResetConfirmation(
  tenantDb: string,
  to: string,
  variables: {
    customer_name?: string;
    reset_date: string;
    ip_address?: string;
    login_url?: string;
    support_email?: string;
  }
): Promise<SendNotificationResult> {
  const { HomeSettings } = await connectWithModels(tenantDb);
  const settings = await HomeSettings.findOne({}).lean();
  const branding = (settings as { branding?: { title?: string; shopUrl?: string } })?.branding;
  const companyInfo = (settings as { company_info?: { email?: string } })?.company_info;

  const shopName = branding?.title || "VINC B2B";
  const loginUrl = variables.login_url || branding?.shopUrl || "http://localhost:3000/login";
  const supportEmail = variables.support_email || companyInfo?.email || "support@example.com";

  return sendNotification({
    tenantDb,
    trigger: "reset_password",
    to,
    variables: {
      customer_name: variables.customer_name || "Cliente",
      reset_date: variables.reset_date,
      ip_address: variables.ip_address || "N/A",
      login_url: loginUrl,
      support_email: supportEmail,
      shop_name: shopName,
    },
  });
}

// ============================================
// CAMPAIGN NOTIFICATION SENDING (NEW)
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
