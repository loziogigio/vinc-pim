/**
 * Document PDF Service
 *
 * Generates PDFs from documents using HTML templates and Puppeteer.
 * Handles template rendering and CDN upload.
 */

import { connectWithModels } from "@/lib/db/connection";
import { DOCUMENT_TYPE_LABELS, PAYMENT_TERMS_LABELS } from "@/lib/constants/document";
import type { PaymentTerms } from "@/lib/constants/document";
import type { TemplateHeaderConfig, TemplateFooterConfig } from "@/lib/constants/document";
import { getLabels, getLocale } from "@/lib/constants/countries";
import type { CountryLabels } from "@/lib/constants/countries/types";
import type { IDocument } from "@/lib/db/models/document";
import type { IDocumentTemplate } from "@/lib/db/models/document-template";
import type { DocumentLineItem, DocumentTotals, VatBreakdownEntry } from "@/lib/types/document";

/**
 * Fetch an image URL and return a base64 data URI.
 * This embeds images directly in the HTML so Puppeteer doesn't need to make
 * external HTTP requests (which can fail when there's no base URL or network restrictions).
 * Returns null if the fetch fails — the broken image placeholder is acceptable.
 */
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      console.warn(`[DocumentPDF] Image fetch failed (${response.status}): ${url}`);
      return null;
    }
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${Buffer.from(buffer).toString("base64")}`;
  } catch (err) {
    console.warn(`[DocumentPDF] Image fetch error: ${err instanceof Error ? err.message : err} — ${url}`);
    return null;
  }
}

/**
 * Replace <img src="..."> URLs in HTML with base64 data URIs.
 * Only processes absolute HTTP/HTTPS URLs to avoid touching relative paths or data URIs.
 */
async function embedImagesAsBase64(html: string): Promise<string> {
  const imgSrcRegex = /<img([^>]*?)src="(https?:\/\/[^"]+)"([^>]*?)>/gi;
  const matches = [...html.matchAll(imgSrcRegex)];
  if (matches.length === 0) return html;

  // Deduplicate URLs before fetching — same logo can appear in header and footer
  const uniqueUrls = [...new Set(matches.map((m) => m[2]))];
  const fetched = await Promise.all(
    uniqueUrls.map(async (url) => [url, await fetchImageAsBase64(url)] as const)
  );
  const urlToDataUri = new Map(fetched.filter(([, dataUri]) => dataUri !== null));

  if (urlToDataUri.size === 0) return html;

  return html.replace(imgSrcRegex, (fullMatch, before, url, after) => {
    const dataUri = urlToDataUri.get(url);
    return dataUri ? `<img${before}src="${dataUri}"${after}>` : fullMatch;
  });
}

/**
 * Resolve payment_terms raw value to a human-readable label.
 * For custom_date / custom_days, returns empty string (the due_date line handles display).
 */
function resolvePaymentTermsLabel(raw?: string): string {
  if (!raw) return "";
  if (raw === "custom_date" || raw === "custom_days") return "";
  return PAYMENT_TERMS_LABELS[raw as PaymentTerms] || raw;
}

// ============================================
// TEMPLATE RENDERING
// ============================================

/**
 * Replace {{placeholder}} tokens in a template string.
 */
function replacePlaceholders(template: string, data: Record<string, string | undefined>): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, key) => {
    const value = data[key];
    return value !== undefined && value !== null ? String(value) : "";
  });
}

/**
 * Format a number as currency (Italian locale).
 */
function formatCurrency(amount: number, currency: string = "EUR", locale: string = "it-IT"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a date for the given locale.
 */
function formatDate(date: Date | string | undefined, locale: string = "it-IT"): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/**
 * Options for which columns to render in item rows.
 * Detected from template <thead> to match column count.
 */
interface LineItemColumnOptions {
  showLineNumber?: boolean;
  showDiscount?: boolean;
}

/**
 * Detect which columns a template uses by checking for CSS classes in <thead>.
 */
function detectTemplateColumns(htmlTemplate: string): LineItemColumnOptions {
  return {
    showLineNumber: htmlTemplate.includes("col-num"),
    showDiscount: htmlTemplate.includes("col-discount"),
  };
}

/**
 * Render line items as HTML table rows.
 * Column count adapts to match the template's <thead> structure.
 */
function renderLineItemsHtml(
  items: DocumentLineItem[],
  currency: string,
  locale: string = "it-IT",
  options: LineItemColumnOptions = {}
): string {
  const { showLineNumber = true, showDiscount = true } = options;
  const td = (style: string, content: string) =>
    `<td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;${style}">${content}</td>`;

  return items
    .map((item) => {
      const cells: string[] = [];
      if (showLineNumber) cells.push(td("", String(item.line_number)));
      cells.push(td("", `${item.description}${item.sku ? `<br><small style="color:#6b7280;">${item.sku}</small>` : ""}`));
      cells.push(td(" text-align:center;", `${item.quantity}${item.quantity_unit ? ` ${item.quantity_unit}` : ""}`));
      cells.push(td(" text-align:right;", formatCurrency(item.unit_price, currency, locale)));
      if (showDiscount) cells.push(td(" text-align:center;", item.discount_percent ? `${item.discount_percent}%` : "-"));
      cells.push(td(" text-align:center;", `${item.vat_rate}%`));
      cells.push(td(" text-align:right; font-weight:500;", formatCurrency(item.line_total, currency, locale)));
      return `<tr>\n      ${cells.join("\n      ")}\n    </tr>`;
    })
    .join("\n");
}

/**
 * Render VAT breakdown as HTML rows.
 */
function renderVatBreakdownHtml(
  breakdown: VatBreakdownEntry[],
  currency: string,
  locale: string = "it-IT",
  vatLabel: string = "IVA"
): string {
  return breakdown
    .map(
      (entry) => `
    <tr>
      <td style="padding: 4px 12px;">${vatLabel} ${entry.rate}%</td>
      <td style="padding: 4px 12px; text-align:right;">${formatCurrency(entry.taxable, currency, locale)}</td>
      <td style="padding: 4px 12px; text-align:right;">${formatCurrency(entry.vat, currency, locale)}</td>
    </tr>`
    )
    .join("\n");
}

/**
 * Build label flatData from country labels (label.recipient, label.vat, etc.)
 */
function buildLabelFlatData(labels: CountryLabels): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(labels.template)) {
    result[`label.${key}`] = String(value);
  }
  return result;
}

/**
 * Build pre-computed display fields for template rendering.
 * Handles conditional display of company/customer fiscal IDs, dates, notes, etc.
 */
function buildDisplayFields(
  d: any,
  labels: CountryLabels,
  locale: string,
  currency: string
): Record<string, string> {
  const company = d.company || {};
  const customer = d.customer || {};
  const addr = customer.billing_address || {};
  const docDate = formatDate(d.finalized_at || d.created_at, locale);
  const dueDateStr = formatDate(d.due_date, locale);

  // Company fiscal IDs (P.IVA + C.F. or IČ DPH + DIČ + IČO)
  const companyFiscalParts: string[] = [];
  if (company.vat_number) companyFiscalParts.push(`${labels.template.vat_number}: ${company.vat_number}`);
  if (company.fiscal_code) companyFiscalParts.push(`${labels.template.fiscal_code}: ${company.fiscal_code}`);

  // Company contact line
  const contactParts: string[] = [];
  if (company.phone) contactParts.push(`Tel: ${company.phone}`);
  if (company.email) contactParts.push(company.email);

  // Customer fiscal IDs
  const custFiscalParts: string[] = [];
  if (customer.vat_number) custFiscalParts.push(`${labels.template.vat_number}: ${customer.vat_number}`);
  if (customer.fiscal_code) custFiscalParts.push(`${labels.template.fiscal_code}: ${customer.fiscal_code}`);

  const custPecSdiParts: string[] = [];
  if (customer.pec_email) custPecSdiParts.push(`PEC: ${customer.pec_email}`);
  if (customer.sdi_code) custPecSdiParts.push(`SDI: ${customer.sdi_code}`);

  // Notes section HTML
  const notesHtml = d.notes
    ? `<div class="notes-section"><div class="notes-label">${labels.template.notes}</div><div class="notes-text">${d.notes}</div></div>`
    : "";

  // Discount row HTML
  const discountRowHtml = d.totals?.total_discount
    ? `<tr><td class="label">${labels.template.discount}</td><td class="value">-${formatCurrency(d.totals.total_discount, currency, locale)}</td></tr>`
    : "";

  // Formal company info (for Formale template)
  const formalParts: string[] = [];
  formalParts.push(`${labels.template.registered_office}: ${[company.address_line1, company.address_line2].filter(Boolean).join(", ")}`);
  if (company.vat_number) formalParts.push(`${labels.template.vat_number}: ${company.vat_number}`);
  if (company.fiscal_code) formalParts.push(`${labels.template.fiscal_code}: ${company.fiscal_code}`);
  if (company.phone) formalParts.push(`Tel: ${company.phone}`);
  if (company.email) formalParts.push(`Email: ${company.email}`);
  if (company.pec_email) formalParts.push(`PEC: ${company.pec_email}`);
  if (company.sdi_code) formalParts.push(`SDI: ${company.sdi_code}`);

  // Formal customer info
  const custFormalParts: string[] = [];
  if (addr.street_address) custFormalParts.push(`${addr.street_address}<br>${addr.postal_code || ""} ${addr.city || ""} (${addr.province || ""})`);
  if (customer.vat_number) custFormalParts.push(`${labels.template.vat_number}: ${customer.vat_number}`);
  if (customer.fiscal_code) custFormalParts.push(`${labels.template.fiscal_code}: ${customer.fiscal_code}`);
  if (customer.pec_email) custFormalParts.push(`PEC: ${customer.pec_email}`);
  if (customer.sdi_code) custFormalParts.push(`SDI: ${customer.sdi_code}`);

  // Company summary line (for Moderno)
  const summaryParts: string[] = [];
  if (company.address_line1) summaryParts.push([company.address_line1, company.address_line2].filter(Boolean).join(", "));
  if (company.vat_number) summaryParts.push(`${labels.template.vat_number} ${company.vat_number}`);
  if (company.phone) summaryParts.push(company.phone);
  if (company.email) summaryParts.push(company.email);

  // Footer line (for Moderno)
  const footerLineParts: string[] = [company.legal_name || ""];
  if (company.vat_number) footerLineParts.push(`${labels.template.vat_number} ${company.vat_number}`);
  if (company.pec_email) footerLineParts.push(`PEC: ${company.pec_email}`);
  let footerLine = footerLineParts.join(" · ");
  if (d.footer_text) footerLine += `<br>${d.footer_text}`;

  // Legal footer (for Formale)
  const legalParts: string[] = [company.legal_name || ""];
  if (company.vat_number) legalParts.push(`${labels.template.vat_number} ${company.vat_number}`);
  if (company.fiscal_code) legalParts.push(`${labels.template.fiscal_code} ${company.fiscal_code}`);
  let legalFooter = legalParts.join(" — ");
  if (d.footer_text) legalFooter += `<br>${d.footer_text}`;

  // Payment section (for Formale)
  const paymentTermsLabel = resolvePaymentTermsLabel(d.payment_terms);
  const paymentParts: string[] = [];
  if (paymentTermsLabel) paymentParts.push(`<div class="payment-line">${labels.template.payment_conditions}: ${paymentTermsLabel}</div>`);
  if (dueDateStr) paymentParts.push(`<div class="payment-line">${labels.template.due_date}: ${dueDateStr}</div>`);

  return {
    "company.logo_html": company.logo_url ? `<img src="${company.logo_url}" class="logo" />` : "",
    "company.fiscal_ids": companyFiscalParts.length ? `<br>${companyFiscalParts.join(" - ")}` : "",
    "company.contact_line": contactParts.length ? `<br>${contactParts.join(" - ")}` : "",
    "company.pec_line": company.pec_email ? `<br>PEC: ${company.pec_email}` : "",
    "company.summary_line": summaryParts.join(" · "),
    "company.footer_line": footerLine,
    "company.formal_info": formalParts.join("<br>"),
    "company.legal_footer": legalFooter,
    "customer.fiscal_ids": custFiscalParts.join(" - "),
    "customer.pec_sdi_line": custPecSdiParts.length ? `<br>${custPecSdiParts.join(" - ")}` : "",
    "customer.vat_line": customer.vat_number
      ? `<div class="customer-vat">${labels.template.vat_number} ${customer.vat_number}</div>`
      : "",
    "customer.formal_info": custFormalParts.join("<br>"),
    "document.due_date_line": dueDateStr ? `${labels.template.due_date}: ${dueDateStr}<br>` : "",
    "document.payment_terms_line": paymentTermsLabel ? `${labels.template.payment_terms_label}: ${paymentTermsLabel}` : "",
    "document.due_date_card": dueDateStr
      ? `<div class="card-detail">${labels.template.due_date}: ${dueDateStr}</div>`
      : "",
    "document.payment_terms_card": paymentTermsLabel
      ? `<div class="card-detail">${labels.template.payment_terms_label}: ${paymentTermsLabel}</div>`
      : "",
    "document.meta_line": dueDateStr
      ? `<div class="meta">${labels.template.due_date}: ${dueDateStr}${paymentTermsLabel ? ` · ${paymentTermsLabel}` : ""}</div>`
      : "",
    "document.payment_section": paymentParts.join("\n"),
    "totals.discount_row": discountRowHtml,
    notes_section: notesHtml,
    footer_text_section: d.footer_text ? `<div class="footer-text">${d.footer_text}</div>` : "",

    // Conditional meta rows (output full <tr> or empty string)
    "document.due_date_meta_row": dueDateStr
      ? `<tr><td class="lbl">${labels.template.due_date}</td><td>${dueDateStr}</td></tr>`
      : "",
    "document.payment_terms_meta_row": paymentTermsLabel
      ? `<tr><td class="lbl">${labels.template.payment_terms_label}</td><td>${paymentTermsLabel}</td></tr>`
      : "",

    // Amount due block (full div or empty)
    "amount_due_block": dueDateStr
      ? `<div class="amount-due"><div class="amount-due-text">${formatCurrency(d.totals?.total || 0, currency, locale)} ${labels.template.due_date.toLowerCase()} ${dueDateStr}</div></div>`
      : "",

    // 2-column VAT breakdown (label + vat amount only, for simple totals tables)
    "vat_breakdown_simple": (d.totals?.vat_breakdown || []).map((v: VatBreakdownEntry) =>
      `<tr><td>${labels.template.vat} ${v.rate}%</td><td class="val">${formatCurrency(v.vat, currency, locale)}</td></tr>`
    ).join(""),
  };
}

/**
 * Render auto-generated header HTML from header_config.
 * Used when custom templates include {{header}} placeholder.
 */
function renderConfigHeader(
  config: TemplateHeaderConfig,
  company: Record<string, string | undefined>,
  docInfo: { type_label: string; document_number: string; date: string; due_date?: string; payment_terms?: string },
  labels?: CountryLabels
): string {
  if (config.style === "minimal") {
    return `<div style="margin-bottom:24px;">
      <div style="font-size:16px;font-weight:700;color:#111827;">${company.legal_name || ""}</div>
      <div style="border-top:1px solid #e5e7eb;margin-top:8px;"></div>
    </div>`;
  }

  if (config.style === "centered") {
    return `<div style="text-align:center;margin-bottom:32px;">
      ${config.show_logo && company.logo_url ? `<img src="${company.logo_url}" alt="" style="max-height:60px;margin:0 auto 12px;" />` : ""}
      <div style="font-size:16px;font-weight:700;color:#111827;">${company.legal_name || ""}</div>
      ${config.show_company_info ? `<div style="font-size:11px;color:#9ca3af;">${company.address_line1 || ""}</div>` : ""}
      <div style="margin-top:16px;font-size:20px;font-weight:600;">${docInfo.type_label} ${docInfo.document_number}</div>
      <div style="font-size:12px;color:#6b7280;">${docInfo.date}</div>
    </div>`;
  }

  if (config.style === "banner") {
    return `<div style="background:#009688;color:white;padding:16px 24px;margin:-40px -40px 24px;display:flex;justify-content:space-between;align-items:center;">
      <div style="display:flex;align-items:center;gap:12px;">
        ${config.show_logo && company.logo_url ? `<img src="${company.logo_url}" alt="" style="max-height:40px;" />` : ""}
        <span style="font-size:16px;font-weight:700;">${company.legal_name || ""}</span>
      </div>
      <span style="font-size:18px;font-weight:600;">${docInfo.type_label}</span>
    </div>`;
  }

  // "standard" (default) — logo left, doc info right
  const logoPos = config.logo_position || "left";
  return `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;">
    <div style="max-width:55%;${logoPos === "right" ? "order:2;" : ""}">
      ${config.show_logo && company.logo_url ? `<img src="${company.logo_url}" alt="" style="max-height:60px;max-width:200px;margin-bottom:12px;" />` : ""}
      <div style="font-size:16px;font-weight:700;color:#111827;">${company.legal_name || ""}</div>
      ${config.show_company_info ? `<div style="font-size:11px;color:#9ca3af;">
        ${[company.address_line1, company.address_line2].filter(Boolean).join(", ")}<br>
        ${company.vat_number ? `${labels?.template.vat_number || "P.IVA"}: ${company.vat_number}` : ""}${company.fiscal_code ? ` - ${labels?.template.fiscal_code || "C.F."}: ${company.fiscal_code}` : ""}<br>
        ${company.phone ? `Tel: ${company.phone}` : ""}${company.email ? ` - ${company.email}` : ""}
        ${company.pec_email ? `<br>PEC: ${company.pec_email}` : ""}
      </div>` : ""}
    </div>
    <div style="text-align:right;${logoPos === "right" ? "order:1;" : ""}">
      <div style="font-size:24px;font-weight:700;color:#111827;">${docInfo.type_label}</div>
      <div style="font-size:16px;color:#6b7280;">${docInfo.document_number}</div>
      <div style="margin-top:12px;font-size:12px;color:#6b7280;">
        ${labels?.template.date || "Data"}: ${docInfo.date}<br>
        ${docInfo.due_date ? `${labels?.template.due_date || "Scadenza"}: ${docInfo.due_date}<br>` : ""}
        ${docInfo.payment_terms ? `${labels?.template.payment_terms_label || "Termini"}: ${docInfo.payment_terms}` : ""}
      </div>
    </div>
  </div>`;
}

/**
 * Render auto-generated footer HTML from footer_config.
 * Used when custom templates include {{footer}} placeholder.
 */
function renderConfigFooter(
  config: TemplateFooterConfig,
  notes: string | undefined,
  footerText: string | undefined,
  company: Record<string, string | undefined>,
  labels?: CountryLabels
): string {
  if (!config.enabled) return "";

  const parts: string[] = [];

  parts.push('<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;">');

  if (config.show_notes && notes) {
    parts.push(`<div style="font-size:12px;color:#6b7280;margin-bottom:8px;">${notes}</div>`);
  }

  if (config.custom_text) {
    parts.push(`<div style="font-size:11px;color:#9ca3af;margin-bottom:8px;">${config.custom_text}</div>`);
  }

  if (footerText) {
    parts.push(`<div style="font-size:11px;color:#9ca3af;margin-bottom:8px;">${footerText}</div>`);
  }

  if (config.show_page_numbers) {
    parts.push(`<div style="font-size:10px;color:#9ca3af;text-align:right;">
      ${company.legal_name || ""} ${company.vat_number ? `· ${labels?.template.vat_number || "P.IVA"} ${company.vat_number}` : ""}
    </div>`);
  }

  parts.push("</div>");

  return parts.join("\n");
}

/**
 * Render a complete document as HTML using a template (or fallback).
 */
export function renderDocumentHtml(
  doc: IDocument,
  template?: IDocumentTemplate | null
): string {
  const d = doc as any;
  const currency = d.currency || "EUR";

  // Resolve country/language for label lookup
  const countryCode = d.country_code || "IT";
  const docLanguage = d.document_language;
  const labels = getLabels(countryCode, docLanguage);
  const locale = labels.locale;

  // Get type label from country labels
  const typeLabel = labels.document_types[d.document_type as keyof typeof labels.document_types]
    || DOCUMENT_TYPE_LABELS[d.document_type as keyof typeof DOCUMENT_TYPE_LABELS]
    || d.document_type;

  // If a custom template is provided, replace placeholders
  if (template?.html_template) {
    const companyData: Record<string, string | undefined> = {
      legal_name: d.company?.legal_name,
      address_line1: d.company?.address_line1,
      address_line2: d.company?.address_line2,
      vat_number: d.company?.vat_number,
      fiscal_code: d.company?.fiscal_code,
      phone: d.company?.phone,
      email: d.company?.email,
      pec_email: d.company?.pec_email,
      sdi_code: d.company?.sdi_code,
      logo_url: d.company?.logo_url,
    };

    const docDate = formatDate(d.finalized_at || d.created_at, locale);
    const dueDateStr = formatDate(d.due_date, locale);
    const draftLabel = labels.template.draft || "BOZZA";

    // Auto-generated header/footer from template config
    const paymentTermsLabel = resolvePaymentTermsLabel(d.payment_terms);
    const headerHtml = template.header_config
      ? renderConfigHeader(template.header_config, companyData, {
          type_label: typeLabel,
          document_number: d.document_number || draftLabel,
          date: docDate,
          due_date: dueDateStr || undefined,
          payment_terms: paymentTermsLabel || undefined,
        }, labels)
      : "";
    const footerHtml = template.footer_config
      ? renderConfigFooter(template.footer_config, d.notes, d.footer_text, companyData, labels)
      : "";

    // Base data fields
    const flatData: Record<string, string | undefined> = {
      "company.legal_name": d.company?.legal_name,
      "company.address_line1": d.company?.address_line1,
      "company.address_line2": d.company?.address_line2,
      "company.vat_number": d.company?.vat_number,
      "company.fiscal_code": d.company?.fiscal_code,
      "company.phone": d.company?.phone,
      "company.email": d.company?.email,
      "company.pec_email": d.company?.pec_email,
      "company.sdi_code": d.company?.sdi_code,
      "company.logo_url": d.company?.logo_url,
      "customer.company_name": d.customer?.company_name,
      "customer.first_name": d.customer?.first_name,
      "customer.last_name": d.customer?.last_name,
      "customer.email": d.customer?.email,
      "customer.vat_number": d.customer?.vat_number,
      "customer.fiscal_code": d.customer?.fiscal_code,
      "customer.pec_email": d.customer?.pec_email,
      "customer.sdi_code": d.customer?.sdi_code,
      "customer.billing_address.street_address": d.customer?.billing_address?.street_address,
      "customer.billing_address.city": d.customer?.billing_address?.city,
      "customer.billing_address.province": d.customer?.billing_address?.province,
      "customer.billing_address.postal_code": d.customer?.billing_address?.postal_code,
      "customer.billing_address.country": d.customer?.billing_address?.country,
      "document.document_number": d.document_number || draftLabel,
      "document.date": docDate,
      "document.due_date": dueDateStr,
      "document.payment_terms": paymentTermsLabel || undefined,
      "document.type_label": typeLabel,
      "document.notes": d.notes,
      "document.footer_text": d.footer_text,
      "totals.subtotal_net": formatCurrency(d.totals?.subtotal_net || 0, currency, locale),
      "totals.total_vat": formatCurrency(d.totals?.total_vat || 0, currency, locale),
      "totals.total_discount": formatCurrency(d.totals?.total_discount || 0, currency, locale),
      "totals.total": formatCurrency(d.totals?.total || 0, currency, locale),
      items: renderLineItemsHtml(d.items || [], currency, locale, detectTemplateColumns(template.html_template)),
      vat_breakdown: renderVatBreakdownHtml(d.totals?.vat_breakdown || [], currency, locale, labels.template.vat),
      header: headerHtml,
      footer: footerHtml,
      // Merge label placeholders (label.recipient, label.vat, etc.)
      ...buildLabelFlatData(labels),
      // Merge pre-computed display fields (company.fiscal_ids, notes_section, etc.)
      ...buildDisplayFields(d, labels, locale, currency),
    };

    let html = replacePlaceholders(template.html_template, flatData);
    if (template.css_styles) {
      html = html.replace("</head>", `<style>${template.css_styles}</style></head>`);
    }
    return html;
  }

  // Fallback: built-in standard template
  return renderStandardTemplate(d, typeLabel, currency, labels, locale);
}

/**
 * Built-in standard document template.
 */
function renderStandardTemplate(
  d: any,
  typeLabel: string,
  currency: string,
  labels: CountryLabels,
  locale: string
): string {
  const addr = d.customer?.billing_address;
  const customerName = d.customer?.company_name ||
    [d.customer?.first_name, d.customer?.last_name].filter(Boolean).join(" ") || "—";
  const tpl = labels.template;
  const draftLabel = tpl.draft || "BOZZA";
  const fallbackPtLabel = resolvePaymentTermsLabel(d.payment_terms);
  const docDate = formatDate(d.finalized_at || d.created_at, locale);
  const dueDateStr = formatDate(d.due_date, locale);
  const totalFormatted = formatCurrency(d.totals?.total || 0, currency, locale);

  // Build company address lines
  const companyLines: string[] = [];
  if (d.company?.address_line1) companyLines.push(d.company.address_line1);
  if (d.company?.address_line2) companyLines.push(d.company.address_line2);

  // Build customer info lines
  const customerLines: string[] = [];
  if (addr) {
    if (addr.street_address) customerLines.push(`${addr.street_address}${addr.street_address_2 ? `, ${addr.street_address_2}` : ""}`);
    customerLines.push(`${addr.postal_code || ""} ${addr.city || ""} ${addr.province ? `(${addr.province})` : ""}`.trim());
    if (addr.country && addr.country !== "IT") customerLines.push(addr.country);
  }
  if (d.customer?.email) customerLines.push(d.customer.email);
  const customerFiscalParts: string[] = [];
  if (d.customer?.vat_number) customerFiscalParts.push(`${tpl.vat_number} ${d.customer.vat_number}`);
  if (d.customer?.fiscal_code) customerFiscalParts.push(`${tpl.fiscal_code} ${d.customer.fiscal_code}`);
  if (customerFiscalParts.length) customerLines.push(customerFiscalParts.join(" - "));
  if (d.customer?.pec_email) customerLines.push(`PEC: ${d.customer.pec_email}`);
  if (d.customer?.sdi_code) customerLines.push(`SDI: ${d.customer.sdi_code}`);

  // Line items as simple rows: Description, Qty, Unit price, Amount
  const itemRows = (d.items || []).map((item: DocumentLineItem) => `
      <tr>
        <td class="item-desc">${item.description}${item.sku ? `<br><span class="sku">${item.sku}</span>` : ""}${item.discount_percent ? `<br><span class="sku">${tpl.discount}: ${item.discount_percent}%</span>` : ""}</td>
        <td class="item-qty">${item.quantity}${item.quantity_unit ? ` ${item.quantity_unit}` : ""}</td>
        <td class="item-price">${formatCurrency(item.unit_price, currency, locale)}</td>
        <td class="item-amount">${formatCurrency(item.line_total, currency, locale)}</td>
      </tr>`).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 13px;
    color: #000;
    line-height: 1.5;
  }
  .page { padding: 0; }

  /* Header: title left, logo right */
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .doc-title { font-size: 28px; font-weight: 600; color: #000; }
  .logo { max-height: 44px; max-width: 160px; }

  /* Document meta */
  .doc-meta { margin-bottom: 24px; }
  .doc-meta table { border-collapse: collapse; }
  .doc-meta td { padding: 1px 0; vertical-align: top; }
  .doc-meta .lbl { font-weight: 700; padding-right: 12px; white-space: nowrap; }

  /* Parties */
  .parties { display: flex; gap: 48px; margin-bottom: 28px; }
  .party { flex: 1; }
  .party-name { font-weight: 700; margin-bottom: 2px; }
  .party-detail { line-height: 1.5; }
  .party-label { font-weight: 700; margin-bottom: 2px; }

  /* Amount due */
  .amount-due { margin-bottom: 40px; }
  .amount-due-text { font-size: 20px; font-weight: 700; color: #000; }

  /* Items table */
  .items { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
  .items th {
    text-align: left;
    padding: 8px 0;
    font-weight: 400;
    color: #000;
    border-bottom: 1px solid #000;
  }
  .items th.right { text-align: right; }
  .items td { padding: 10px 0; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  .item-desc { }
  .item-qty { text-align: right; width: 60px; }
  .item-price { text-align: right; width: 100px; }
  .item-amount { text-align: right; width: 100px; }
  .sku { font-size: 11px; color: #6b7280; }

  /* Totals */
  .totals-wrap { display: flex; justify-content: flex-end; }
  .totals { width: 50%; }
  .totals tr td { padding: 3px 0; }
  .totals .val { text-align: right; }
  .totals .total-row td { font-weight: 700; }

  /* Notes */
  .notes { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; line-height: 1.5; }
  .footer-text { margin-top: 12px; font-size: 11px; color: #9ca3af; }
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div class="doc-title">${typeLabel}</div>
    ${d.company?.logo_url ? `<img src="${d.company.logo_url}" alt="" class="logo" />` : ""}
  </div>

  <!-- Document Meta -->
  <div class="doc-meta">
    <table>
      <tr>
        <td class="lbl">${typeLabel} n.</td>
        <td>${d.document_number || draftLabel}</td>
      </tr>
      <tr>
        <td class="lbl">${tpl.date}</td>
        <td>${docDate}</td>
      </tr>
      ${dueDateStr ? `<tr><td class="lbl">${tpl.due_date}</td><td>${dueDateStr}</td></tr>` : ""}
      ${fallbackPtLabel ? `<tr><td class="lbl">${tpl.payment_terms_label}</td><td>${fallbackPtLabel}</td></tr>` : ""}
    </table>
  </div>

  <!-- Parties -->
  <div class="parties">
    <div class="party">
      <div class="party-name">${d.company?.legal_name || ""}</div>
      <div class="party-detail">
        ${companyLines.join("<br>")}
        ${d.company?.vat_number ? `<br>${tpl.vat_number} ${d.company.vat_number}` : ""}
        ${d.company?.fiscal_code ? ` - ${tpl.fiscal_code} ${d.company.fiscal_code}` : ""}
        ${d.company?.phone ? `<br>Tel: ${d.company.phone}` : ""}
        ${d.company?.email ? `<br>${d.company.email}` : ""}
        ${d.company?.pec_email ? `<br>PEC: ${d.company.pec_email}` : ""}
      </div>
    </div>
    <div class="party">
      <div class="party-label">${tpl.recipient}</div>
      <div class="party-name">${customerName}</div>
      <div class="party-detail">
        ${customerLines.join("<br>")}
      </div>
    </div>
  </div>

  <!-- Amount Due -->
  ${dueDateStr ? `
  <div class="amount-due">
    <div class="amount-due-text">${totalFormatted} ${tpl.due_date.toLowerCase()} ${dueDateStr}</div>
  </div>` : ""}

  <!-- Line Items -->
  <table class="items">
    <thead>
      <tr>
        <th>${tpl.description}</th>
        <th class="right" style="width:60px;">${tpl.quantity}</th>
        <th class="right" style="width:100px;">${tpl.unit_price}</th>
        <th class="right" style="width:100px;">${tpl.total}</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals-wrap">
    <table class="totals">
      <tr>
        <td>${tpl.subtotal}</td>
        <td class="val">${formatCurrency(d.totals?.subtotal_net || 0, currency, locale)}</td>
      </tr>
      ${(d.totals?.vat_breakdown || []).map((v: VatBreakdownEntry) => `
      <tr>
        <td>${tpl.vat} ${v.rate}%</td>
        <td class="val">${formatCurrency(v.vat, currency, locale)}</td>
      </tr>`).join("")}
      ${d.totals?.total_discount ? `
      <tr>
        <td>${tpl.discount}</td>
        <td class="val">-${formatCurrency(d.totals.total_discount, currency, locale)}</td>
      </tr>` : ""}
      <tr>
        <td>${tpl.total}</td>
        <td class="val">${totalFormatted}</td>
      </tr>
      <tr class="total-row">
        <td>${tpl.amount_due}</td>
        <td class="val">${totalFormatted}</td>
      </tr>
    </table>
  </div>

  <!-- Notes -->
  ${d.notes ? `<div class="notes">${d.notes}</div>` : ""}
  ${d.footer_text ? `<div class="footer-text">${d.footer_text}</div>` : ""}
</div>
</body>
</html>`;
}

// ============================================
// PDF GENERATION
// ============================================

/**
 * Generate a PDF buffer from a document.
 */
export async function generateDocumentPdf(
  tenantDb: string,
  documentId: string
): Promise<{ buffer: Buffer; filename: string }> {
  const { Document, DocumentTemplate } = await connectWithModels(tenantDb);

  const doc = await Document.findOne({ document_id: documentId }).lean();
  if (!doc) throw new Error("Document not found");

  const d = doc as any;

  // Get template if set
  let template: IDocumentTemplate | null = null;
  if (d.template_id) {
    template = (await DocumentTemplate.findOne({ template_id: d.template_id }).lean()) as IDocumentTemplate | null;
  }
  if (!template) {
    template = (await DocumentTemplate.findOne({
      tenant_id: d.tenant_id,
      is_default: true,
      $or: [{ document_type: d.document_type }, { document_type: "all" }],
    }).lean()) as IDocumentTemplate | null;
  }

  const rawHtml = renderDocumentHtml(d as IDocument, template);
  // Embed images as base64 so Puppeteer doesn't need external HTTP requests
  const html = await embedImagesAsBase64(rawHtml);

  // Dynamic import to avoid loading puppeteer at module level
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pageSize = template?.page_size || "A4";
    const orientation = template?.orientation || "portrait";
    const margins = template?.margins || { top: 20, right: 20, bottom: 20, left: 20 };

    const pdfBuffer = await page.pdf({
      format: pageSize as any,
      landscape: orientation === "landscape",
      margin: {
        top: `${margins.top}mm`,
        right: `${margins.right}mm`,
        bottom: `${margins.bottom}mm`,
        left: `${margins.left}mm`,
      },
      printBackground: true,
    });

    const filename = `${d.document_number || d.document_id}.pdf`;

    return { buffer: Buffer.from(pdfBuffer), filename };
  } finally {
    await browser.close();
  }
}

/**
 * Generate PDF and update the document's pdf_url.
 */
export async function generateAndStorePdf(
  tenantDb: string,
  documentId: string
): Promise<{ buffer: Buffer; filename: string; url?: string }> {
  const { buffer, filename } = await generateDocumentPdf(tenantDb, documentId);

  // Try to upload to CDN
  try {
    const { getCDNCredentials } = await import("@/lib/db/home-settings");
    const creds = await getCDNCredentials(tenantDb);

    if (creds?.cdn_url && creds?.bucket_name && creds?.cdn_key && creds?.cdn_secret) {
      const { uploadToCdn } = await import("vinc-cdn");
      const config = {
        endpoint: creds.cdn_url,
        region: creds.bucket_region || "auto",
        bucket: creds.bucket_name,
        accessKeyId: creds.cdn_key,
        secretAccessKey: creds.cdn_secret,
        folder: creds.folder_name || "",
      };

      const result = await uploadToCdn(config, {
        buffer,
        contentType: "application/pdf",
        fileName: filename,
        customFolder: "documents",
      });
      const pdfUrl = result.url;

      // Update document with PDF URL
      const { Document } = await connectWithModels(tenantDb);
      await Document.updateOne(
        { document_id: documentId },
        {
          $set: { pdf_url: pdfUrl, pdf_generated_at: new Date() },
          $push: {
            history: {
              action: "pdf_generated",
              performed_by: "system",
              performed_at: new Date(),
              details: "PDF generated and uploaded to CDN",
            },
          },
        }
      );

      return { buffer, filename, url: pdfUrl };
    }
  } catch (err) {
    console.warn("[DocumentPDF] CDN upload failed, returning buffer only:", err);
  }

  // Update document with generation timestamp even without CDN
  const { Document } = await connectWithModels(tenantDb);
  await Document.updateOne(
    { document_id: documentId },
    {
      $set: { pdf_generated_at: new Date() },
      $push: {
        history: {
          action: "pdf_generated",
          performed_by: "system",
          performed_at: new Date(),
          details: "PDF generated (no CDN configured)",
        },
      },
    }
  );

  return { buffer, filename };
}
