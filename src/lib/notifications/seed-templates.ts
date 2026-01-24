/**
 * Seed Default Notification Templates
 *
 * Seeds 13 default notification templates:
 * - 5 Account templates (registration, welcome, forgot password, reset password)
 * - 4 Order templates (confirmation, shipped, delivered, cancelled)
 * - 4 Marketing templates (price drop, back in stock, abandoned cart, newsletter)
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
    description: "Riepilogo dell'ordine appena effettuato con dettagli prodotti, totale e indirizzo di spedizione.",
    trigger: "order_confirmation",
    variables: ["customer_name", "order_number", "order_date", "order_total", "shipping_address", "order_items", "order_url", "shop_name"],
    email_subject: "Conferma Ordine #{{order_number}} - {{shop_name}}",
    email_html: `
<h2 style="color: #1e293b; margin: 0 0 16px 0;">Ordine Confermato!</h2>
<p style="color: #64748b; margin: 0 0 16px 0;">Gentile {{customer_name}},</p>
<p style="color: #64748b; margin: 0 0 24px 0;">
  Grazie per il tuo ordine! Abbiamo ricevuto la tua richiesta e la stiamo elaborando.
</p>

<div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
  <table style="width: 100%; font-size: 14px;">
    <tr><td style="color: #64748b;">Numero Ordine:</td><td style="color: #1e293b; font-weight: 600; text-align: right;">#{{order_number}}</td></tr>
    <tr><td style="color: #64748b;">Data:</td><td style="color: #1e293b; text-align: right;">{{order_date}}</td></tr>
    <tr><td style="color: #64748b;">Totale:</td><td style="color: #166534; font-weight: 700; text-align: right; font-size: 16px;">{{order_total}}</td></tr>
  </table>
</div>

<div style="background-color: #f8f9fb; border-radius: 8px; padding: 16px; margin: 16px 0;">
  <h3 style="margin: 0 0 8px 0; color: #1e293b; font-size: 13px;">Indirizzo di Spedizione:</h3>
  <p style="margin: 0; color: #64748b; font-size: 13px;">{{shipping_address}}</p>
</div>

<p style="margin: 24px 0 0 0;">
  <a href="{{order_url}}" style="display: inline-block; padding: 12px 24px; background-color: {{primary_color}}; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
    Visualizza Ordine
  </a>
</p>
    `.trim()
  },
  {
    template_id: "order_shipped",
    name: "Ordine Spedito",
    description: "Notifica che l'ordine è stato spedito. Include numero tracking e link per seguire la spedizione.",
    trigger: "order_shipped",
    variables: ["customer_name", "order_number", "tracking_number", "carrier_name", "tracking_url", "estimated_delivery", "shop_name"],
    email_subject: "Il tuo ordine #{{order_number}} è stato spedito! - {{shop_name}}",
    email_html: `
<h2 style="color: #1e293b; margin: 0 0 16px 0;">Il tuo ordine è in viaggio!</h2>
<p style="color: #64748b; margin: 0 0 16px 0;">Gentile {{customer_name}},</p>
<p style="color: #64748b; margin: 0 0 24px 0;">
  Ottima notizia! Il tuo ordine <strong>#{{order_number}}</strong> è stato spedito.
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
    email_subject: "Il tuo ordine #{{order_number}} è stato consegnato! - {{shop_name}}",
    email_html: `
<h2 style="color: #1e293b; margin: 0 0 16px 0;">Ordine Consegnato!</h2>
<p style="color: #64748b; margin: 0 0 16px 0;">Gentile {{customer_name}},</p>
<p style="color: #64748b; margin: 0 0 24px 0;">
  Il tuo ordine <strong>#{{order_number}}</strong> è stato consegnato il {{delivery_date}}.
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
    email_subject: "Ordine #{{order_number}} annullato - {{shop_name}}",
    email_html: `
<h2 style="color: #1e293b; margin: 0 0 16px 0;">Ordine Annullato</h2>
<p style="color: #64748b; margin: 0 0 16px 0;">Gentile {{customer_name}},</p>
<p style="color: #64748b; margin: 0 0 24px 0;">
  Ti informiamo che il tuo ordine <strong>#{{order_number}}</strong> è stato annullato.
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
  // MARKETING TEMPLATES (4)
  // ============================================
  {
    template_id: "price_drop_alert",
    name: "Avviso Ribasso Prezzo",
    description: "Notifica quando un prodotto nei preferiti o nel carrello ha un ribasso di prezzo.",
    trigger: "price_drop_alert",
    variables: ["customer_name", "product_name", "product_image", "old_price", "new_price", "discount_percent", "product_url", "shop_name"],
    email_subject: "Prezzo ribassato: {{product_name}} - {{shop_name}}",
    email_html: `
<h2 style="color: #1e293b; margin: 0 0 16px 0;">Buone notizie!</h2>
<p style="color: #64748b; margin: 0 0 16px 0;">Gentile {{customer_name}},</p>
<p style="color: #64748b; margin: 0 0 24px 0;">
  Un prodotto nella tua lista desideri ha un nuovo prezzo ribassato!
</p>

<div style="background-color: #f8f9fb; border-radius: 8px; padding: 20px; margin: 16px 0; display: flex; gap: 16px;">
  <div style="flex: 1;">
    <h3 style="margin: 0 0 8px 0; color: #1e293b; font-size: 15px;">{{product_name}}</h3>
    <p style="margin: 0;">
      <span style="text-decoration: line-through; color: #94a3b8;">{{old_price}}</span>
      <span style="color: #16a34a; font-weight: 700; font-size: 18px; margin-left: 8px;">{{new_price}}</span>
      <span style="background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-size: 12px; margin-left: 8px;">-{{discount_percent}}%</span>
    </p>
  </div>
</div>

<p style="margin: 24px 0 0 0;">
  <a href="{{product_url}}" style="display: inline-block; padding: 12px 24px; background-color: {{primary_color}}; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
    Acquista Ora
  </a>
</p>
    `.trim()
  },
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
    template_id: "abandoned_cart",
    name: "Carrello Abbandonato",
    description: "Promemoria per completare l'acquisto con riepilogo prodotti nel carrello.",
    trigger: "abandoned_cart",
    variables: ["customer_name", "cart_items", "cart_total", "cart_url", "shop_name"],
    email_subject: "Hai dimenticato qualcosa nel carrello? - {{shop_name}}",
    email_html: `
<h2 style="color: #1e293b; margin: 0 0 16px 0;">Il tuo carrello ti aspetta!</h2>
<p style="color: #64748b; margin: 0 0 16px 0;">Ciao {{customer_name}},</p>
<p style="color: #64748b; margin: 0 0 24px 0;">
  Hai lasciato alcuni articoli nel carrello. Completa il tuo ordine prima che vadano esauriti!
</p>

<div style="background-color: #f8f9fb; border-radius: 8px; padding: 20px; margin: 16px 0;">
  {{cart_items}}
  <div style="border-top: 1px solid #e2e8f0; margin-top: 12px; padding-top: 12px;">
    <p style="margin: 0; text-align: right; color: #1e293b; font-weight: 600; font-size: 16px;">
      Totale: {{cart_total}}
    </p>
  </div>
</div>

<p style="margin: 24px 0 0 0;">
  <a href="{{cart_url}}" style="display: inline-block; padding: 12px 24px; background-color: {{primary_color}}; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
    Completa l'Ordine
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
 * @returns Number of templates created
 */
export async function seedDefaultTemplates(
  tenantDb: string,
  force = false
): Promise<{ created: number; skipped: number }> {
  const { NotificationTemplate } = await connectWithModels(tenantDb);

  let created = 0;
  let skipped = 0;

  for (const template of DEFAULT_TEMPLATES) {
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
