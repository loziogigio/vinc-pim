/**
 * B2B Welcome Email Template
 * Sent to new B2B customers with their credentials
 */

import { renderBaseTemplate, renderCredentialsBox, renderButton, type EmailBranding } from './base';

export interface WelcomeEmailData {
  ragioneSociale: string;
  username: string;
  password: string;
  contactName?: string;
}

export interface WelcomeEmailOptions {
  branding: EmailBranding;
  data: WelcomeEmailData;
  loginUrl: string;
}

export function renderWelcomeEmail(options: WelcomeEmailOptions): string {
  const { branding, data, loginUrl } = options;
  const { primaryColor, companyName } = branding;

  const greeting = data.contactName
    ? `Gentile ${data.contactName},`
    : `Gentile Cliente,`;

  const content = `
    <h2 style="margin: 0 0 24px 0; font-size: 22px; font-weight: 600; color: #1e293b;">
      Benvenuto su ${companyName}! 🎉
    </h2>

    <p style="margin: 0 0 16px 0; font-size: 15px; color: #475569; line-height: 1.6;">
      ${greeting}
    </p>

    <p style="margin: 0 0 16px 0; font-size: 15px; color: #475569; line-height: 1.6;">
      Siamo lieti di comunicarti che la tua richiesta di registrazione per
      <strong>${data.ragioneSociale}</strong> è stata approvata.
    </p>

    <p style="margin: 0 0 8px 0; font-size: 15px; color: #475569; line-height: 1.6;">
      Ora puoi accedere al nostro portale B2B per:
    </p>

    <ul style="margin: 0 0 24px 0; padding-left: 24px; font-size: 15px; color: #475569; line-height: 1.8;">
      <li>Consultare il catalogo prodotti completo</li>
      <li>Visualizzare i prezzi riservati ai rivenditori</li>
      <li>Effettuare ordini online</li>
      <li>Monitorare lo stato delle tue spedizioni</li>
    </ul>

    ${renderCredentialsBox(data.username, data.password, primaryColor)}

    <p style="margin: 0 0 8px 0; font-size: 14px; color: #dc2626; font-weight: 500;">
      ⚠️ Importante: Ti consigliamo di cambiare la password al primo accesso.
    </p>

    ${renderButton('Accedi al Portale', loginUrl, primaryColor)}

    <hr style="border: none; border-top: 1px solid #eaeef2; margin: 32px 0;" />

    <p style="margin: 0 0 8px 0; font-size: 15px; color: #475569;">
      Hai bisogno di assistenza?
    </p>
    <p style="margin: 0; font-size: 14px; color: #64748b;">
      Rispondi a questa email o contattaci per qualsiasi domanda.
      Il nostro team è a tua disposizione.
    </p>
  `;

  return renderBaseTemplate({
    branding,
    preheader: `Benvenuto su ${companyName}! Le tue credenziali di accesso sono pronte.`,
    content,
    footerText: `Grazie per aver scelto ${companyName} come tuo partner commerciale.`
  });
}

/**
 * Plain text version of the email
 */
export function renderWelcomeEmailText(options: WelcomeEmailOptions): string {
  const { branding, data, loginUrl } = options;

  const greeting = data.contactName
    ? `Gentile ${data.contactName},`
    : `Gentile Cliente,`;

  return `
BENVENUTO SU ${branding.companyName.toUpperCase()}!
=====================================

${greeting}

Siamo lieti di comunicarti che la tua richiesta di registrazione per ${data.ragioneSociale} è stata approvata.

LE TUE CREDENZIALI DI ACCESSO:
------------------------------
Username: ${data.username}
Password: ${data.password}

⚠️ Importante: Ti consigliamo di cambiare la password al primo accesso.

ACCEDI AL PORTALE:
${loginUrl}

Ora puoi:
- Consultare il catalogo prodotti completo
- Visualizzare i prezzi riservati ai rivenditori
- Effettuare ordini online
- Monitorare lo stato delle tue spedizioni

Hai bisogno di assistenza?
Rispondi a questa email o contattaci per qualsiasi domanda.

---
Grazie per aver scelto ${branding.companyName} come tuo partner commerciale.
  `.trim();
}
