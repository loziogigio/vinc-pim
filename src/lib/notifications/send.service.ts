/**
 * Notification Send Service
 *
 * Sends notifications using templates with tenant-specific SMTP configuration.
 * Supports email and web push channels with header/footer components for email.
 *
 * Campaign-specific sending functions are in ./campaign-send.service.ts
 */

import { connectWithModels } from "@/lib/db/connection";
import {
  getTemplateByTrigger,
  previewTemplate,
} from "./template.service";
import { sendEmail } from "@/lib/email";
import { sendPush, isWebPushEnabled } from "@/lib/push";
import { sendFCM, isFCMEnabled } from "@/lib/fcm";
import type { SendFCMResult } from "@/lib/fcm/types";
import { createInAppNotification } from "./in-app.service";
import type { IB2CStorefront } from "@/lib/db/models/b2c-storefront";
import { DEFAULT_CHANNEL } from "@/lib/constants/channel";
import type { NotificationTrigger } from "@/lib/db/models/notification-template";
import type { PushPreferences, SendPushResult } from "@/lib/push/types";
import type { NotificationUserType, NotificationPayload } from "@/lib/db/models/notification";

// Re-export campaign functions for backward compatibility
export {
  sendCampaignDirect,
  sendCampaignNotification,
  type SendCampaignDirectOptions,
  type SendCampaignDirectResult,
  type SendCampaignOptions,
  type SendCampaignResult,
} from "./campaign-send.service";

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

    // 3. Send email (sendEmail resolves from/fromName from tenant config — SMTP or Graph)
    const result = await sendEmail({
      to,
      subject: rendered.subject,
      html: rendered.html,
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
 * Resolve the storefront base URL and branding for email links.
 *
 * Priority for loginUrl:
 * 1. Explicit login_url passed by caller
 * 2. Storefront primary domain (from b2cstorefronts collection)
 * 3. HomeSettings branding.shopUrl (legacy fallback)
 *
 * Priority for shopName/logo/primaryColor:
 * 1. Storefront branding (if channel resolves to a storefront)
 * 2. HomeSettings branding (legacy fallback)
 */
async function resolveLoginUrl(
  tenantDb: string,
  explicitUrl?: string,
  channel?: string
): Promise<{ loginUrl: string; shopName: string; logo: string; primaryColor: string }> {
  const { HomeSettings, B2CStorefront } = await connectWithModels(tenantDb);
  const settings = await HomeSettings.findOne({}).lean();
  const homeBranding = (settings as { branding?: { title?: string; shopUrl?: string; logo?: string; primaryColor?: string } })?.branding;

  // Defaults from HomeSettings
  let shopName = homeBranding?.title || "VINC B2B";
  let logo = homeBranding?.logo || "";
  let primaryColor = homeBranding?.primaryColor || "";

  // Try to resolve storefront by channel for branding + domain
  const channelCode = channel || DEFAULT_CHANNEL;
  const storefront = await B2CStorefront.findOne({
    channel: channelCode,
    status: "active",
  }).lean() as IB2CStorefront | null;

  if (storefront?.branding) {
    if (storefront.branding.title) shopName = storefront.branding.title;
    if (storefront.branding.logo_url) logo = storefront.branding.logo_url;
    if (storefront.branding.primary_color) primaryColor = storefront.branding.primary_color;
  }

  if (explicitUrl) return { loginUrl: explicitUrl, shopName, logo, primaryColor };

  // Try storefront primary domain
  if (storefront?.domains?.length) {
    const primary = storefront.domains.find((d: { is_primary?: boolean }) => d.is_primary);
    const domain = primary?.domain || storefront.domains[0]?.domain;
    if (domain) {
      const url = domain.startsWith("http") ? domain : `https://${domain}`;
      const base = url.endsWith("/") ? url.slice(0, -1) : url;
      return { loginUrl: `${base}/login`, shopName, logo, primaryColor };
    }
  }

  // Legacy fallback
  const fallback = homeBranding?.shopUrl;
  if (fallback) {
    const base = fallback.endsWith("/") ? fallback.slice(0, -1) : fallback;
    return { loginUrl: `${base}/login`, shopName, logo, primaryColor };
  }

  return { loginUrl: "", shopName, logo, primaryColor };
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
    channel?: string;
  }
): Promise<SendNotificationResult> {
  const { loginUrl, shopName, logo, primaryColor } = await resolveLoginUrl(tenantDb, variables.login_url, variables.channel);

  return sendNotification({
    tenantDb,
    trigger: "forgot_password",
    to,
    variables: {
      customer_name: variables.customer_name || "Cliente",
      temporary_password: variables.temporary_password,
      login_url: loginUrl,
      shop_name: shopName,
      ...(logo && { logo }),
      ...(primaryColor && { primary_color: primaryColor }),
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
    channel?: string;
  }
): Promise<SendNotificationResult> {
  const { loginUrl, shopName, logo, primaryColor } = await resolveLoginUrl(tenantDb, variables.login_url, variables.channel);

  return sendNotification({
    tenantDb,
    trigger: "welcome",
    to,
    variables: {
      customer_name: variables.customer_name,
      customer_company: variables.company_name,
      username: variables.username,
      password: variables.password,
      login_url: loginUrl,
      shop_name: shopName,
      ...(logo && { logo }),
      ...(primaryColor && { primary_color: primaryColor }),
    },
  });
}

/**
 * Send welcome email for self-registered users (no credentials).
 *
 * Convenience wrapper around sendNotification for welcome_self_registration trigger.
 */
export async function sendSelfRegistrationWelcome(
  tenantDb: string,
  to: string,
  variables: {
    customer_name: string;
    company_name?: string;
    login_url?: string;
    channel?: string;
  }
): Promise<SendNotificationResult> {
  const { loginUrl, shopName, logo, primaryColor } = await resolveLoginUrl(tenantDb, variables.login_url, variables.channel);

  return sendNotification({
    tenantDb,
    trigger: "welcome_self_registration",
    to,
    variables: {
      customer_name: variables.customer_name,
      customer_company: variables.company_name || "",
      login_url: loginUrl,
      shop_name: shopName,
      ...(logo && { logo }),
      ...(primaryColor && { primary_color: primaryColor }),
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
    channel?: string;
  }
): Promise<SendNotificationResult> {
  const { loginUrl, shopName, logo, primaryColor } = await resolveLoginUrl(tenantDb, variables.login_url, variables.channel);

  const { HomeSettings } = await connectWithModels(tenantDb);
  const settings = await HomeSettings.findOne({}).lean();
  const companyInfo = (settings as { company_info?: { email?: string } })?.company_info;
  const supportEmail = variables.support_email || companyInfo?.email || "";

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
      ...(logo && { logo }),
      ...(primaryColor && { primary_color: primaryColor }),
    },
  });
}
