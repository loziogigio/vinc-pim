/**
 * B2B Forgot Password Email Template
 * Sent when a user requests a password reset - sends temporary password
 */

import { renderBaseTemplate, renderButton, renderCredentialsBox, type EmailBranding } from './base';

export interface ForgotPasswordData {
  email: string;
  ragioneSociale?: string;
  contactName?: string;
  /** Temporary password generated for the user */
  tempPassword: string;
  /** @deprecated Use tempPassword instead */
  resetToken?: string;
}

export interface ForgotPasswordEmailOptions {
  branding: EmailBranding;
  data: ForgotPasswordData;
  loginUrl: string;
  /** @deprecated Use loginUrl instead */
  resetUrl?: string;
}

export function renderForgotPasswordEmail(options: ForgotPasswordEmailOptions): string {
  const { branding, data, loginUrl, resetUrl } = options;
  const { primaryColor, companyName } = branding;
  const finalLoginUrl = loginUrl || resetUrl || '#';

  const greeting = data.contactName
    ? `Ciao ${data.contactName},`
    : 'Ciao,';

  const content = `
    <h2 style="margin: 0 0 24px 0; font-size: 22px; font-weight: 600; color: #1e293b;">
      La tua Nuova Password Temporanea
    </h2>

    <p style="margin: 0 0 16px 0; font-size: 15px; color: #475569; line-height: 1.6;">
      ${greeting}
    </p>

    <p style="margin: 0 0 16px 0; font-size: 15px; color: #475569; line-height: 1.6;">
      Abbiamo ricevuto una richiesta per reimpostare la password del tuo account
      ${data.ragioneSociale ? `<strong>${data.ragioneSociale}</strong>` : ''}
      associato all'indirizzo email <strong>${data.email}</strong>.
    </p>

    <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569; line-height: 1.6;">
      Ecco la tua nuova password temporanea:
    </p>

    ${renderCredentialsBox(data.email, data.tempPassword, primaryColor)}

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; margin: 24px 0;">
      <tr>
        <td style="padding: 16px;">
          <p style="margin: 0; font-size: 14px; color: #92400e;">
            <strong>⚠️ Importante:</strong> Ti consigliamo di cambiare questa password temporanea
            dopo il primo accesso per motivi di sicurezza.
          </p>
        </td>
      </tr>
    </table>

    ${renderButton('Accedi al Portale', finalLoginUrl, primaryColor)}

    <hr style="border: none; border-top: 1px solid #eaeef2; margin: 32px 0;" />

    <p style="margin: 0; font-size: 13px; color: #94a3b8;">
      Se non hai richiesto tu il reset della password, contattaci immediatamente.
      Il tuo account potrebbe essere stato compromesso.
    </p>
  `;

  return renderBaseTemplate({
    branding,
    preheader: `La tua nuova password temporanea per ${companyName}`,
    content,
    footerText: `Questa è un'email automatica di sicurezza da ${companyName}.`
  });
}

/**
 * Plain text version of the email
 */
export function renderForgotPasswordEmailText(options: ForgotPasswordEmailOptions): string {
  const { branding, data, loginUrl, resetUrl } = options;
  const finalLoginUrl = loginUrl || resetUrl || '';

  const greeting = data.contactName
    ? `Ciao ${data.contactName},`
    : 'Ciao,';

  return `
LA TUA NUOVA PASSWORD TEMPORANEA
================================

${branding.companyName}

${greeting}

Abbiamo ricevuto una richiesta per reimpostare la password del tuo account${data.ragioneSociale ? ` ${data.ragioneSociale}` : ''} associato all'indirizzo email ${data.email}.

LE TUE NUOVE CREDENZIALI:
-------------------------
Username: ${data.email}
Password: ${data.tempPassword}

⚠️ IMPORTANTE: Ti consigliamo di cambiare questa password temporanea dopo il primo accesso per motivi di sicurezza.

ACCEDI AL PORTALE:
${finalLoginUrl}

---

Se non hai richiesto tu il reset della password, contattaci immediatamente. Il tuo account potrebbe essere stato compromesso.

---
Questa è un'email automatica di sicurezza da ${branding.companyName}.
  `.trim();
}
