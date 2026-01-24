/**
 * B2B Email Service
 * Simple service to send B2B emails with branding from home settings
 */

import { sendEmail } from './index';
import { getHomeSettings } from '@/lib/db/home-settings';
import type { EmailBranding } from './templates/base';
import type { CompanyContactInfo } from '@/lib/types/home-settings';
import {
  renderRegistrationRequestEmail,
  renderRegistrationRequestEmailText,
  renderCustomerConfirmationEmail,
  renderCustomerConfirmationEmailText,
  type RegistrationRequestData
} from './templates/b2b-registration-request';
import {
  renderWelcomeEmail,
  renderWelcomeEmailText,
  type WelcomeEmailData
} from './templates/b2b-welcome';
import {
  renderForgotPasswordEmail,
  renderForgotPasswordEmailText,
  type ForgotPasswordData
} from './templates/b2b-forgot-password';
import {
  renderResetPasswordEmail,
  renderResetPasswordEmailText,
  type ResetPasswordData
} from './templates/b2b-reset-password';

interface BrandingWithUrls extends EmailBranding {
  shopUrl: string;
  websiteUrl?: string;
  companyInfo?: CompanyContactInfo;
}

interface SettingsWithDefaults {
  branding: BrandingWithUrls;
  defaultRecipient?: string;
}

/**
 * Get branding and defaults from home settings
 */
async function getSettings(): Promise<SettingsWithDefaults> {
  const settings = await getHomeSettings();
  const fallbackUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

  return {
    branding: {
      companyName: settings?.branding?.title || 'B2B Store',
      logo: settings?.branding?.logo,
      primaryColor: settings?.branding?.primaryColor || '#009f7f',
      secondaryColor: settings?.branding?.secondaryColor || '#02b290',
      shopUrl: settings?.branding?.shopUrl || fallbackUrl,
      websiteUrl: settings?.branding?.websiteUrl,
      companyInfo: settings?.company_info
    },
    defaultRecipient: settings?.smtp_settings?.default_to
  };
}

/**
 * Get branding from home settings including URLs
 * @deprecated Use getSettings() instead
 */
async function getBranding(): Promise<BrandingWithUrls> {
  const { branding } = await getSettings();
  return branding;
}

/**
 * Send B2B Registration Request emails - different emails for admin and customer
 * @param data Registration request data
 * @param adminEmail Optional admin email (falls back to SMTP default_to setting)
 * @param options Additional options
 */
export async function sendRegistrationRequestEmail(
  data: RegistrationRequestData,
  adminEmail?: string,
  options?: { adminUrl?: string; immediate?: boolean }
): Promise<{ success: boolean; messageId?: string; adminMessageId?: string; customerMessageId?: string; error?: string }> {
  try {
    const { branding, defaultRecipient } = await getSettings();
    const admin = adminEmail || defaultRecipient;

    if (!admin) {
      return {
        success: false,
        error: 'No admin email provided and no default recipient configured in SMTP settings'
      };
    }

    const adminUrl = options?.adminUrl || branding.shopUrl;
    const results: { adminMessageId?: string; customerMessageId?: string } = {};

    // 1. Send ADMIN email - notification about new registration request
    const adminHtml = renderRegistrationRequestEmail({
      branding,
      data,
      adminUrl
    });

    const adminText = renderRegistrationRequestEmailText({
      branding,
      data,
      adminUrl
    });

    const adminResult = await sendEmail({
      to: admin,
      subject: `Nuova Richiesta di Registrazione B2B - ${data.ragioneSociale}`,
      html: adminHtml,
      text: adminText,
      replyTo: data.email,
      immediate: options?.immediate ?? true
    });

    results.adminMessageId = adminResult.messageId;

    // 2. Send CUSTOMER email - confirmation of what they submitted
    if (data.email) {
      const customerHtml = renderCustomerConfirmationEmail({
        branding,
        data,
        shopUrl: branding.shopUrl
      });

      const customerText = renderCustomerConfirmationEmailText({
        branding,
        data,
        shopUrl: branding.shopUrl
      });

      const customerResult = await sendEmail({
        to: data.email,
        subject: `Richiesta di Registrazione Ricevuta - ${branding.companyName}`,
        html: customerHtml,
        text: customerText,
        immediate: options?.immediate ?? true
      });

      results.customerMessageId = customerResult.messageId;
    }

    return {
      success: true,
      messageId: results.adminMessageId, // For backward compatibility
      adminMessageId: results.adminMessageId,
      customerMessageId: results.customerMessageId
    };
  } catch (error) {
    console.error('[b2b-emails] Error sending registration request email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Send B2B Welcome email with credentials
 */
export async function sendWelcomeEmail(
  data: WelcomeEmailData,
  toEmail: string,
  loginUrl?: string,
  options?: { immediate?: boolean }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const branding = await getBranding();
    const finalLoginUrl = loginUrl || `${branding.shopUrl}/login`;

    const html = renderWelcomeEmail({
      branding,
      data,
      loginUrl: finalLoginUrl
    });

    const text = renderWelcomeEmailText({
      branding,
      data,
      loginUrl: finalLoginUrl
    });

    const result = await sendEmail({
      to: toEmail,
      subject: `Benvenuto su ${branding.companyName} - Le tue credenziali di accesso`,
      html,
      text,
      immediate: options?.immediate ?? true
    });

    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[b2b-emails] Error sending welcome email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Send B2B Forgot Password email with temporary password
 */
export async function sendForgotPasswordEmail(
  data: ForgotPasswordData,
  toEmail: string,
  loginUrl?: string,
  options?: { immediate?: boolean }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const branding = await getBranding();
    const finalLoginUrl = loginUrl || `${branding.shopUrl}/login`;

    const html = renderForgotPasswordEmail({
      branding,
      data,
      loginUrl: finalLoginUrl
    });

    const text = renderForgotPasswordEmailText({
      branding,
      data,
      loginUrl: finalLoginUrl
    });

    const result = await sendEmail({
      to: toEmail,
      subject: `La tua nuova password temporanea - ${branding.companyName}`,
      html,
      text,
      immediate: options?.immediate ?? true
    });

    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[b2b-emails] Error sending forgot password email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Send B2B Password Reset Confirmation email
 */
export async function sendResetPasswordEmail(
  data: ResetPasswordData,
  toEmail: string,
  loginUrl?: string,
  options?: { supportEmail?: string; immediate?: boolean }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const branding = await getBranding();
    const finalLoginUrl = loginUrl || `${branding.shopUrl}/login`;

    const html = renderResetPasswordEmail({
      branding,
      data,
      loginUrl: finalLoginUrl,
      supportEmail: options?.supportEmail
    });

    const text = renderResetPasswordEmailText({
      branding,
      data,
      loginUrl: finalLoginUrl,
      supportEmail: options?.supportEmail
    });

    const result = await sendEmail({
      to: toEmail,
      subject: `Password reimpostata con successo - ${branding.companyName}`,
      html,
      text,
      immediate: options?.immediate ?? true
    });

    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[b2b-emails] Error sending reset password email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Re-export types for convenience
export type {
  RegistrationRequestData,
  WelcomeEmailData,
  ForgotPasswordData,
  ResetPasswordData
};
