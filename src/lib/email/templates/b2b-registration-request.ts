/**
 * B2B Registration Request Email Template
 * Sent to admin when a new business requests registration
 */

import { renderBaseTemplate, renderInfoBox, renderButton, type EmailBranding } from './base';

export interface RegistrationRequestData {
  ragioneSociale: string;
  email: string;
  comune: string;
  indirizzo: string;
  telefono: string;
  partitaIva: string;
  sdi: string;
  submittedAt?: Date;
}

export interface RegistrationRequestEmailOptions {
  branding: EmailBranding;
  data: RegistrationRequestData;
  adminUrl?: string;
}

export function renderRegistrationRequestEmail(options: RegistrationRequestEmailOptions): string {
  const { branding, data, adminUrl } = options;
  const { primaryColor } = branding;

  const submittedDate = data.submittedAt
    ? new Intl.DateTimeFormat('it-IT', {
        dateStyle: 'long',
        timeStyle: 'short'
      }).format(data.submittedAt)
    : new Intl.DateTimeFormat('it-IT', {
        dateStyle: 'long',
        timeStyle: 'short'
      }).format(new Date());

  const infoItems = [
    { label: 'Ragione Sociale', value: data.ragioneSociale },
    { label: 'Email', value: data.email },
    { label: 'Comune', value: data.comune },
    { label: 'Indirizzo', value: data.indirizzo },
    { label: 'Telefono', value: data.telefono },
    { label: 'Partita IVA', value: data.partitaIva },
    { label: 'Codice SDI', value: data.sdi || 'Non specificato' },
  ];

  const content = `
    <h2 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 600; color: #1e293b;">
      Nuova Richiesta di Registrazione B2B
    </h2>
    <p style="margin: 0 0 24px 0; font-size: 15px; color: #64748b;">
      Ricevuta il ${submittedDate}
    </p>

    <p style="margin: 0 0 16px 0; font-size: 15px; color: #475569; line-height: 1.6;">
      È stata ricevuta una nuova richiesta di registrazione come cliente B2B.
      Di seguito i dettagli forniti:
    </p>

    ${renderInfoBox(infoItems)}

    <p style="margin: 24px 0 16px 0; font-size: 15px; color: #475569; line-height: 1.6;">
      Per approvare o rifiutare questa richiesta, accedi al pannello di amministrazione.
    </p>

    ${adminUrl ? renderButton('Gestisci Richiesta', adminUrl, primaryColor) : ''}

    <hr style="border: none; border-top: 1px solid #eaeef2; margin: 32px 0;" />

    <p style="margin: 0; font-size: 13px; color: #94a3b8;">
      Questa è una notifica automatica. Rispondi a questa email per contattare direttamente il richiedente.
    </p>
  `;

  return renderBaseTemplate({
    branding,
    preheader: `Nuova richiesta di registrazione B2B da ${data.ragioneSociale}`,
    content,
    footerText: 'Notifica di sistema - Richiesta di registrazione B2B'
  });
}

/**
 * Plain text version of the admin email
 */
export function renderRegistrationRequestEmailText(options: RegistrationRequestEmailOptions): string {
  const { branding, data } = options;

  return `
NUOVA RICHIESTA DI REGISTRAZIONE B2B
=====================================

${branding.companyName}

È stata ricevuta una nuova richiesta di registrazione:

Ragione Sociale: ${data.ragioneSociale}
Email: ${data.email}
Comune: ${data.comune}
Indirizzo: ${data.indirizzo}
Telefono: ${data.telefono}
Partita IVA: ${data.partitaIva}
Codice SDI: ${data.sdi || 'Non specificato'}

Per gestire questa richiesta, accedi al pannello di amministrazione.

---
${branding.companyName}
  `.trim();
}

// ============================================
// CUSTOMER CONFIRMATION EMAIL
// ============================================

export interface CustomerConfirmationEmailOptions {
  branding: EmailBranding;
  data: RegistrationRequestData;
  shopUrl?: string;
}

/**
 * Customer confirmation email - sent to the person who submitted the registration request
 */
export function renderCustomerConfirmationEmail(options: CustomerConfirmationEmailOptions): string {
  const { branding, data, shopUrl } = options;
  const { primaryColor, companyName } = branding;

  const submittedDate = data.submittedAt
    ? new Intl.DateTimeFormat('it-IT', {
        dateStyle: 'long',
        timeStyle: 'short'
      }).format(data.submittedAt)
    : new Intl.DateTimeFormat('it-IT', {
        dateStyle: 'long',
        timeStyle: 'short'
      }).format(new Date());

  const infoItems = [
    { label: 'Ragione Sociale', value: data.ragioneSociale },
    { label: 'Email', value: data.email },
    { label: 'Comune', value: data.comune },
    { label: 'Indirizzo', value: data.indirizzo },
    { label: 'Telefono', value: data.telefono },
    { label: 'Partita IVA', value: data.partitaIva },
    { label: 'Codice SDI', value: data.sdi || 'Non specificato' },
  ];

  const content = `
    <h2 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 600; color: #1e293b;">
      Richiesta di Registrazione Ricevuta
    </h2>
    <p style="margin: 0 0 24px 0; font-size: 15px; color: #64748b;">
      Inviata il ${submittedDate}
    </p>

    <p style="margin: 0 0 16px 0; font-size: 15px; color: #475569; line-height: 1.6;">
      Gentile <strong>${data.ragioneSociale}</strong>,
    </p>

    <p style="margin: 0 0 16px 0; font-size: 15px; color: #475569; line-height: 1.6;">
      Abbiamo ricevuto la tua richiesta di registrazione come cliente B2B su <strong>${companyName}</strong>.
      Di seguito un riepilogo dei dati inviati:
    </p>

    ${renderInfoBox(infoItems)}

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; margin: 24px 0;">
      <tr>
        <td style="padding: 16px;">
          <p style="margin: 0; font-size: 14px; color: #0369a1;">
            <strong>Cosa succede ora?</strong><br>
            Il nostro team verificherà i tuoi dati e ti contatterà al più presto per completare la registrazione.
            Riceverai un'email con le tue credenziali di accesso una volta approvata la richiesta.
          </p>
        </td>
      </tr>
    </table>

    ${shopUrl ? renderButton('Visita il Nostro Sito', shopUrl, primaryColor) : ''}

    <hr style="border: none; border-top: 1px solid #eaeef2; margin: 32px 0;" />

    <p style="margin: 0; font-size: 13px; color: #94a3b8;">
      Se non hai richiesto tu questa registrazione, puoi ignorare questa email.
    </p>
  `;

  return renderBaseTemplate({
    branding,
    preheader: `Conferma richiesta di registrazione B2B - ${companyName}`,
    content,
    footerText: `Grazie per aver scelto ${companyName}!`
  });
}

/**
 * Plain text version of the customer confirmation email
 */
export function renderCustomerConfirmationEmailText(options: CustomerConfirmationEmailOptions): string {
  const { branding, data } = options;

  const submittedDate = data.submittedAt
    ? new Intl.DateTimeFormat('it-IT', {
        dateStyle: 'long',
        timeStyle: 'short'
      }).format(data.submittedAt)
    : new Intl.DateTimeFormat('it-IT', {
        dateStyle: 'long',
        timeStyle: 'short'
      }).format(new Date());

  return `
RICHIESTA DI REGISTRAZIONE RICEVUTA
====================================

${branding.companyName}

Gentile ${data.ragioneSociale},

Abbiamo ricevuto la tua richiesta di registrazione come cliente B2B su ${branding.companyName}.
Di seguito un riepilogo dei dati inviati:

Ragione Sociale: ${data.ragioneSociale}
Email: ${data.email}
Comune: ${data.comune}
Indirizzo: ${data.indirizzo}
Telefono: ${data.telefono}
Partita IVA: ${data.partitaIva}
Codice SDI: ${data.sdi || 'Non specificato'}

COSA SUCCEDE ORA?
-----------------
Il nostro team verificherà i tuoi dati e ti contatterà al più presto per completare la registrazione.
Riceverai un'email con le tue credenziali di accesso una volta approvata la richiesta.

---
Se non hai richiesto tu questa registrazione, puoi ignorare questa email.

Grazie per aver scelto ${branding.companyName}!
  `.trim();
}
