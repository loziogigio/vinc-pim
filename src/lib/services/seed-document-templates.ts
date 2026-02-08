/**
 * Seed Document Templates
 *
 * Creates 4 standard system templates when a tenant is provisioned.
 * Idempotent: skips if system templates already exist.
 */

import { connectWithModels } from "@/lib/db/connection";
import { nanoid } from "nanoid";
import type { TemplateHeaderConfig, TemplateFooterConfig } from "@/lib/constants/document";

interface TemplateDefinition {
  name: string;
  description: string;
  html_template: string;
  css_styles: string;
  header_config: TemplateHeaderConfig;
  footer_config: TemplateFooterConfig;
  is_default: boolean;
}

// ============================================
// TEMPLATE: CLASSICO
// ============================================

const CLASSICO_HTML = `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"></head>
<body>
<div class="document">
  <div class="header">
    <div class="company-side">
      {{company.logo_html}}
      <div class="company-name">{{company.legal_name}}</div>
      <div class="company-details">
        {{company.address_line1}}<br>
        {{company.address_line2}}
        {{company.fiscal_ids}}
        {{company.contact_line}}
        {{company.pec_line}}
      </div>
    </div>
    <div class="doc-side">
      <div class="doc-title">{{document.type_label}}</div>
      <div class="doc-number">{{document.document_number}}</div>
      <div class="doc-meta">
        {{label.date}}: {{document.date}}<br>
        {{document.due_date_line}}
        {{document.payment_terms_line}}
      </div>
    </div>
  </div>

  <div class="recipient">
    <div class="recipient-label">{{label.recipient}}</div>
    <div class="recipient-name">{{customer.company_name}}</div>
    <div class="recipient-details">
      {{customer.billing_address.street_address}}<br>
      {{customer.billing_address.postal_code}} {{customer.billing_address.city}} ({{customer.billing_address.province}})<br>
      {{customer.fiscal_ids}}
      {{customer.pec_sdi_line}}
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th class="col-num">#</th>
        <th class="col-desc">{{label.description}}</th>
        <th class="col-qty">{{label.quantity}}</th>
        <th class="col-price">{{label.unit_price}}</th>
        <th class="col-discount">{{label.discount}}</th>
        <th class="col-vat">{{label.vat}}</th>
        <th class="col-total">{{label.total}}</th>
      </tr>
    </thead>
    <tbody>
      {{items}}
    </tbody>
  </table>

  <div class="totals-section">
    <table class="totals-table">
      <tr><td class="label">{{label.subtotal}}</td><td class="value">{{totals.subtotal_net}}</td></tr>
      {{vat_breakdown}}
      {{totals.discount_row}}
      <tr class="total-row"><td class="label">{{label.total}}</td><td class="value">{{totals.total}}</td></tr>
    </table>
  </div>

  {{notes_section}}
  {{footer_text_section}}
</div>
</body>
</html>`;

const CLASSICO_CSS = `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Georgia, 'Times New Roman', serif; font-size: 12px; color: #1f2937; line-height: 1.5; }
.document { max-width: 800px; margin: 0 auto; padding: 30px; }
.header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #d1d5db; }
.company-side { max-width: 55%; }
.logo { max-height: 55px; max-width: 180px; margin-bottom: 8px; }
.company-name { font-size: 18px; font-weight: 700; color: #111827; }
.company-details { font-size: 10px; color: #6b7280; margin-top: 4px; line-height: 1.6; }
.doc-side { text-align: right; }
.doc-title { font-size: 22px; font-weight: 700; color: #111827; text-transform: uppercase; }
.doc-number { font-size: 14px; color: #6b7280; margin-top: 2px; }
.doc-meta { font-size: 11px; color: #6b7280; margin-top: 10px; line-height: 1.7; }
.recipient { margin-bottom: 28px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 4px; max-width: 350px; }
.recipient-label { font-size: 10px; text-transform: uppercase; color: #9ca3af; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 6px; }
.recipient-name { font-size: 14px; font-weight: 600; color: #111827; }
.recipient-details { font-size: 10px; color: #6b7280; margin-top: 4px; line-height: 1.6; }
.items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
.items-table th { background: #f3f4f6; padding: 8px 10px; font-size: 10px; text-transform: uppercase; color: #6b7280; font-weight: 600; border-bottom: 2px solid #d1d5db; text-align: left; }
.items-table th.col-num { width: 35px; text-align: center; }
.items-table th.col-qty { width: 60px; text-align: center; }
.items-table th.col-price { width: 90px; text-align: right; }
.items-table th.col-discount { width: 60px; text-align: center; }
.items-table th.col-vat { width: 50px; text-align: center; }
.items-table th.col-total { width: 100px; text-align: right; }
.items-table td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
.totals-section { display: flex; justify-content: flex-end; margin-bottom: 24px; }
.totals-table { width: 280px; }
.totals-table td { padding: 5px 10px; font-size: 11px; }
.totals-table .label { color: #6b7280; }
.totals-table .value { text-align: right; font-weight: 500; }
.totals-table .total-row td { font-size: 15px; font-weight: 700; border-top: 2px solid #111827; padding-top: 10px; }
.notes-section { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
.notes-label { font-size: 10px; text-transform: uppercase; color: #9ca3af; font-weight: 600; margin-bottom: 4px; }
.notes-text { font-size: 11px; color: #6b7280; }
.footer-text { margin-top: 12px; font-size: 10px; color: #9ca3af; }`;

// ============================================
// TEMPLATE: MODERNO
// ============================================

const MODERNO_HTML = `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"></head>
<body>
<div class="document">
  <div class="header-bar">
    <div class="header-content">
      <div class="header-left">
        {{company.logo_html}}
        <span class="company-name">{{company.legal_name}}</span>
      </div>
      <div class="header-right">{{document.type_label}}</div>
    </div>
  </div>
  <div class="accent-bar"></div>

  <div class="info-row">
    <div class="info-card doc-card">
      <div class="card-label">{{label.document_label}}</div>
      <div class="card-number">{{document.document_number}}</div>
      <div class="card-date">{{document.date}}</div>
      {{document.due_date_card}}
      {{document.payment_terms_card}}
    </div>
    <div class="info-card customer-card">
      <div class="card-label">{{label.dear_customer}}</div>
      <div class="card-name">{{customer.company_name}}</div>
      <div class="card-detail">
        {{customer.billing_address.street_address}}<br>
        {{customer.billing_address.postal_code}} {{customer.billing_address.city}} ({{customer.billing_address.province}})
      </div>
      <div class="card-detail">{{customer.fiscal_ids}}</div>
    </div>
  </div>

  <div class="company-details">{{company.summary_line}}</div>

  <table class="items-table">
    <thead>
      <tr>
        <th class="col-desc">{{label.description}}</th>
        <th class="col-qty">{{label.quantity}}</th>
        <th class="col-price">{{label.unit_price}}</th>
        <th class="col-discount">{{label.discount}}</th>
        <th class="col-vat">{{label.vat}}</th>
        <th class="col-total">{{label.total}}</th>
      </tr>
    </thead>
    <tbody>
      {{items}}
    </tbody>
  </table>

  <div class="totals-section">
    <table class="totals-table">
      <tr><td class="label">{{label.subtotal}}</td><td class="value">{{totals.subtotal_net}}</td></tr>
      {{vat_breakdown}}
      <tr class="total-row"><td class="label">{{label.total}}</td><td class="value">{{totals.total}}</td></tr>
    </table>
  </div>

  {{notes_section}}

  <div class="footer-bar"></div>
  <div class="footer">{{company.footer_line}}</div>
</div>
</body>
</html>`;

const MODERNO_CSS = `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #1f2937; line-height: 1.5; }
.document { max-width: 800px; margin: 0 auto; padding: 30px; }
.header-bar { padding: 16px 0; margin-bottom: 0; }
.header-content { display: flex; justify-content: space-between; align-items: center; }
.header-left { display: flex; align-items: center; gap: 12px; }
.logo { max-height: 45px; max-width: 160px; }
.company-name { font-size: 18px; font-weight: 700; color: #111827; }
.header-right { font-size: 24px; font-weight: 800; color: #009688; text-transform: uppercase; letter-spacing: 1px; }
.accent-bar { height: 3px; background: linear-gradient(90deg, #009688, #00bfa5); margin-bottom: 24px; border-radius: 2px; }
.info-row { display: flex; gap: 16px; margin-bottom: 16px; }
.info-card { flex: 1; padding: 16px; border-radius: 8px; }
.doc-card { background: #f0fdfa; border: 1px solid #99f6e4; }
.customer-card { background: #f8fafc; border: 1px solid #e2e8f0; }
.card-label { font-size: 10px; text-transform: uppercase; color: #6b7280; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 4px; }
.card-number { font-size: 16px; font-weight: 700; color: #009688; }
.card-date { font-size: 12px; color: #374151; margin-top: 2px; }
.card-name { font-size: 14px; font-weight: 600; color: #111827; }
.card-detail { font-size: 11px; color: #6b7280; margin-top: 2px; line-height: 1.5; }
.company-details { font-size: 10px; color: #9ca3af; margin-bottom: 20px; }
.items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
.items-table th { padding: 10px 12px; font-size: 10px; text-transform: uppercase; color: #6b7280; font-weight: 600; border-bottom: 2px solid #e5e7eb; text-align: left; }
.items-table th.col-qty { width: 60px; text-align: center; }
.items-table th.col-price { width: 90px; text-align: right; }
.items-table th.col-discount { width: 60px; text-align: center; }
.items-table th.col-vat { width: 50px; text-align: center; }
.items-table th.col-total { width: 100px; text-align: right; }
.items-table td { padding: 10px 12px; font-size: 11px; border-bottom: 1px solid #f3f4f6; }
.items-table tbody tr:nth-child(even) { background: #f9fafb; }
.totals-section { display: flex; justify-content: flex-end; margin-bottom: 24px; }
.totals-table { width: 280px; }
.totals-table td { padding: 5px 12px; font-size: 11px; }
.totals-table .label { color: #6b7280; }
.totals-table .value { text-align: right; font-weight: 500; }
.totals-table .total-row td { font-size: 14px; font-weight: 700; background: #009688; color: #fff; padding: 10px 12px; border-radius: 6px; }
.notes-section { padding: 12px 16px; background: #f8fafc; border-radius: 6px; margin-bottom: 20px; }
.notes-title { font-size: 10px; text-transform: uppercase; color: #9ca3af; font-weight: 600; margin-bottom: 4px; }
.notes-text { font-size: 11px; color: #6b7280; }
.footer-bar { height: 3px; background: linear-gradient(90deg, #009688, #00bfa5); margin-bottom: 8px; border-radius: 2px; }
.footer { font-size: 9px; color: #9ca3af; text-align: center; }`;

// ============================================
// TEMPLATE: MINIMALE
// ============================================

const MINIMALE_HTML = `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"></head>
<body>
<div class="document">
  <div class="header">
    {{company.logo_html}}
    <div class="company-name">{{company.legal_name}}</div>
  </div>

  <div class="doc-info">
    <span class="doc-label">{{document.type_label}}</span>
    <span class="doc-number">{{document.document_number}}</span>
    <span class="doc-date">{{document.date}}</span>
  </div>

  <div class="customer">
    <div class="customer-name">{{customer.company_name}}</div>
    <div class="customer-addr">
      {{customer.billing_address.street_address}}, {{customer.billing_address.postal_code}} {{customer.billing_address.city}}
    </div>
    {{customer.vat_line}}
  </div>

  {{document.meta_line}}

  <table class="items-table">
    <thead>
      <tr>
        <th class="col-desc">{{label.description}}</th>
        <th class="col-qty">{{label.quantity}}</th>
        <th class="col-price">{{label.unit_price}}</th>
        <th class="col-vat">{{label.vat}}</th>
        <th class="col-total">{{label.total}}</th>
      </tr>
    </thead>
    <tbody>
      {{items}}
    </tbody>
  </table>

  <div class="totals-section">
    <div class="totals">
      <div class="total-line"><span>{{label.subtotal}}</span><span>{{totals.subtotal_net}}</span></div>
      <div class="total-line"><span>{{label.vat}}</span><span>{{totals.total_vat}}</span></div>
      <div class="total-line total-final"><span>{{label.total}}</span><span>{{totals.total}}</span></div>
    </div>
  </div>

  {{notes_section}}

  <div class="footer-line"></div>
  <div class="footer">{{company.legal_name}}</div>
</div>
</body>
</html>`;

const MINIMALE_CSS = `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif; font-size: 12px; color: #374151; line-height: 1.6; }
.document { max-width: 800px; margin: 0 auto; padding: 40px 50px; }
.header { text-align: center; margin-bottom: 40px; }
.logo { max-height: 40px; max-width: 140px; margin-bottom: 10px; }
.company-name { font-size: 15px; font-weight: 500; color: #111827; letter-spacing: 1px; }
.doc-info { margin-bottom: 32px; font-size: 13px; }
.doc-label { font-weight: 600; color: #111827; }
.doc-number { color: #6b7280; margin-left: 4px; }
.doc-date { float: right; color: #6b7280; }
.customer { margin-bottom: 24px; }
.customer-name { font-size: 14px; font-weight: 600; color: #111827; }
.customer-addr { font-size: 11px; color: #6b7280; margin-top: 2px; }
.customer-vat { font-size: 10px; color: #9ca3af; margin-top: 2px; }
.meta { font-size: 11px; color: #6b7280; margin-bottom: 24px; }
.items-table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
.items-table th { padding: 8px 0; font-size: 10px; text-transform: uppercase; color: #9ca3af; font-weight: 500; border-bottom: 1px solid #e5e7eb; text-align: left; letter-spacing: 0.5px; }
.items-table th.col-qty { width: 60px; text-align: center; }
.items-table th.col-price { width: 90px; text-align: right; }
.items-table th.col-vat { width: 50px; text-align: center; }
.items-table th.col-total { width: 100px; text-align: right; }
.items-table td { padding: 10px 0; font-size: 11px; border-bottom: 1px solid #f3f4f6; }
.totals-section { display: flex; justify-content: flex-end; margin-bottom: 32px; }
.totals { width: 240px; }
.total-line { display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; color: #6b7280; }
.total-final { font-size: 14px; font-weight: 600; color: #111827; padding-top: 8px; margin-top: 4px; border-top: 1px solid #d1d5db; }
.notes { font-size: 11px; color: #9ca3af; margin-bottom: 32px; }
.footer-line { border-top: 1px solid #e5e7eb; margin-bottom: 8px; }
.footer { font-size: 10px; color: #d1d5db; }`;

// ============================================
// TEMPLATE: FORMALE
// ============================================

const FORMALE_HTML = `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"></head>
<body>
<div class="document">
  <div class="company-box">
    <div class="company-header">
      {{company.logo_html}}
      <div class="company-name">{{company.legal_name}}</div>
    </div>
    <div class="company-info">{{company.formal_info}}</div>
  </div>

  <div class="doc-title">
    {{document.type_label}} N. {{document.document_number}}<br>
    <span class="doc-date">del {{document.date}}</span>
  </div>

  <div class="customer-box">
    <div class="customer-prefix">{{label.dear_customer}}</div>
    <div class="customer-name">{{customer.company_name}}</div>
    <div class="customer-info">{{customer.formal_info}}</div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th class="col-num">N.</th>
        <th class="col-desc">{{label.description}}</th>
        <th class="col-qty">{{label.quantity}}</th>
        <th class="col-price">{{label.unit_price}}</th>
        <th class="col-discount">{{label.discount}}</th>
        <th class="col-vat">{{label.vat}}</th>
        <th class="col-total">{{label.total}}</th>
      </tr>
    </thead>
    <tbody>
      {{items}}
    </tbody>
  </table>

  <div class="totals-box">
    <table class="totals-table">
      <tr><td class="label">{{label.subtotal}}</td><td class="value">{{totals.subtotal_net}}</td></tr>
      {{vat_breakdown}}
      {{totals.discount_row}}
      <tr class="total-row"><td class="label">{{label.total}}</td><td class="value">{{totals.total}}</td></tr>
    </table>
  </div>

  <div class="payment-section">{{document.payment_section}}</div>

  {{notes_section}}

  <div class="legal-footer">{{company.legal_footer}}</div>
</div>
</body>
</html>`;

const FORMALE_CSS = `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Times New Roman', Times, serif; font-size: 11px; color: #1a1a1a; line-height: 1.5; }
.document { max-width: 800px; margin: 0 auto; padding: 30px; }
.company-box { border: 1px solid #333; padding: 16px; margin-bottom: 24px; }
.company-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.logo { max-height: 50px; max-width: 150px; }
.company-name { font-size: 18px; font-weight: 700; text-transform: uppercase; }
.company-info { font-size: 10px; color: #4a4a4a; line-height: 1.6; }
.doc-title { text-align: center; font-size: 18px; font-weight: 700; margin-bottom: 20px; text-transform: uppercase; }
.doc-date { font-size: 13px; font-weight: 400; text-transform: none; }
.customer-box { border: 1px solid #666; padding: 14px; margin-bottom: 24px; max-width: 380px; }
.customer-prefix { font-size: 10px; color: #666; font-style: italic; }
.customer-name { font-size: 14px; font-weight: 700; text-transform: uppercase; margin: 2px 0; }
.customer-info { font-size: 10px; color: #4a4a4a; line-height: 1.6; }
.items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #333; }
.items-table th { background: #f5f5f5; padding: 8px 8px; font-size: 9px; text-transform: uppercase; color: #333; font-weight: 700; border: 1px solid #333; text-align: left; }
.items-table th.col-num { width: 30px; text-align: center; }
.items-table th.col-qty { width: 50px; text-align: center; }
.items-table th.col-price { width: 90px; text-align: right; }
.items-table th.col-discount { width: 55px; text-align: center; }
.items-table th.col-vat { width: 55px; text-align: center; }
.items-table th.col-total { width: 90px; text-align: right; }
.items-table td { padding: 6px 8px; font-size: 10px; border: 1px solid #ccc; }
.totals-box { border: 1px solid #333; padding: 0; margin-bottom: 20px; float: right; width: 300px; }
.totals-table { width: 100%; border-collapse: collapse; }
.totals-table td { padding: 5px 10px; font-size: 10px; border-bottom: 1px solid #ddd; }
.totals-table .label { color: #4a4a4a; }
.totals-table .value { text-align: right; font-weight: 500; }
.totals-table .total-row td { font-size: 13px; font-weight: 700; border-top: 2px solid #333; border-bottom: none; background: #f5f5f5; padding: 8px 10px; }
.payment-section { clear: both; padding-top: 16px; margin-bottom: 16px; }
.payment-line { font-size: 11px; color: #333; margin-bottom: 2px; }
.notes { font-size: 10px; color: #4a4a4a; margin-bottom: 20px; padding: 10px; background: #fafafa; border: 1px solid #eee; }
.legal-footer { margin-top: 30px; padding-top: 12px; border-top: 2px double #333; font-size: 9px; color: #666; text-align: center; line-height: 1.6; }`;

// ============================================
// SEED FUNCTION
// ============================================

const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    name: "Classico",
    description: "Template tradizionale con layout professionale. Logo a sinistra, dati documento a destra, tabella con bordi e tonalità grigie.",
    html_template: CLASSICO_HTML,
    css_styles: CLASSICO_CSS,
    header_config: { show_logo: true, logo_position: "left", show_company_info: true, style: "standard" },
    footer_config: { enabled: true, show_notes: true, show_page_numbers: false },
    is_default: true,
  },
  {
    name: "Moderno",
    description: "Design moderno con barra colore teal, card arrotondate e righe alternate. Perfetto per un'immagine aziendale contemporanea.",
    html_template: MODERNO_HTML,
    css_styles: MODERNO_CSS,
    header_config: { show_logo: true, logo_position: "left", show_company_info: true, style: "banner" },
    footer_config: { enabled: true, show_notes: true, show_page_numbers: true },
    is_default: false,
  },
  {
    name: "Minimale",
    description: "Design ultra-pulito con massimo spazio bianco. Logo centrato, linee sottili, tipografia essenziale.",
    html_template: MINIMALE_HTML,
    css_styles: MINIMALE_CSS,
    header_config: { show_logo: true, logo_position: "center", show_company_info: false, style: "minimal" },
    footer_config: { enabled: true, show_notes: true, show_page_numbers: false },
    is_default: false,
  },
  {
    name: "Formale",
    description: "Layout formale/legale italiano. Box con bordi, prefisso 'Spett.le', tabella con doppi bordi, piè di pagina con dati legali.",
    html_template: FORMALE_HTML,
    css_styles: FORMALE_CSS,
    header_config: { show_logo: true, logo_position: "left", show_company_info: true, style: "standard" },
    footer_config: { enabled: true, show_notes: true, show_page_numbers: false, custom_text: "Documento informatico ai sensi dell'art. 21 D.Lgs 82/2005" },
    is_default: false,
  },
];

/**
 * Seed 4 standard document templates for a tenant.
 * Idempotent: skips if system templates already exist (unless force=true).
 *
 * @param force - Delete existing system templates and re-create them.
 * @returns Number of templates created.
 */
export async function seedDocumentTemplates(
  tenantDb: string,
  tenantId: string,
  force: boolean = false,
): Promise<number> {
  const { DocumentTemplate } = await connectWithModels(tenantDb);

  if (force) {
    // Delete all existing system templates and re-create
    await DocumentTemplate.deleteMany({ tenant_id: tenantId, is_system: true });
  } else {
    // Skip if system templates already exist
    const existingCount = await DocumentTemplate.countDocuments({
      tenant_id: tenantId,
      is_system: true,
    });
    if (existingCount > 0) return 0;
  }

  const templates = TEMPLATE_DEFINITIONS.map((def) => ({
    template_id: nanoid(12),
    tenant_id: tenantId,
    name: def.name,
    description: def.description,
    document_type: "all",
    html_template: def.html_template,
    css_styles: def.css_styles,
    page_size: "A4",
    orientation: "portrait",
    margins: { top: 15, right: 15, bottom: 15, left: 15 },
    header_config: def.header_config,
    footer_config: def.footer_config,
    is_default: def.is_default,
    is_system: true,
  }));

  await DocumentTemplate.insertMany(templates);
  return templates.length;
}
