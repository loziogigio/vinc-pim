/**
 * Document Template Preview Data
 *
 * Provides sample data and placeholder replacement for template preview.
 * Used by the template editor to render a realistic document preview
 * instead of showing raw {{placeholder}} tokens.
 *
 * Accepts optional real company data from home-settings branding/company_info.
 */

import type { TemplateHeaderConfig, TemplateFooterConfig } from "@/lib/constants/document";

// ============================================
// TYPES
// ============================================

/** Company data for preview - from home-settings branding + company_info */
export interface PreviewCompanyData {
  legal_name?: string;
  address_line1?: string;
  address_line2?: string;
  vat_number?: string;
  fiscal_code?: string;
  phone?: string;
  email?: string;
  pec_email?: string;
  sdi_code?: string;
  logo_url?: string;
}

// ============================================
// FORMATTING
// ============================================

function fmtCurrency(amount: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(amount);
}

function fmtDate(date: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

// ============================================
// FALLBACK SAMPLE DATA
// ============================================

const FALLBACK_COMPANY: PreviewCompanyData = {
  legal_name: "Azienda Demo S.r.l.",
  address_line1: "Via Roma, 1",
  address_line2: "20100 Milano (MI)",
  vat_number: "IT01234567890",
  fiscal_code: "01234567890",
  phone: "+39 02 1234567",
  email: "info@aziendademo.it",
  pec_email: "demo@pec.it",
  sdi_code: "M5UXCR1",
  logo_url: "",
};

const SAMPLE_CUSTOMER = {
  company_name: "Rossini Costruzioni S.p.A.",
  email: "contabilita@rossinicostruzioni.it",
  vat_number: "IT01234567890",
  fiscal_code: "01234567890",
  pec_email: "rossini@pec.it",
  sdi_code: "A1B2C3D",
  billing_address: {
    street_address: "Corso Italia, 156",
    city: "Roma",
    province: "RM",
    postal_code: "00198",
    country: "IT",
  },
};

const SAMPLE_ITEMS = [
  { line_number: 10, description: "Consulenza tecnica specializzata", sku: "CONS-001", quantity: 2, quantity_unit: "ore", unit_price: 150, vat_rate: 22, discount_percent: 0, line_total: 366 },
  { line_number: 20, description: "Licenza software gestionale annuale", sku: "LIC-PRO", quantity: 1, quantity_unit: "", unit_price: 1200, vat_rate: 22, discount_percent: 0, line_total: 1464 },
  { line_number: 30, description: "Manuale operativo e documentazione", sku: "DOC-100", quantity: 5, quantity_unit: "pz", unit_price: 25, vat_rate: 4, discount_percent: 0, line_total: 130 },
];

const SAMPLE_TOTALS = {
  subtotal_net: 1625, total_discount: 0, total_vat: 335, total: 1960,
  vat_breakdown: [
    { rate: 4, taxable: 125, vat: 5 },
    { rate: 22, taxable: 1500, vat: 330 },
  ],
};

const SAMPLE_DATE = new Date(2026, 0, 15);
const SAMPLE_DUE_DATE = new Date(2026, 1, 14);
const SAMPLE_DOC_NUMBER = "INV-2026-00042";
const SAMPLE_NOTES = "Pagamento tramite bonifico bancario entro 30 giorni dalla data di emissione.";
const SAMPLE_FOOTER_TEXT = "Documento informatico ai sensi dell'art. 21 DPR 633/72";

// ============================================
// LINE ITEMS & VAT BREAKDOWN HTML
// ============================================

interface SampleColumnOptions {
  showLineNumber?: boolean;
  showDiscount?: boolean;
}

function detectColumnsFromHtml(html: string): SampleColumnOptions {
  return {
    showLineNumber: html.includes("col-num"),
    showDiscount: html.includes("col-discount"),
  };
}

function renderSampleItemsHtml(options: SampleColumnOptions = {}): string {
  const { showLineNumber = true, showDiscount = true } = options;
  const td = (style: string, content: string) =>
    `<td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;${style}">${content}</td>`;

  return SAMPLE_ITEMS.map(item => {
    const cells: string[] = [];
    if (showLineNumber) cells.push(td("", String(item.line_number)));
    cells.push(td("", `${item.description}${item.sku ? `<br><small style="color:#6b7280;">${item.sku}</small>` : ""}`));
    cells.push(td(" text-align:center;", `${item.quantity}${item.quantity_unit ? ` ${item.quantity_unit}` : ""}`));
    cells.push(td(" text-align:right;", fmtCurrency(item.unit_price)));
    if (showDiscount) cells.push(td(" text-align:center;", item.discount_percent ? `${item.discount_percent}%` : "-"));
    cells.push(td(" text-align:center;", `${item.vat_rate}%`));
    cells.push(td(" text-align:right; font-weight:500;", fmtCurrency(item.line_total)));
    return `<tr>\n      ${cells.join("\n      ")}\n    </tr>`;
  }).join("\n");
}

function renderSampleVatBreakdownHtml(): string {
  return SAMPLE_TOTALS.vat_breakdown.map(entry => `
    <tr>
      <td style="padding: 4px 12px;">IVA ${entry.rate}%</td>
      <td style="padding: 4px 12px; text-align:right;">${fmtCurrency(entry.taxable)}</td>
      <td style="padding: 4px 12px; text-align:right;">${fmtCurrency(entry.vat)}</td>
    </tr>`).join("\n");
}

// ============================================
// HEADER / FOOTER PREVIEW RENDERING
// ============================================

function renderPreviewHeader(config: TemplateHeaderConfig, c: Required<PreviewCompanyData>): string {
  const dateStr = fmtDate(SAMPLE_DATE);
  const dueDateStr = fmtDate(SAMPLE_DUE_DATE);
  const logoImg = c.logo_url ? `<img src="${c.logo_url}" alt="" style="max-height:60px;max-width:200px;margin-bottom:12px;" />` : "";

  if (config.style === "minimal") {
    return `<div style="margin-bottom:24px;">
      <div style="font-size:16px;font-weight:700;color:#111827;">${c.legal_name}</div>
      <div style="border-top:1px solid #e5e7eb;margin-top:8px;"></div>
    </div>`;
  }

  if (config.style === "centered") {
    return `<div style="text-align:center;margin-bottom:32px;">
      ${config.show_logo && logoImg ? `<div>${logoImg}</div>` : ""}
      <div style="font-size:16px;font-weight:700;color:#111827;">${c.legal_name}</div>
      ${config.show_company_info ? `<div style="font-size:11px;color:#9ca3af;">${c.address_line1}, ${c.address_line2}</div>` : ""}
      <div style="margin-top:16px;font-size:20px;font-weight:600;">Fattura ${SAMPLE_DOC_NUMBER}</div>
      <div style="font-size:12px;color:#6b7280;">${dateStr}</div>
    </div>`;
  }

  if (config.style === "banner") {
    return `<div style="background:#009688;color:white;padding:16px 24px;margin:-40px -40px 24px;display:flex;justify-content:space-between;align-items:center;">
      <div style="display:flex;align-items:center;gap:12px;">
        ${config.show_logo && c.logo_url ? `<img src="${c.logo_url}" alt="" style="max-height:40px;" />` : ""}
        <span style="font-size:16px;font-weight:700;">${c.legal_name}</span>
      </div>
      <span style="font-size:18px;font-weight:600;">Fattura</span>
    </div>`;
  }

  // "standard"
  const logoPos = config.logo_position || "left";
  return `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;">
    <div style="max-width:55%;${logoPos === "right" ? "order:2;" : ""}">
      ${config.show_logo ? logoImg : ""}
      <div style="font-size:16px;font-weight:700;color:#111827;">${c.legal_name}</div>
      ${config.show_company_info ? `<div style="font-size:11px;color:#9ca3af;">
        ${c.address_line1}, ${c.address_line2}<br>
        P.IVA: ${c.vat_number}${c.fiscal_code ? ` - C.F.: ${c.fiscal_code}` : ""}<br>
        ${c.phone ? `Tel: ${c.phone}` : ""}${c.email ? ` - ${c.email}` : ""}
        ${c.pec_email ? `<br>PEC: ${c.pec_email}` : ""}
      </div>` : ""}
    </div>
    <div style="text-align:right;${logoPos === "right" ? "order:1;" : ""}">
      <div style="font-size:24px;font-weight:700;color:#111827;">Fattura</div>
      <div style="font-size:16px;color:#6b7280;">${SAMPLE_DOC_NUMBER}</div>
      <div style="margin-top:12px;font-size:12px;color:#6b7280;">
        Data: ${dateStr}<br>Scadenza: ${dueDateStr}<br>Termini: 30 giorni
      </div>
    </div>
  </div>`;
}

function renderPreviewFooter(config: TemplateFooterConfig, c: Required<PreviewCompanyData>): string {
  if (!config.enabled) return "";
  const parts: string[] = [];

  parts.push('<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;">');

  if (config.show_notes) {
    parts.push(`<div style="font-size:12px;color:#6b7280;margin-bottom:8px;">${SAMPLE_NOTES}</div>`);
  }
  if (config.custom_text) {
    parts.push(`<div style="font-size:11px;color:#9ca3af;margin-bottom:8px;">${config.custom_text}</div>`);
  }
  if (config.show_page_numbers) {
    parts.push(`<div style="font-size:10px;color:#9ca3af;text-align:right;">${c.legal_name}${c.vat_number ? ` · P.IVA ${c.vat_number}` : ""}</div>`);
  }

  parts.push("</div>");
  return parts.join("\n");
}

// ============================================
// MAIN PREVIEW BUILDER
// ============================================

/**
 * Replace all {{placeholder}} tokens in template HTML with document data.
 * Uses real company branding when provided, falls back to sample data.
 */
export function buildPreviewHtml(
  html: string,
  headerConfig?: TemplateHeaderConfig,
  footerConfig?: TemplateFooterConfig,
  companyData?: PreviewCompanyData
): string {
  // Merge real company data over fallback defaults
  const c = {
    legal_name: companyData?.legal_name || FALLBACK_COMPANY.legal_name!,
    address_line1: companyData?.address_line1 || FALLBACK_COMPANY.address_line1!,
    address_line2: companyData?.address_line2 || FALLBACK_COMPANY.address_line2!,
    vat_number: companyData?.vat_number || FALLBACK_COMPANY.vat_number!,
    fiscal_code: companyData?.fiscal_code || FALLBACK_COMPANY.fiscal_code!,
    phone: companyData?.phone || FALLBACK_COMPANY.phone!,
    email: companyData?.email || FALLBACK_COMPANY.email!,
    pec_email: companyData?.pec_email || FALLBACK_COMPANY.pec_email!,
    sdi_code: companyData?.sdi_code || FALLBACK_COMPANY.sdi_code!,
    logo_url: companyData?.logo_url || "",
  };

  const cust = SAMPLE_CUSTOMER;
  const addr = cust.billing_address;
  const dateStr = fmtDate(SAMPLE_DATE);
  const dueDateStr = fmtDate(SAMPLE_DUE_DATE);

  const data: Record<string, string> = {
    // Company fields
    "company.legal_name": c.legal_name,
    "company.address_line1": c.address_line1,
    "company.address_line2": c.address_line2,
    "company.vat_number": c.vat_number,
    "company.fiscal_code": c.fiscal_code,
    "company.phone": c.phone,
    "company.email": c.email,
    "company.pec_email": c.pec_email,
    "company.sdi_code": c.sdi_code,
    "company.logo_url": c.logo_url,

    // Customer fields
    "customer.company_name": cust.company_name,
    "customer.first_name": "",
    "customer.last_name": "",
    "customer.email": cust.email,
    "customer.vat_number": cust.vat_number,
    "customer.fiscal_code": cust.fiscal_code,
    "customer.pec_email": cust.pec_email,
    "customer.sdi_code": cust.sdi_code,
    "customer.billing_address.street_address": addr.street_address,
    "customer.billing_address.city": addr.city,
    "customer.billing_address.province": addr.province,
    "customer.billing_address.postal_code": addr.postal_code,
    "customer.billing_address.country": addr.country,

    // Document fields
    "document.document_number": SAMPLE_DOC_NUMBER,
    "document.date": dateStr,
    "document.due_date": dueDateStr,
    "document.payment_terms": "30 giorni",
    "document.type_label": "Fattura",
    "document.notes": SAMPLE_NOTES,
    "document.footer_text": SAMPLE_FOOTER_TEXT,

    // Totals
    "totals.subtotal_net": fmtCurrency(SAMPLE_TOTALS.subtotal_net),
    "totals.total_vat": fmtCurrency(SAMPLE_TOTALS.total_vat),
    "totals.total_discount": fmtCurrency(SAMPLE_TOTALS.total_discount),
    "totals.total": fmtCurrency(SAMPLE_TOTALS.total),

    // Dynamic HTML blocks (detect columns from template <thead>)
    items: renderSampleItemsHtml(detectColumnsFromHtml(html)),
    vat_breakdown: renderSampleVatBreakdownHtml(),
    header: headerConfig ? renderPreviewHeader(headerConfig, c) : "",
    footer: footerConfig ? renderPreviewFooter(footerConfig, c) : "",

    // Labels (Italian)
    "label.recipient": "Destinatario",
    "label.vat_number": "P.IVA",
    "label.fiscal_code": "C.F.",
    "label.pec_email": "PEC",
    "label.sdi_code": "SDI",
    "label.description": "Descrizione",
    "label.quantity": "Qtà",
    "label.unit_price": "Prezzo Unit.",
    "label.discount": "Sconto",
    "label.vat": "IVA",
    "label.total": "Totale",
    "label.subtotal": "Imponibile",
    "label.notes": "Note",
    "label.date": "Data",
    "label.due_date": "Scadenza",
    "label.payment_terms_label": "Termini",
    "label.document_label": "Documento",
    "label.dear_customer": "Spett.le",
    "label.registered_office": "Sede legale",
    "label.page": "Pagina",
    "label.draft": "BOZZA",
    "label.total_discount": "Sconto totale",
    "label.payment_conditions": "Condizioni di pagamento",
    "label.ico": "",
    "label.dic": "",
    "label.ic_dph": "",

    // Pre-computed display fields (company)
    "company.logo_html": c.logo_url ? `<img src="${c.logo_url}" class="logo" />` : "",
    "company.fiscal_ids": `<br>P.IVA: ${c.vat_number}${c.fiscal_code ? ` - C.F.: ${c.fiscal_code}` : ""}`,
    "company.contact_line": `<br>${c.phone ? `Tel: ${c.phone}` : ""}${c.email ? ` - ${c.email}` : ""}`,
    "company.pec_line": c.pec_email ? `<br>PEC: ${c.pec_email}` : "",
    "company.summary_line": [c.address_line1, c.address_line2].filter(Boolean).join(", ") + ` · P.IVA ${c.vat_number}` + (c.phone ? ` · ${c.phone}` : "") + (c.email ? ` · ${c.email}` : ""),
    "company.footer_line": `${c.legal_name} · P.IVA ${c.vat_number}${c.pec_email ? ` · PEC: ${c.pec_email}` : ""}<br>${SAMPLE_FOOTER_TEXT}`,
    "company.formal_info": [
      `Sede legale: ${[c.address_line1, c.address_line2].filter(Boolean).join(", ")}`,
      `P.IVA: ${c.vat_number}`,
      c.fiscal_code ? `C.F.: ${c.fiscal_code}` : "",
      c.phone ? `Tel: ${c.phone}` : "",
      c.email ? `Email: ${c.email}` : "",
      c.pec_email ? `PEC: ${c.pec_email}` : "",
      c.sdi_code ? `SDI: ${c.sdi_code}` : "",
    ].filter(Boolean).join("<br>"),
    "company.legal_footer": `${c.legal_name} — P.IVA ${c.vat_number}${c.fiscal_code ? ` — C.F. ${c.fiscal_code}` : ""}<br>${SAMPLE_FOOTER_TEXT}`,

    // Pre-computed display fields (customer)
    "customer.fiscal_ids": `P.IVA: ${cust.vat_number} - C.F.: ${cust.fiscal_code}`,
    "customer.pec_sdi_line": `<br>PEC: ${cust.pec_email} - SDI: ${cust.sdi_code}`,
    "customer.vat_line": `<div class="customer-vat">P.IVA ${cust.vat_number}</div>`,
    "customer.formal_info": `${addr.street_address}<br>${addr.postal_code} ${addr.city} (${addr.province})<br>P.IVA: ${cust.vat_number}<br>C.F.: ${cust.fiscal_code}<br>PEC: ${cust.pec_email}<br>SDI: ${cust.sdi_code}`,

    // Pre-computed display fields (document)
    "document.due_date_line": `Scadenza: ${dueDateStr}<br>`,
    "document.payment_terms_line": "Termini: 30 giorni",
    "document.due_date_card": `<div class="card-detail">Scadenza: ${dueDateStr}</div>`,
    "document.payment_terms_card": `<div class="card-detail">Termini: 30 giorni</div>`,
    "document.meta_line": `<div class="meta">Scadenza: ${dueDateStr} · 30 giorni</div>`,
    "document.payment_section": `<div class="payment-line">Condizioni di pagamento: 30 giorni</div>\n<div class="payment-line">Scadenza: ${dueDateStr}</div>`,

    // Pre-computed display fields (totals/sections)
    "totals.discount_row": "",
    notes_section: `<div class="notes-section"><div class="notes-label">Note</div><div class="notes-text">${SAMPLE_NOTES}</div></div>`,
    footer_text_section: `<div class="footer-text">${SAMPLE_FOOTER_TEXT}</div>`,
  };

  return html.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_match, key) => {
    const value = data[key];
    return value !== undefined ? value : "";
  });
}
