/**
 * Seed Default Document Template
 *
 * Creates the clean "Pulito" document template for a tenant.
 * Uses the {{placeholder}} system for dynamic content.
 *
 * Usage:
 *   npx tsx scripts/seed-document-template.ts <tenant-id>
 *   npx tsx scripts/seed-document-template.ts crowdechain-cz
 */

import mongoose from "mongoose";
import { nanoid } from "nanoid";
import { DocumentTemplateSchema } from "../src/lib/db/models/document-template";
import { connectToTenantDb, disconnectDb } from "./lib/db-connect";

const TEMPLATE_NAME = "Pulito";
const TEMPLATE_DESCRIPTION = "Template moderno e pulito ispirato a design professionale. Titolo grande, tabella minimalista, sezione totali chiara.";

/**
 * The clean template HTML using {{placeholder}} tokens.
 *
 * Available placeholders (from document-pdf.service.ts):
 *   Company:  {{company.legal_name}}, {{company.logo_html}}, {{company.fiscal_ids}}, etc.
 *   Customer: {{customer.company_name}}, {{customer.fiscal_ids}}, etc.
 *   Document: {{document.type_label}}, {{document.document_number}}, {{document.date}},
 *             {{document.due_date}}, {{document.payment_terms}}, etc.
 *   Totals:   {{totals.subtotal_net}}, {{totals.total_vat}}, {{totals.total}}, etc.
 *   Labels:   {{label.recipient}}, {{label.vat_number}}, {{label.amount_due}}, etc.
 *   Blocks:   {{items}}, {{vat_breakdown}}, {{notes_section}}, {{footer_text_section}}
 *   Display:  {{document.due_date_line}}, {{document.payment_terms_line}},
 *             {{company.summary_line}}, {{company.footer_line}}, {{totals.discount_row}}
 */
const HTML_TEMPLATE = `<!DOCTYPE html>
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
  .items th.center { text-align: center; }
  .items td { padding: 10px 0; border-bottom: 1px solid #e5e7eb; vertical-align: top; }

  /* Totals */
  .totals-wrap { display: flex; justify-content: flex-end; }
  .totals { width: 50%; }
  .totals tr td { padding: 3px 0; }
  .totals .val { text-align: right; }
  .totals .total-row td { font-weight: 700; }

  /* Notes */
  .notes-section { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
  .notes-label { font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 4px; }
  .notes-text { font-size: 12px; color: #6b7280; line-height: 1.5; }
  .footer-text { margin-top: 12px; font-size: 11px; color: #9ca3af; }
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div class="doc-title">{{document.type_label}}</div>
    {{company.logo_html}}
  </div>

  <!-- Document Meta -->
  <div class="doc-meta">
    <table>
      <tr>
        <td class="lbl">{{document.type_label}} n.</td>
        <td>{{document.document_number}}</td>
      </tr>
      <tr>
        <td class="lbl">{{label.date}}</td>
        <td>{{document.date}}</td>
      </tr>
      {{document.due_date_meta_row}}
      {{document.payment_terms_meta_row}}
    </table>
  </div>

  <!-- Parties -->
  <div class="parties">
    <div class="party">
      <div class="party-name">{{company.legal_name}}</div>
      <div class="party-detail">
        {{company.address_line1}}
        {{company.address_line2}}
        {{company.fiscal_ids}}
        {{company.contact_line}}
        {{company.pec_line}}
      </div>
    </div>
    <div class="party">
      <div class="party-label">{{label.recipient}}</div>
      <div class="party-name">{{customer.company_name}}</div>
      <div class="party-detail">
        {{customer.billing_address.street_address}}<br>
        {{customer.billing_address.postal_code}} {{customer.billing_address.city}} {{customer.billing_address.province}}<br>
        {{customer.email}}
        {{customer.pec_sdi_line}}
      </div>
      {{customer.vat_line}}
    </div>
  </div>

  <!-- Amount Due (only shown when due date exists) -->
  {{amount_due_block}}

  <!-- Line Items -->
  <table class="items">
    <thead>
      <tr>
        <th>{{label.description}}</th>
        <th class="right" style="width:60px;">{{label.quantity}}</th>
        <th class="right" style="width:100px;">{{label.unit_price}}</th>
        <th class="center" style="width:60px;">{{label.vat}}</th>
        <th class="right" style="width:100px;">{{label.total}}</th>
      </tr>
    </thead>
    <tbody>
      {{items}}
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals-wrap">
    <table class="totals">
      <tr>
        <td>{{label.subtotal}}</td>
        <td class="val">{{totals.subtotal_net}}</td>
      </tr>
      {{vat_breakdown_simple}}
      {{totals.discount_row}}
      <tr>
        <td>{{label.total}}</td>
        <td class="val">{{totals.total}}</td>
      </tr>
      <tr class="total-row">
        <td>{{label.amount_due}}</td>
        <td class="val">{{totals.total}}</td>
      </tr>
    </table>
  </div>

  <!-- Notes & Footer -->
  {{notes_section}}
  {{footer_text_section}}
</div>
</body>
</html>`;

async function main() {
  const tenantId = process.argv[2] || process.env.VINC_TENANT_ID;

  if (!tenantId) {
    console.error("Usage: npx tsx scripts/seed-document-template.ts <tenant-id>");
    process.exit(1);
  }

  const dbName = `vinc-${tenantId}`;

  console.log(`\nSeeding document template for tenant: ${tenantId}`);
  console.log(`Database: ${dbName}\n`);

  await connectToTenantDb(tenantId);

  // Use mongoose model directly (script connection, not app pool)
  const DocumentTemplate = mongoose.models.DocumentTemplate
    || mongoose.model("DocumentTemplate", DocumentTemplateSchema, "documenttemplates");

  // Check if a template with this name already exists
  const existing = await DocumentTemplate.findOne({
    tenant_id: tenantId,
    name: TEMPLATE_NAME,
  });

  if (existing) {
    console.log(`Template "${TEMPLATE_NAME}" already exists (id: ${existing.template_id}). Updating...`);
    existing.html_template = HTML_TEMPLATE;
    existing.description = TEMPLATE_DESCRIPTION;
    existing.margins = { top: 20, right: 20, bottom: 20, left: 20 };
    await existing.save();
    console.log(`Updated template: ${existing.template_id}`);
  } else {
    // Unset is_default on any existing default template
    await DocumentTemplate.updateMany(
      { tenant_id: tenantId, is_default: true },
      { $set: { is_default: false } }
    );

    const templateId = `tpl_${nanoid(12)}`;
    await DocumentTemplate.create({
      template_id: templateId,
      tenant_id: tenantId,
      name: TEMPLATE_NAME,
      description: TEMPLATE_DESCRIPTION,
      document_type: "all",
      html_template: HTML_TEMPLATE,
      page_size: "A4",
      orientation: "portrait",
      margins: { top: 20, right: 20, bottom: 20, left: 20 },
      header_config: {
        show_logo: true,
        logo_position: "right",
        show_company_info: true,
        style: "standard",
      },
      footer_config: {
        enabled: true,
        show_notes: true,
        show_page_numbers: true,
      },
      is_default: true,
      is_system: false,
    });

    console.log(`Created template "${TEMPLATE_NAME}" (id: ${templateId})`);
    console.log(`Set as default for all document types.`);
  }

  // Show all templates for this tenant
  const allTemplates = await DocumentTemplate.find({ tenant_id: tenantId }).lean();
  console.log(`\nAll templates for ${tenantId}:`);
  for (const t of allTemplates) {
    const tmpl = t as any;
    console.log(`  - ${tmpl.name} (${tmpl.template_id}) [${tmpl.document_type}] ${tmpl.is_default ? "DEFAULT" : ""}`);
  }

  await disconnectDb();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
