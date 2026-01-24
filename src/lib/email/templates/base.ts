/**
 * Base email template with B2B branding
 */

import type { CompanyContactInfo } from "@/lib/types/home-settings";

export interface EmailBranding {
  companyName: string;
  logo?: string;
  primaryColor: string;
  secondaryColor: string;
  /** Company contact info for email footer */
  companyInfo?: CompanyContactInfo;
}

export interface BaseEmailOptions {
  branding: EmailBranding;
  preheader?: string;
  content: string;
  footerText?: string;
}

/**
 * Wraps email content in a branded base layout
 */
export function renderBaseTemplate(options: BaseEmailOptions): string {
  const { branding, preheader, content, footerText } = options;
  const { companyName, logo, primaryColor, companyInfo } = branding;

  const currentYear = new Date().getFullYear();

  // Extract company contact info with fallbacks
  const legalName = companyInfo?.legal_name || companyName;
  const addressLine1 = companyInfo?.address_line1 || "";
  const addressLine2 = companyInfo?.address_line2 || "";
  const phone = companyInfo?.phone || "";
  const email = companyInfo?.email || "";
  const businessHours = companyInfo?.business_hours || "";

  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${companyName}</title>
  ${preheader ? `<span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>` : ''}
  <style>
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 20px !important; }
      .content { padding: 24px !important; }
      .button { width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f6fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f6fa;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" class="container" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 32px 40px; border-bottom: 1px solid #eaeef2;">
              ${logo
                ? `<img src="${logo}" alt="${companyName}" style="max-height: 48px; max-width: 200px;" />`
                : `<h1 style="margin: 0; font-size: 24px; font-weight: 700; color: ${primaryColor};">${companyName}</h1>`
              }
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="content" style="padding: 40px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8f9fb; border-radius: 0 0 12px 12px; border-top: 1px solid #eaeef2;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <!-- No-reply notice -->
                    <p style="margin: 0 0 16px 0; padding: 12px 16px; background-color: #fef3c7; border-radius: 6px; font-size: 12px; color: #92400e;">
                      ⚠️ Questa è un'email automatica. Non rispondere a questo messaggio.
                    </p>

                    ${footerText ? `<p style="margin: 0 0 16px 0; font-size: 13px; color: #64748b;">${footerText}</p>` : ''}

                    <!-- Company info -->
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                      <tr>
                        <td align="center">
                          <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #1e293b;">${legalName}</p>
                          ${addressLine1 || addressLine2 ? `
                          <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;">
                            ${[addressLine1, addressLine2].filter(Boolean).join(" - ")}
                          </p>
                          ` : ''}
                          ${phone || email ? `
                          <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b;">
                            ${[
                              phone ? `📞 ${phone}` : '',
                              email ? `✉️ ${email}` : ''
                            ].filter(Boolean).join(' &nbsp;|&nbsp; ')}
                          </p>
                          ` : ''}
                          ${businessHours ? `
                          <p style="margin: 0 0 12px 0; font-size: 12px; color: #64748b;">
                            🕐 ${businessHours}
                          </p>
                          ` : ''}
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                      &copy; ${currentYear} ${companyName}. Tutti i diritti riservati.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Renders a primary action button
 */
export function renderButton(text: string, url: string, primaryColor: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
      <tr>
        <td align="center" style="border-radius: 8px; background-color: ${primaryColor};">
          <a href="${url}" target="_blank" class="button" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `.trim();
}

/**
 * Renders an info box with key-value pairs
 */
export function renderInfoBox(items: Array<{ label: string; value: string }>, bgColor = '#f8f9fb'): string {
  const rows = items.map(item => `
    <tr>
      <td style="padding: 8px 16px; font-size: 14px; color: #64748b; border-bottom: 1px solid #eaeef2;">${item.label}</td>
      <td style="padding: 8px 16px; font-size: 14px; color: #1e293b; font-weight: 500; border-bottom: 1px solid #eaeef2;">${item.value}</td>
    </tr>
  `).join('');

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${bgColor}; border-radius: 8px; margin: 16px 0;">
      ${rows}
    </table>
  `.trim();
}

/**
 * Renders credentials box (for welcome email)
 */
export function renderCredentialsBox(username: string, password: string, primaryColor: string): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; margin: 24px 0;">
      <tr>
        <td style="padding: 20px;">
          <p style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #166534;">Le tue credenziali di accesso:</p>
          <table role="presentation" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding: 4px 0; font-size: 14px; color: #64748b; width: 100px;">Username:</td>
              <td style="padding: 4px 0; font-size: 14px; color: #1e293b; font-weight: 600;">${username}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-size: 14px; color: #64748b;">Password:</td>
              <td style="padding: 4px 0; font-size: 14px; color: #1e293b; font-weight: 600; font-family: monospace; background-color: #f1f5f9; padding: 4px 8px; border-radius: 4px;">${password}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `.trim();
}
