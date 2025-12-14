/**
 * B2B Reset Password Confirmation Email Template
 * Sent after a user successfully resets their password
 */

import { renderBaseTemplate, renderButton, type EmailBranding } from './base';

export interface ResetPasswordData {
  email: string;
  ragioneSociale?: string;
  contactName?: string;
  resetAt?: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface ResetPasswordEmailOptions {
  branding: EmailBranding;
  data: ResetPasswordData;
  loginUrl: string;
  supportEmail?: string;
}

export function renderResetPasswordEmail(options: ResetPasswordEmailOptions): string {
  const { branding, data, loginUrl, supportEmail } = options;
  const { primaryColor, companyName } = branding;

  const greeting = data.contactName
    ? `Ciao ${data.contactName},`
    : 'Ciao,';

  const resetDate = data.resetAt
    ? new Intl.DateTimeFormat('it-IT', {
        dateStyle: 'long',
        timeStyle: 'short'
      }).format(data.resetAt)
    : new Intl.DateTimeFormat('it-IT', {
        dateStyle: 'long',
        timeStyle: 'short'
      }).format(new Date());

  const content = `
    <h2 style="margin: 0 0 24px 0; font-size: 22px; font-weight: 600; color: #1e293b;">
      Password Reimpostata con Successo ✓
    </h2>

    <p style="margin: 0 0 16px 0; font-size: 15px; color: #475569; line-height: 1.6;">
      ${greeting}
    </p>

    <p style="margin: 0 0 16px 0; font-size: 15px; color: #475569; line-height: 1.6;">
      La password del tuo account ${data.ragioneSociale ? `<strong>${data.ragioneSociale}</strong>` : ''}
      è stata reimpostata con successo il <strong>${resetDate}</strong>.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; margin: 24px 0;">
      <tr>
        <td style="padding: 16px;">
          <p style="margin: 0; font-size: 14px; color: #166534;">
            <strong>✓ La tua password è stata aggiornata.</strong><br>
            Ora puoi accedere al portale con la tua nuova password.
          </p>
        </td>
      </tr>
    </table>

    ${renderButton('Accedi al Portale', loginUrl, primaryColor)}

    <hr style="border: none; border-top: 1px solid #eaeef2; margin: 32px 0;" />

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; margin: 24px 0;">
      <tr>
        <td style="padding: 16px;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #991b1b; font-weight: 600;">
            ⚠️ Non sei stato tu?
          </p>
          <p style="margin: 0; font-size: 14px; color: #991b1b;">
            Se non hai richiesto tu questa modifica, il tuo account potrebbe essere stato compromesso.
            ${supportEmail
              ? `Contattaci immediatamente a <a href="mailto:${supportEmail}" style="color: #991b1b; font-weight: 600;">${supportEmail}</a>.`
              : 'Contattaci immediatamente rispondendo a questa email.'
            }
          </p>
        </td>
      </tr>
    </table>

    ${data.ipAddress || data.userAgent ? `
    <p style="margin: 24px 0 8px 0; font-size: 13px; color: #94a3b8;">
      Dettagli della modifica:
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="font-size: 12px; color: #64748b;">
      ${data.ipAddress ? `<tr><td style="padding: 2px 16px 2px 0;">IP Address:</td><td>${data.ipAddress}</td></tr>` : ''}
      ${data.userAgent ? `<tr><td style="padding: 2px 16px 2px 0;">Browser:</td><td>${data.userAgent}</td></tr>` : ''}
    </table>
    ` : ''}
  `;

  return renderBaseTemplate({
    branding,
    preheader: `La tua password ${companyName} è stata reimpostata con successo`,
    content,
    footerText: `Questa è un'email automatica di sicurezza da ${companyName}.`
  });
}

/**
 * Plain text version of the email
 */
export function renderResetPasswordEmailText(options: ResetPasswordEmailOptions): string {
  const { branding, data, loginUrl, supportEmail } = options;

  const greeting = data.contactName
    ? `Ciao ${data.contactName},`
    : 'Ciao,';

  const resetDate = data.resetAt
    ? new Intl.DateTimeFormat('it-IT', {
        dateStyle: 'long',
        timeStyle: 'short'
      }).format(data.resetAt)
    : new Intl.DateTimeFormat('it-IT', {
        dateStyle: 'long',
        timeStyle: 'short'
      }).format(new Date());

  return `
PASSWORD REIMPOSTATA CON SUCCESSO
=================================

${branding.companyName}

${greeting}

La password del tuo account${data.ragioneSociale ? ` ${data.ragioneSociale}` : ''} è stata reimpostata con successo il ${resetDate}.

✓ La tua password è stata aggiornata.
Ora puoi accedere al portale con la tua nuova password.

ACCEDI AL PORTALE:
${loginUrl}

---

⚠️ NON SEI STATO TU?

Se non hai richiesto tu questa modifica, il tuo account potrebbe essere stato compromesso.
${supportEmail
  ? `Contattaci immediatamente a ${supportEmail}.`
  : 'Contattaci immediatamente rispondendo a questa email.'
}

${data.ipAddress || data.userAgent ? `
Dettagli della modifica:
${data.ipAddress ? `IP Address: ${data.ipAddress}` : ''}
${data.userAgent ? `Browser: ${data.userAgent}` : ''}
` : ''}

---
Questa è un'email automatica di sicurezza da ${branding.companyName}.
  `.trim();
}
