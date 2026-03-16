/**
 * Seed Default Notification Templates
 *
 * Seeds 11 default notification templates:
 * - 5 Account templates (registration, welcome, forgot password, reset password)
 * - 4 Order templates (confirmation, shipped, delivered, cancelled)
 * - 2 Marketing templates (back in stock, newsletter)
 */

import { connectWithModels } from "@/lib/db/connection";
import type { INotificationTemplate, NotificationTrigger } from "@/lib/db/models/notification-template";

// ============================================
// DEFAULT TEMPLATE DEFINITIONS
// ============================================

interface DefaultTemplate {
  template_id: string;
  name: string;
  description: string;
  trigger: NotificationTrigger;
  variables: string[];
  email_subject: string;
  email_html: string;
}

const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  // ============================================
  // ACCOUNT TEMPLATES (5)
  // ============================================
  {
    template_id: "registration_request_admin",
    name: "Nuova Richiesta Registrazione (Admin)",
    description: "Notifica all'amministratore quando un nuovo cliente richiede la registrazione B2B. Contiene i dati aziendali del richiedente.",
    trigger: "registration_request_admin",
    variables: ["company_name", "email", "phone", "address", "vat_number", "admin_url"],
    email_subject: "Nuova Richiesta di Registrazione B2B - {{company_name}}",
    email_html: `
<h2 style="color: #1e293b; margin: 0 0 16px 0;">Nuova Richiesta di Registrazione B2B</h2>
<p style="color: #64748b; margin: 0 0 24px 0;">È stata ricevuta una nuova richiesta di registrazione al portale B2B.</p>

<div style="background-color: #f8f9fb; border-radius: 8px; padding: 20px; margin: 16px 0;">
  <h3 style="margin: 0 0 12px 0; color: #1e293b; font-size: 14px;">Dati Azienda</h3>
  <table style="width: 100%; font-size: 14px;">
    <tr><td style="padding: 4px 0; color: #64748b;">Ragione Sociale:</td><td style="color: #1e293b; font-weight: 500;">{{company_name}}</td></tr>
    <tr><td style="padding: 4px 0; color: #64748b;">Email:</td><td style="color: #1e293b;">{{email}}</td></tr>
    <tr><td style="padding: 4px 0; color: #64748b;">Telefono:</td><td style="color: #1e293b;">{{phone}}</td></tr>
    <tr><td style="padding: 4px 0; color: #64748b;">Indirizzo:</td><td style="color: #1e293b;">{{address}}</td></tr>
    <tr><td style="padding: 4px 0; color: #64748b;">P.IVA:</td><td style="color: #1e293b;">{{vat_number}}</td></tr>
  </table>
</div>

<p style="margin: 24px 0 0 0;">
  <a href="{{admin_url}}" style="display: inline-block; padding: 12px 24px; background-color: {{primary_color}}; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
    Gestisci Richiesta
  </a>
</p>
    `.trim()
  },
  {
    template_id: "registration_request_customer",
    name: "Conferma Richiesta Registrazione",
    description: "Conferma al cliente che la sua richiesta di registrazione è stata ricevuta e sarà valutata.",
    trigger: "registration_request_customer",
    variables: ["customer_name", "company_name", "shop_name"],
    email_subject: "Richiesta di Registrazione Ricevuta - {{shop_name}}",
    email_html: `
<h2 style="color: #1e293b; margin: 0 0 16px 0;">Grazie per la tua richiesta!</h2>
<p style="color: #64748b; margin: 0 0 16px 0;">Gentile {{customer_name}},</p>
<p style="color: #64748b; margin: 0 0 24px 0;">
  Abbiamo ricevuto la tua richiesta di registrazione per <strong>{{company_name}}</strong> al nostro portale B2B.
</p>
<p style="color: #64748b; margin: 0 0 24px 0;">
  Il nostro team verificherà i dati forniti e ti invierà una comunicazione con le credenziali di accesso
  non appena l'account sarà attivato.
</p>
<p style="color: #64748b; margin: 0;">
  Se hai domande nel frattempo, non esitare a contattarci.
</p>
    `.trim()
  },
  {
    template_id: "welcome",
    name: "Benvenuto - Credenziali Accesso",
    description: "Email di benvenuto con username e password per accedere al portale B2B. Inviata dopo approvazione.",
    trigger: "welcome",
    variables: ["customer_name", "company_name", "username", "password", "login_url", "shop_name"],
    email_subject: "Benvenuto su {{shop_name}} - Le tue credenziali di accesso",
    email_html: `
<h2 style="color: #1e293b; margin: 0 0 16px 0;">Benvenuto su {{shop_name}}!</h2>
<p style="color: #64748b; margin: 0 0 16px 0;">Gentile {{customer_name}},</p>
<p style="color: #64748b; margin: 0 0 24px 0;">
  Il tuo account B2B per <strong>{{company_name}}</strong> è stato attivato con successo.
</p>

<div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 24px 0;">
  <h3 style="margin: 0 0 12px 0; color: #166534; font-size: 14px;">Le tue credenziali di accesso:</h3>
  <table style="font-size: 14px;">
    <tr><td style="padding: 4px 0; color: #64748b; width: 100px;">Username:</td><td style="color: #1e293b; font-weight: 600;">{{username}}</td></tr>
    <tr><td style="padding: 4px 0; color: #64748b;">Password:</td><td style="color: #1e293b; font-weight: 600; font-family: monospace; background: #f1f5f9; padding: 2px 8px; border-radius: 4px;">{{password}}</td></tr>
  </table>
</div>

<p style="margin: 0 0 24px 0;">
  <a href="{{login_url}}" style="display: inline-block; padding: 12px 24px; background-color: {{primary_color}}; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
    Accedi al Portale
  </a>
</p>

<p style="color: #94a3b8; font-size: 12px; margin: 16px 0 0 0;">
  Per motivi di sicurezza, ti consigliamo di cambiare la password al primo accesso.
</p>
    `.trim()
  },
  {
    template_id: "welcome_self_registration",
    name: "Benvenuto - Registrazione Autonoma",
    description: "Email di benvenuto per clienti che si registrano autonomamente. Senza credenziali (il cliente conosce già la password).",
    trigger: "welcome_self_registration",
    variables: ["customer_name", "company_name", "login_url", "shop_name"],
    email_subject: "Benvenuto su {{shop_name}}!",
    email_html: `
<h2 style="color: #1e293b; margin: 0 0 16px 0;">Benvenuto su {{shop_name}}!</h2>
<p style="color: #64748b; margin: 0 0 16px 0;">Gentile {{customer_name}},</p>
<p style="color: #64748b; margin: 0 0 24px 0;">
  Il tuo account{{#if company_name}} per <strong>{{company_name}}</strong>{{/if}} è stato creato con successo.
</p>

<p style="color: #64748b; margin: 0 0 24px 0;">
  Puoi accedere al portale in qualsiasi momento con le credenziali che hai scelto durante la registrazione.
</p>

<p style="margin: 0 0 24px 0;">
  <a href="{{login_url}}" style="display: inline-block; padding: 12px 24px; background-color: {{primary_color}}; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
    Accedi al Portale
  </a>
</p>

<p style="color: #94a3b8; font-size: 12px; margin: 16px 0 0 0;">
  Se non hai effettuato questa registrazione, puoi ignorare questa email.
</p>
    `.trim()
  },
  {
    template_id: "forgot_password",
    name: "Password Temporanea",
    description: "Invia una password temporanea al cliente che ha dimenticato le credenziali.",
    trigger: "forgot_password",
    variables: ["customer_name", "temporary_password", "login_url", "shop_name"],
    email_subject: "La tua nuova password temporanea - {{shop_name}}",
    email_html: `
<h2 style="color: #1e293b; margin: 0 0 16px 0;">Password Temporanea</h2>
<p style="color: #64748b; margin: 0 0 16px 0;">Gentile {{customer_name}},</p>
<p style="color: #64748b; margin: 0 0 24px 0;">
  Hai richiesto il ripristino della password. Ecco la tua nuova password temporanea:
</p>

<div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
  <p style="margin: 0 0 8px 0; color: #92400e; font-size: 12px;">La tua password temporanea:</p>
  <p style="margin: 0; font-size: 24px; font-weight: 700; font-family: monospace; color: #1e293b; letter-spacing: 2px;">
    {{temporary_password}}
  </p>
</div>

<p style="margin: 0 0 24px 0;">
  <a href="{{login_url}}" style="display: inline-block; padding: 12px 24px; background-color: {{primary_color}}; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
    Accedi al Portale
  </a>
</p>

<p style="color: #94a3b8; font-size: 12px; margin: 16px 0 0 0;">
  Ti consigliamo di cambiare la password al primo accesso.
</p>
    `.trim()
  },
  {
    template_id: "reset_password",
    name: "Conferma Cambio Password",
    description: "Conferma che la password è stata cambiata con successo. Include info di sicurezza (IP, data).",
    trigger: "reset_password",
    variables: ["customer_name", "reset_date", "ip_address", "login_url", "support_email", "shop_name"],
    email_subject: "Password reimpostata con successo - {{shop_name}}",
    email_html: `
<h2 style="color: #1e293b; margin: 0 0 16px 0;">Password Aggiornata</h2>
<p style="color: #64748b; margin: 0 0 16px 0;">Gentile {{customer_name}},</p>
<p style="color: #64748b; margin: 0 0 24px 0;">
  La tua password è stata cambiata con successo.
</p>

<div style="background-color: #f8f9fb; border-radius: 8px; padding: 16px; margin: 16px 0;">
  <p style="margin: 0; color: #64748b; font-size: 12px;">
    <strong>Data:</strong> {{reset_date}}<br>
    <strong>IP:</strong> {{ip_address}}
  </p>
</div>

<p style="color: #ef4444; font-size: 13px; margin: 16px 0;">
  Se non hai effettuato questa modifica, contattaci immediatamente a <a href="mailto:{{support_email}}">{{support_email}}</a>.
</p>

<p style="margin: 24px 0 0 0;">
  <a href="{{login_url}}" style="display: inline-block; padding: 12px 24px; background-color: {{primary_color}}; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
    Accedi al Portale
  </a>
</p>
    `.trim()
  },

  // ============================================
  // ORDER TEMPLATES (4)
  // ============================================
  {
    template_id: "order_confirmation",
    name: "Conferma Ordine",
    description: "Riepilogo completo dell'ordine: prodotti, totali, indirizzi, pagamento e coordinate bancarie per bonifico.",
    trigger: "order_confirmation",
    variables: [
      "customer_name", "order_number", "order_date", "order_total", "order_url", "shop_name",
      "shipping_address", "billing_address", "order_items_html", "items_count",
      "subtotal_net", "total_discount", "total_vat", "shipping_cost", "coupon_code", "coupon_discount",
      "payment_method", "payment_terms", "customer_notes",
      "invoice_company_name", "invoice_vat_number", "invoice_fiscal_code", "invoice_pec", "invoice_sdi",
      "bank_iban", "bank_beneficiary", "bank_bic_swift", "bank_name", "bank_causale",
    ],
    email_subject: "Conferma Ordine {{order_number}} - {{shop_name}}",
    email_html: `
<!--
  Outlook-bulletproof order confirmation email.
  All layout uses tables — no divs for structure.
  No border-radius (Outlook ignores it).
  All styles inline.
-->

<!-- Heading -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td style="padding: 0 0 8px 0;">
      <h2 style="color: #1e293b; margin: 0; font-size: 22px; font-weight: 700;">Ordine Confermato!</h2>
    </td>
  </tr>
  <tr>
    <td style="padding: 0 0 4px 0; color: #64748b; font-size: 15px;">
      Gentile {{customer_name}},
    </td>
  </tr>
  <tr>
    <td style="padding: 0 0 24px 0; color: #64748b; font-size: 14px;">
      Grazie per il tuo ordine! Abbiamo ricevuto la tua richiesta e la stiamo elaborando.
    </td>
  </tr>
</table>

<!-- Order Summary Box -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse; margin-bottom: 24px;">
  <tr>
    <td bgcolor="#f0fdf4" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 14px;">
        <tr>
          <td style="color: #64748b; padding: 4px 0;">Numero Ordine:</td>
          <td style="color: #1e293b; font-weight: 600; text-align: right; padding: 4px 0;">{{order_number}}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 4px 0;">Data:</td>
          <td style="color: #1e293b; text-align: right; padding: 4px 0;">{{order_date}}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 4px 0;">Articoli:</td>
          <td style="color: #1e293b; text-align: right; padding: 4px 0;">{{items_count}}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 4px 0;">Totale Ordine:</td>
          <td style="color: #166534; font-weight: 700; text-align: right; padding: 4px 0; font-size: 18px;">{{order_total}}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<!-- Line Items Table -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse; margin-bottom: 8px;">
  <tr>
    <td style="padding: 0 0 8px 0;">
      <h3 style="color: #1e293b; margin: 0; font-size: 15px; font-weight: 600;">Prodotti ordinati</h3>
    </td>
  </tr>
</table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse; margin-bottom: 4px;">
  <tr>
    <td style="padding: 8px; border-bottom: 2px solid #cbd5e1;" width="52"></td>
    <td style="padding: 8px; border-bottom: 2px solid #cbd5e1; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Prodotto</td>
    <td style="padding: 8px; border-bottom: 2px solid #cbd5e1; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; text-align: center;" width="50">Qt&agrave;</td>
    <td style="padding: 8px; border-bottom: 2px solid #cbd5e1; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; text-align: right;" width="90">Prezzo</td>
    <td style="padding: 8px; border-bottom: 2px solid #cbd5e1; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; text-align: right;" width="100">Totale</td>
  </tr>
  {{order_items_html}}
</table>

<!-- Totals Breakdown -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse; margin-bottom: 24px;">
  <tr>
    <td width="50%">&nbsp;</td>
    <td width="50%">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 14px;">
        <tr>
          <td style="color: #64748b; padding: 6px 0;">Subtotale:</td>
          <td style="color: #1e293b; text-align: right; padding: 6px 0;">{{subtotal_net}}</td>
        </tr>
        {{#if coupon_code}}
        <tr>
          <td style="color: #059669; padding: 6px 0;">Coupon {{coupon_code}}:</td>
          <td style="color: #059669; text-align: right; padding: 6px 0;">-{{coupon_discount}}</td>
        </tr>
        {{/if}}
        {{#if total_discount}}
        <tr>
          <td style="color: #dc2626; padding: 6px 0;">Sconto:</td>
          <td style="color: #dc2626; text-align: right; padding: 6px 0;">-{{total_discount}}</td>
        </tr>
        {{/if}}
        {{#if shipping_cost}}
        <tr>
          <td style="color: #64748b; padding: 6px 0;">Spedizione:</td>
          <td style="color: #1e293b; text-align: right; padding: 6px 0;">{{shipping_cost}}</td>
        </tr>
        {{/if}}
        {{#if total_vat}}
        <tr>
          <td style="color: #64748b; padding: 6px 0;">IVA:</td>
          <td style="color: #1e293b; text-align: right; padding: 6px 0;">{{total_vat}}</td>
        </tr>
        {{/if}}
        <tr>
          <td style="color: #1e293b; font-weight: 700; padding: 8px 0; border-top: 2px solid #1e293b; font-size: 16px;">Totale:</td>
          <td style="color: #166534; font-weight: 700; text-align: right; padding: 8px 0; border-top: 2px solid #1e293b; font-size: 16px;">{{order_total}}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<!-- Addresses -->
{{#if shipping_address}}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse; margin-bottom: {{#if billing_address}}8{{else}}24{{/if}}px;">
  <tr>
    <td bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px;">
      <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 13px; font-weight: 600;">Indirizzo di Spedizione</h4>
      <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.5;">{{shipping_address}}</p>
    </td>
  </tr>
</table>
{{/if}}
{{#if billing_address}}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse; margin-bottom: 24px;">
  <tr>
    <td bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px;">
      <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 13px; font-weight: 600;">Indirizzo di Fatturazione</h4>
      <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.5;">{{billing_address}}</p>
    </td>
  </tr>
</table>
{{/if}}

<!-- Customer Notes -->
{{#if customer_notes}}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse; margin-bottom: 24px;">
  <tr>
    <td bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px;">
      <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 13px; font-weight: 600;">Nota d&#39;Ordine</h4>
      <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.5;">{{customer_notes}}</p>
    </td>
  </tr>
</table>
{{/if}}

<!-- Invoice / Business Data -->
{{#if invoice_vat_number}}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse; margin-bottom: 24px;">
  <tr>
    <td bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px;">
      <h4 style="margin: 0 0 10px 0; color: #1e293b; font-size: 13px; font-weight: 600;">Dati di Fatturazione</h4>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 13px;">
        {{#if invoice_company_name}}
        <tr>
          <td style="color: #64748b; padding: 3px 0;" width="120">Ragione Sociale:</td>
          <td style="color: #1e293b; font-weight: 500; padding: 3px 0;">{{invoice_company_name}}</td>
        </tr>
        {{/if}}
        <tr>
          <td style="color: #64748b; padding: 3px 0;">P.IVA:</td>
          <td style="color: #1e293b; padding: 3px 0;">{{invoice_vat_number}}</td>
        </tr>
        {{#if invoice_fiscal_code}}
        <tr>
          <td style="color: #64748b; padding: 3px 0;">Codice Fiscale:</td>
          <td style="color: #1e293b; padding: 3px 0;">{{invoice_fiscal_code}}</td>
        </tr>
        {{/if}}
        {{#if invoice_sdi}}
        <tr>
          <td style="color: #64748b; padding: 3px 0;">Codice SDI:</td>
          <td style="color: #1e293b; padding: 3px 0;">{{invoice_sdi}}</td>
        </tr>
        {{/if}}
        {{#if invoice_pec}}
        <tr>
          <td style="color: #64748b; padding: 3px 0;">PEC:</td>
          <td style="color: #1e293b; padding: 3px 0;">{{invoice_pec}}</td>
        </tr>
        {{/if}}
      </table>
    </td>
  </tr>
</table>
{{else}}
{{#if invoice_fiscal_code}}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse; margin-bottom: 24px;">
  <tr>
    <td bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px;">
      <h4 style="margin: 0 0 10px 0; color: #1e293b; font-size: 13px; font-weight: 600;">Dati di Fatturazione</h4>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 13px;">
        <tr>
          <td style="color: #64748b; padding: 3px 0;" width="120">Codice Fiscale:</td>
          <td style="color: #1e293b; padding: 3px 0;">{{invoice_fiscal_code}}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
{{/if}}
{{/if}}

<!-- Payment Method -->
{{#if payment_method}}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse; margin-bottom: 24px;">
  <tr>
    <td bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 14px;">
        <tr>
          <td style="color: #1e293b; font-weight: 600; padding: 0 0 4px 0;">Metodo di Pagamento</td>
        </tr>
        <tr>
          <td style="color: #64748b;">{{payment_method}}{{#if payment_terms}} &mdash; {{payment_terms}}{{/if}}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
{{/if}}

<!-- Bank Transfer Details (conditional) -->
{{#if bank_iban}}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse; margin-bottom: 24px;">
  <tr>
    <td bgcolor="#eff6ff" style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td style="padding: 0 0 10px 0;">
            <h4 style="margin: 0; color: #1e40af; font-size: 14px; font-weight: 600;">Dati per Bonifico Bancario</h4>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 13px;">
        <tr>
          <td style="color: #64748b; padding: 4px 0;" width="120">Beneficiario:</td>
          <td style="color: #1e293b; font-weight: 600; padding: 4px 0;">{{bank_beneficiary}}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 4px 0;">IBAN:</td>
          <td style="color: #1e293b; font-weight: 600; padding: 4px 0; font-family: monospace, monospace;">{{bank_iban}}</td>
        </tr>
        {{#if bank_bic_swift}}
        <tr>
          <td style="color: #64748b; padding: 4px 0;">BIC/SWIFT:</td>
          <td style="color: #1e293b; padding: 4px 0; font-family: monospace, monospace;">{{bank_bic_swift}}</td>
        </tr>
        {{/if}}
        {{#if bank_name}}
        <tr>
          <td style="color: #64748b; padding: 4px 0;">Banca:</td>
          <td style="color: #1e293b; padding: 4px 0;">{{bank_name}}</td>
        </tr>
        {{/if}}
        <tr>
          <td style="color: #64748b; padding: 4px 0;">Causale:</td>
          <td style="color: #1e293b; font-weight: 600; padding: 4px 0;">{{bank_causale}}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 4px 0;">Importo:</td>
          <td style="color: #166534; font-weight: 700; padding: 4px 0; font-size: 15px;">{{order_total}}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
{{/if}}

<!-- CTA Button -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 8px 0 0 0;">
  <tr>
    <td align="left">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="{{order_url}}" style="height:44px;v-text-anchor:middle;width:200px;" fill="true" stroke="false">
        <v:fill type="tile" color="{{primary_color}}" />
        <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:600;">Visualizza Ordine</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="{{order_url}}" style="display: inline-block; padding: 12px 28px; background-color: {{primary_color}}; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; font-family: sans-serif; mso-hide: all;">
        Visualizza Ordine
      </a>
      <!--<![endif]-->
    </td>
  </tr>
</table>
    `.trim()
  },
  {
    template_id: "order_shipped",
    name: "Ordine Spedito",
    description: "Notifica che l'ordine è stato spedito. Include numero tracking e link per seguire la spedizione.",
    trigger: "order_shipped",
    variables: ["customer_name", "order_number", "tracking_number", "carrier_name", "tracking_url", "estimated_delivery", "shop_name"],
    email_subject: "Il tuo ordine {{order_number}} è stato spedito! - {{shop_name}}",
    email_html: `
<h2 style="color: #1e293b; margin: 0 0 16px 0;">Il tuo ordine è in viaggio!</h2>
<p style="color: #64748b; margin: 0 0 16px 0;">Gentile {{customer_name}},</p>
<p style="color: #64748b; margin: 0 0 24px 0;">
  Ottima notizia! Il tuo ordine <strong>{{order_number}}</strong> è stato spedito.
</p>

<div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin: 16px 0;">
  <h3 style="margin: 0 0 12px 0; color: #1e40af; font-size: 14px;">Dettagli Spedizione:</h3>
  <table style="font-size: 14px;">
    <tr><td style="padding: 4px 0; color: #64748b;">Corriere:</td><td style="color: #1e293b; font-weight: 500;">{{carrier_name}}</td></tr>
    <tr><td style="padding: 4px 0; color: #64748b;">Tracking:</td><td style="color: #1e293b; font-weight: 600; font-family: monospace;">{{tracking_number}}</td></tr>
    <tr><td style="padding: 4px 0; color: #64748b;">Consegna prevista:</td><td style="color: #1e293b;">{{estimated_delivery}}</td></tr>
  </table>
</div>

<p style="margin: 24px 0 0 0;">
  <a href="{{tracking_url}}" style="display: inline-block; padding: 12px 24px; background-color: {{primary_color}}; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
    Traccia Spedizione
  </a>
</p>
    `.trim()
  },
  {
    template_id: "order_delivered",
    name: "Ordine Consegnato",
    description: "Conferma che l'ordine è stato consegnato. Invita a lasciare recensione.",
    trigger: "order_delivered",
    variables: ["customer_name", "order_number", "delivery_date", "review_url", "shop_name"],
    email_subject: "Il tuo ordine {{order_number}} è stato consegnato! - {{shop_name}}",
    email_html: `
<h2 style="color: #1e293b; margin: 0 0 16px 0;">Ordine Consegnato!</h2>
<p style="color: #64748b; margin: 0 0 16px 0;">Gentile {{customer_name}},</p>
<p style="color: #64748b; margin: 0 0 24px 0;">
  Il tuo ordine <strong>{{order_number}}</strong> è stato consegnato il {{delivery_date}}.
</p>

<p style="color: #64748b; margin: 0 0 24px 0;">
  Speriamo che i prodotti siano di tuo gradimento. Se hai domande o problemi, non esitare a contattarci.
</p>

<div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
  <p style="margin: 0 0 12px 0; color: #92400e; font-size: 14px;">
    Ti è piaciuto il tuo acquisto?
  </p>
  <a href="{{review_url}}" style="display: inline-block; padding: 10px 20px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 13px;">
    Lascia una Recensione
  </a>
</div>
    `.trim()
  },
  {
    template_id: "order_cancelled",
    name: "Ordine Annullato",
    description: "Notifica che l'ordine è stato annullato. Include motivo e info rimborso se applicabile.",
    trigger: "order_cancelled",
    variables: ["customer_name", "order_number", "cancel_reason", "refund_info", "support_email", "shop_name"],
    email_subject: "Ordine {{order_number}} annullato - {{shop_name}}",
    email_html: `
<h2 style="color: #1e293b; margin: 0 0 16px 0;">Ordine Annullato</h2>
<p style="color: #64748b; margin: 0 0 16px 0;">Gentile {{customer_name}},</p>
<p style="color: #64748b; margin: 0 0 24px 0;">
  Ti informiamo che il tuo ordine <strong>{{order_number}}</strong> è stato annullato.
</p>

<div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
  <h3 style="margin: 0 0 8px 0; color: #991b1b; font-size: 13px;">Motivo annullamento:</h3>
  <p style="margin: 0; color: #64748b; font-size: 13px;">{{cancel_reason}}</p>
</div>

<div style="background-color: #f8f9fb; border-radius: 8px; padding: 16px; margin: 16px 0;">
  <h3 style="margin: 0 0 8px 0; color: #1e293b; font-size: 13px;">Informazioni Rimborso:</h3>
  <p style="margin: 0; color: #64748b; font-size: 13px;">{{refund_info}}</p>
</div>

<p style="color: #64748b; margin: 16px 0 0 0;">
  Per qualsiasi domanda, contattaci a <a href="mailto:{{support_email}}" style="color: {{primary_color}};">{{support_email}}</a>.
</p>
    `.trim()
  },

  // ============================================
  // PAYMENT TEMPLATES (3)
  // ============================================
  {
    template_id: "payment_received",
    name: "Pagamento Ricevuto",
    description: "Conferma di ricezione pagamento con importo, metodo e riepilogo saldo residuo.",
    trigger: "payment_received",
    variables: ["customer_name", "order_number", "payment_amount", "payment_method", "payment_date", "order_total", "amount_remaining", "shop_name"],
    email_subject: "Pagamento ricevuto per ordine {{order_number}} - {{shop_name}}",
    email_html: `
<h2 style="color: #1e293b; margin: 0 0 16px 0;">Pagamento Ricevuto</h2>
<p style="color: #64748b; margin: 0 0 16px 0;">Gentile {{customer_name}},</p>
<p style="color: #64748b; margin: 0 0 24px 0;">
  Abbiamo ricevuto il tuo pagamento per l'ordine <strong>{{order_number}}</strong>.
</p>

<div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 16px 0;">
  <table style="width: 100%; font-size: 14px;">
    <tr><td style="padding: 4px 0; color: #64748b;">Importo ricevuto:</td><td style="color: #166534; font-weight: 700; text-align: right; font-size: 16px;">{{payment_amount}}</td></tr>
    <tr><td style="padding: 4px 0; color: #64748b;">Metodo:</td><td style="color: #1e293b; text-align: right;">{{payment_method}}</td></tr>
    <tr><td style="padding: 4px 0; color: #64748b;">Data:</td><td style="color: #1e293b; text-align: right;">{{payment_date}}</td></tr>
    <tr><td style="padding: 4px 0; color: #64748b;">Totale ordine:</td><td style="color: #1e293b; text-align: right;">{{order_total}}</td></tr>
    <tr><td style="padding: 4px 0; color: #64748b;">Saldo residuo:</td><td style="color: #1e293b; font-weight: 600; text-align: right;">{{amount_remaining}}</td></tr>
  </table>
</div>

<p style="color: #64748b; margin: 16px 0 0 0;">
  Grazie per il tuo pagamento!
</p>
    `.trim()
  },
  {
    template_id: "payment_failed",
    name: "Pagamento Fallito",
    description: "Notifica di pagamento non andato a buon fine con suggerimenti per riprovare.",
    trigger: "payment_failed",
    variables: ["customer_name", "order_number", "payment_amount", "payment_method", "order_url", "support_email", "shop_name"],
    email_subject: "Pagamento non riuscito per ordine {{order_number}} - {{shop_name}}",
    email_html: `
<h2 style="color: #1e293b; margin: 0 0 16px 0;">Pagamento Non Riuscito</h2>
<p style="color: #64748b; margin: 0 0 16px 0;">Gentile {{customer_name}},</p>
<p style="color: #64748b; margin: 0 0 24px 0;">
  Purtroppo il pagamento di <strong>{{payment_amount}}</strong> per l'ordine <strong>{{order_number}}</strong> non è andato a buon fine.
</p>

<div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
  <p style="margin: 0; color: #991b1b; font-size: 13px;">
    Il pagamento tramite <strong>{{payment_method}}</strong> è stato rifiutato. Ti invitiamo a verificare i dati del metodo di pagamento e riprovare.
  </p>
</div>

<p style="margin: 24px 0 0 0;">
  <a href="{{order_url}}" style="display: inline-block; padding: 12px 24px; background-color: {{primary_color}}; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
    Riprova Pagamento
  </a>
</p>

<p style="color: #64748b; margin: 16px 0 0 0;">
  Per assistenza, contattaci a <a href="mailto:{{support_email}}" style="color: {{primary_color}};">{{support_email}}</a>.
</p>
    `.trim()
  },
  {
    template_id: "payment_refunded",
    name: "Rimborso Effettuato",
    description: "Conferma che il rimborso è stato elaborato con importo e metodo.",
    trigger: "payment_refunded",
    variables: ["customer_name", "order_number", "refund_amount", "payment_method", "refund_date", "support_email", "shop_name"],
    email_subject: "Rimborso effettuato per ordine {{order_number}} - {{shop_name}}",
    email_html: `
<h2 style="color: #1e293b; margin: 0 0 16px 0;">Rimborso Effettuato</h2>
<p style="color: #64748b; margin: 0 0 16px 0;">Gentile {{customer_name}},</p>
<p style="color: #64748b; margin: 0 0 24px 0;">
  Ti informiamo che il rimborso per l'ordine <strong>{{order_number}}</strong> è stato elaborato.
</p>

<div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin: 16px 0;">
  <table style="width: 100%; font-size: 14px;">
    <tr><td style="padding: 4px 0; color: #64748b;">Importo rimborsato:</td><td style="color: #1e40af; font-weight: 700; text-align: right; font-size: 16px;">{{refund_amount}}</td></tr>
    <tr><td style="padding: 4px 0; color: #64748b;">Metodo:</td><td style="color: #1e293b; text-align: right;">{{payment_method}}</td></tr>
    <tr><td style="padding: 4px 0; color: #64748b;">Data:</td><td style="color: #1e293b; text-align: right;">{{refund_date}}</td></tr>
  </table>
</div>

<p style="color: #64748b; margin: 16px 0 0 0;">
  I tempi di accredito dipendono dal metodo di pagamento utilizzato (generalmente 3-5 giorni lavorativi).
</p>

<p style="color: #64748b; margin: 16px 0 0 0;">
  Per qualsiasi domanda, contattaci a <a href="mailto:{{support_email}}" style="color: {{primary_color}};">{{support_email}}</a>.
</p>
    `.trim()
  },

  // ============================================
  // MARKETING TEMPLATES (2)
  // ============================================
  {
    template_id: "back_in_stock",
    name: "Prodotto Disponibile",
    description: "Notifica quando un prodotto precedentemente esaurito torna disponibile.",
    trigger: "back_in_stock",
    variables: ["customer_name", "product_name", "product_image", "product_price", "product_url", "shop_name"],
    email_subject: "Torna disponibile: {{product_name}} - {{shop_name}}",
    email_html: `
<h2 style="color: #1e293b; margin: 0 0 16px 0;">Prodotto Disponibile!</h2>
<p style="color: #64748b; margin: 0 0 16px 0;">Gentile {{customer_name}},</p>
<p style="color: #64748b; margin: 0 0 24px 0;">
  Il prodotto che stavi aspettando è tornato disponibile!
</p>

<div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 16px 0;">
  <h3 style="margin: 0 0 8px 0; color: #166534; font-size: 15px;">{{product_name}}</h3>
  <p style="margin: 0; color: #1e293b; font-weight: 600; font-size: 16px;">{{product_price}}</p>
</div>

<p style="color: #94a3b8; font-size: 12px; margin: 16px 0;">
  Affrettati, le scorte potrebbero essere limitate!
</p>

<p style="margin: 16px 0 0 0;">
  <a href="{{product_url}}" style="display: inline-block; padding: 12px 24px; background-color: {{primary_color}}; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
    Acquista Ora
  </a>
</p>
    `.trim()
  },
  {
    template_id: "newsletter",
    name: "Newsletter",
    description: "Template base per comunicazioni promozionali e novità. Personalizzabile.",
    trigger: "newsletter",
    variables: ["customer_name", "subject_line", "content", "cta_text", "cta_url", "shop_name"],
    email_subject: "{{subject_line}} - {{shop_name}}",
    email_html: `
<p style="color: #64748b; margin: 0 0 16px 0;">Ciao {{customer_name}},</p>

{{content}}

<p style="margin: 24px 0 0 0;">
  <a href="{{cta_url}}" style="display: inline-block; padding: 12px 24px; background-color: {{primary_color}}; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
    {{cta_text}}
  </a>
</p>
    `.trim()
  }
];

// ============================================
// SEED FUNCTION
// ============================================

/**
 * Seeds default notification templates for a tenant.
 * Only creates templates that don't already exist.
 *
 * @param tenantDb - Tenant database name (e.g., "vinc-hidros-it")
 * @param force - If true, replaces existing default templates
 * @param templateId - If provided, only seed the matching template
 * @returns Number of templates created
 */
export async function seedDefaultTemplates(
  tenantDb: string,
  force = false,
  templateId?: string
): Promise<{ created: number; skipped: number }> {
  const { NotificationTemplate } = await connectWithModels(tenantDb);

  const templates = templateId
    ? DEFAULT_TEMPLATES.filter((t) => t.template_id === templateId)
    : DEFAULT_TEMPLATES;

  let created = 0;
  let skipped = 0;

  for (const template of templates) {
    const existing = await NotificationTemplate.findOne({
      template_id: template.template_id
    });

    if (existing) {
      if (force && existing.is_default) {
        // Replace default template
        await NotificationTemplate.updateOne(
          { template_id: template.template_id },
          {
            $set: {
              name: template.name,
              description: template.description,
              trigger: template.trigger,
              variables: template.variables,
              channels: {
                email: {
                  enabled: true,
                  subject: template.email_subject,
                  html_body: template.email_html,
                  text_body: ""
                }
              },
              is_default: true,
              is_active: true,
              updated_by: "system"
            }
          }
        );
        created++;
      } else {
        skipped++;
      }
      continue;
    }

    // Create new template
    await NotificationTemplate.create({
      template_id: template.template_id,
      name: template.name,
      description: template.description,
      trigger: template.trigger,
      channels: {
        email: {
          enabled: true,
          subject: template.email_subject,
          html_body: template.email_html,
          text_body: ""
        }
      },
      variables: template.variables,
      is_active: true,
      is_default: true,
      created_by: "system"
    });
    created++;
  }

  return { created, skipped };
}

/**
 * Check if default templates exist for a tenant.
 */
export async function hasDefaultTemplates(tenantDb: string): Promise<boolean> {
  const { NotificationTemplate } = await connectWithModels(tenantDb);
  const count = await NotificationTemplate.countDocuments({ is_default: true });
  return count > 0;
}

/**
 * Get template count for a tenant.
 */
export async function getTemplateCount(tenantDb: string): Promise<number> {
  const { NotificationTemplate } = await connectWithModels(tenantDb);
  return NotificationTemplate.countDocuments();
}

// ============================================
// CAMPAIGN TEMPLATES (NEW)
// ============================================

import { CAMPAIGN_SEED_TEMPLATES } from "./seed-campaign-templates";

/**
 * Seeds campaign templates (product and generic types) for a tenant.
 * These are the new simplified templates for the 3-channel system.
 *
 * @param tenantDb - Tenant database name (e.g., "vinc-hidros-it")
 * @param force - If true, replaces existing campaign templates
 */
export async function seedCampaignTemplates(
  tenantDb: string,
  force = false
): Promise<{ created: number; skipped: number }> {
  const { NotificationTemplate } = await connectWithModels(tenantDb);

  let created = 0;
  let skipped = 0;

  for (const template of CAMPAIGN_SEED_TEMPLATES) {
    const existing = await NotificationTemplate.findOne({
      template_id: template.template_id
    });

    if (existing) {
      if (force && existing.is_default) {
        // Replace default template
        await NotificationTemplate.updateOne(
          { template_id: template.template_id },
          {
            $set: {
              name: template.name,
              description: template.description,
              type: template.type,
              trigger: template.trigger,
              title: template.title,
              body: template.body,
              products: template.products,
              filters: template.filters,
              url: template.url,
              image: template.image,
              open_in_new_tab: template.open_in_new_tab,
              template_channels: template.template_channels,
              variables: template.variables,
              use_default_header: template.use_default_header,
              use_default_footer: template.use_default_footer,
              is_default: true,
              is_active: true,
              updated_by: "system"
            }
          }
        );
        created++;
      } else {
        skipped++;
      }
      continue;
    }

    // Create new template
    await NotificationTemplate.create({
      template_id: template.template_id,
      name: template.name,
      description: template.description,
      type: template.type,
      trigger: template.trigger,
      title: template.title,
      body: template.body,
      products: template.products,
      filters: template.filters,
      url: template.url,
      image: template.image,
      open_in_new_tab: template.open_in_new_tab,
      template_channels: template.template_channels,
      variables: template.variables,
      use_default_header: template.use_default_header,
      use_default_footer: template.use_default_footer,
      is_active: true,
      is_default: true,
      created_by: "system"
    });
    created++;
  }

  return { created, skipped };
}
