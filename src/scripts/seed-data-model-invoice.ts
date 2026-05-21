/**
 * Seed: invoice data model
 *
 * Mirrors the legacy DFL "Fatture" tab (b2b.dfl.it/pages/account?page=document):
 * per-customer issued invoices with payment status, downloadable PDFs +
 * payment-barcode PDFs + CSV exports.
 *
 * Cardinality `multiple` (a customer has many invoices over time).
 * `numero_fattura` (the legal fiscal number, unique per tenant per year) is
 * the idempotency key — daily/weekly pushers re-running don't duplicate rows.
 *
 * Usage:
 *   pnpm tsx src/scripts/seed-data-model-invoice.ts --tenant hidros-it
 *   pnpm tsx src/scripts/seed-data-model-invoice.ts --tenant hidros-it --dry-run
 *   pnpm tsx src/scripts/seed-data-model-invoice.ts --tenant hidros-it --force
 */

import "dotenv/config";
import {
  connectWithModels,
  closeAllConnections,
} from "@/lib/db/connection";
import { getDataModelRecordModel } from "@/lib/db/model-registry";
import {
  findExternalRefField,
  validateFieldsTree,
  type DataModelField,
  type IDataModelDefinition,
} from "@/lib/db/models/data-model-definition";

interface Args {
  tenant?: string;
  dryRun: boolean;
  force: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const out: Args = { dryRun: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--tenant":
        out.tenant = argv[++i];
        break;
      case "--dry-run":
        out.dryRun = true;
        break;
      case "--force":
        out.force = true;
        break;
      default:
        console.error(`Unknown argument: ${a}`);
        process.exit(1);
    }
  }
  return out;
}

const SLUG = "invoice";

const FIELDS: DataModelField[] = [
  {
    // The legal fiscal number — unique per tenant per fiscal year. Composite
    // string from the pusher, e.g. "2026/1234" or "FT/2026/1234". This is the
    // idempotency key so re-running the import never duplicates a row.
    slug: "numero_fattura",
    label: "Numero fattura",
    type: "text",
    required: true,
    filterable: true,
    is_external_ref: true,
  },
  {
    // Internal ERP document identifier (counter-based, e.g. PB2B/2026/82570).
    // Distinct from numero_fattura — orders, DDT, and invoices may share an
    // ERP document chain.
    slug: "numero_documento",
    label: "Documento",
    type: "text",
    filterable: true,
  },
  {
    slug: "data",
    label: "Data fattura",
    type: "date",
    required: true,
    filterable: true,
  },
  {
    slug: "data_scadenza",
    label: "Data scadenza",
    type: "date",
    filterable: true,
  },
  {
    slug: "tipo",
    label: "Tipo di documento",
    type: "select",
    filterable: true,
    options: [
      {
        value: "invoice",
        label: "Fattura",
        color: "#3b82f6",
        i18n_labels: { it: "Fattura", en: "Invoice" },
      },
      {
        value: "credit_note",
        label: "Nota di credito",
        color: "#f43f5e",
        i18n_labels: { it: "Nota di credito", en: "Credit note" },
      },
      {
        value: "proforma",
        label: "Proforma",
        color: "#94a3b8",
        i18n_labels: { it: "Proforma", en: "Proforma" },
      },
      {
        value: "advance",
        label: "Acconto",
        color: "#f59e0b",
        i18n_labels: { it: "Acconto", en: "Advance" },
      },
      {
        value: "self_invoice",
        label: "Autofattura",
        color: "#8b5cf6",
        i18n_labels: { it: "Autofattura", en: "Self-invoice" },
      },
    ],
  },
  {
    slug: "stato_pagamento",
    label: "Stato pagamento",
    type: "select",
    filterable: true,
    options: [
      {
        value: "paid",
        label: "Pagata",
        color: "#10b981",
        i18n_labels: { it: "Pagata", en: "Paid" },
      },
      {
        value: "partial",
        label: "Parzialmente pagata",
        color: "#f59e0b",
        i18n_labels: { it: "Parzialmente pagata", en: "Partially paid" },
      },
      {
        value: "due",
        label: "Da pagare",
        color: "#3b82f6",
        i18n_labels: { it: "Da pagare", en: "Due" },
      },
      {
        value: "overdue",
        label: "Scaduta",
        color: "#f43f5e",
        i18n_labels: { it: "Scaduta", en: "Overdue" },
      },
      {
        value: "cancelled",
        label: "Annullata",
        color: "#94a3b8",
        i18n_labels: { it: "Annullata", en: "Cancelled" },
      },
    ],
  },
  {
    slug: "valuta",
    label: "Valuta",
    type: "text",
  },
  {
    slug: "imponibile",
    label: "Imponibile",
    type: "number",
  },
  {
    slug: "iva",
    label: "IVA",
    type: "number",
  },
  {
    slug: "totale",
    label: "Totale",
    type: "number",
    required: true,
    filterable: true,
  },
  {
    slug: "importo_pagato",
    label: "Importo pagato",
    type: "number",
  },
  {
    slug: "importo_residuo",
    label: "Importo residuo",
    type: "number",
    filterable: true, // surface "still owed > X"
  },
  {
    slug: "destinazione",
    label: "Destinazione",
    type: "object",
    fields: [
      {
        slug: "code",
        label: "Codice indirizzo",
        type: "text",
        filterable: true,
      },
      { slug: "label", label: "Etichetta", type: "text" },
      { slug: "street", label: "Via", type: "text" },
      { slug: "city", label: "Città", type: "text" },
      { slug: "province", label: "Provincia", type: "text" },
      { slug: "postal_code", label: "CAP", type: "text" },
      { slug: "country", label: "Paese", type: "text" },
    ],
  },
  {
    slug: "payment_method",
    label: "Metodo di pagamento",
    type: "text",
  },
  {
    slug: "agent_code",
    label: "Agente",
    type: "text",
  },
  {
    slug: "notes",
    label: "Note",
    type: "textarea",
  },
  // Downloadable assets — the legacy portal columns
  {
    slug: "pdf_url",
    label: "PDF fattura",
    type: "text",
  },
  {
    slug: "pdf_barcode_url",
    label: "PDF codice a barre (bollettino)",
    type: "text",
  },
  {
    slug: "csv_url",
    label: "CSV export",
    type: "text",
  },
  {
    slug: "erp_meta",
    label: "ERP meta",
    type: "object",
    fields: [
      { slug: "csoci", label: "Società", type: "text" },
      { slug: "ycale", label: "Anno", type: "number" },
      { slug: "oelen", label: "OELEN", type: "number" },
      { slug: "oelen_dbmsx", label: "OELEN dbmsx", type: "number" },
      { slug: "causale", label: "Causale", type: "text" },
      {
        slug: "channel",
        label: "Origine ERP",
        type: "select",
        options: [
          { value: "web", label: "Web" },
          { value: "agent", label: "Agente" },
          { value: "phone", label: "Telefono" },
          { value: "fax", label: "Fax" },
          { value: "walk-in", label: "Walk-in" },
          { value: "legacy-drupal", label: "Legacy Drupal" },
        ],
      },
    ],
  },
];

const DEFINITION: Omit<IDataModelDefinition, "_id" | "created_at" | "updated_at"> = {
  name: "Fatture",
  slug: SLUG,
  relation: "customer",
  cardinality: "multiple",
  channel: "b2b",
  fields: FIELDS,
  readable_by_end_user: true,
  enabled: true,
};

async function main() {
  const args = parseArgs();
  if (!args.tenant) {
    console.error("Usage: --tenant <id> [--dry-run] [--force]");
    process.exit(1);
  }
  const tenantDb = `vinc-${args.tenant}`;

  console.log(`\n📋 Seed invoice data model`);
  console.log(`   Tenant : ${args.tenant} (database: ${tenantDb})`);
  console.log(`   Slug   : ${SLUG}`);
  console.log(`   Fields : ${FIELDS.length} top-level\n`);

  validateFieldsTree(FIELDS);
  const externalRefField = findExternalRefField(FIELDS);
  console.log(`   external_ref → field "${externalRefField}"`);

  if (args.dryRun) {
    console.log("\n🌵 Dry run — would create:");
    console.log(
      JSON.stringify({ ...DEFINITION, external_ref_field: externalRefField }, null, 2)
    );
    await closeAllConnections();
    return;
  }

  const { DataModelDefinition } = await connectWithModels(tenantDb);

  const existing = await DataModelDefinition.findOne({ slug: SLUG });
  if (existing) {
    if (!args.force) {
      console.error(
        `\n❌ A data model with slug "${SLUG}" already exists in ${tenantDb}.\n` +
          `   Pass --force to overwrite the definition (does NOT drop existing records).`
      );
      await closeAllConnections();
      process.exit(1);
    }
    existing.name = DEFINITION.name;
    existing.fields = FIELDS;
    existing.external_ref_field = externalRefField;
    existing.readable_by_end_user = DEFINITION.readable_by_end_user;
    existing.enabled = DEFINITION.enabled;
    existing.markModified("fields");
    await existing.save();
    console.log(`\n✏️  Updated existing definition ${existing._id}`);
  } else {
    const created = await DataModelDefinition.create({
      ...DEFINITION,
      external_ref_field: externalRefField,
    });
    console.log(`\n✅ Created definition ${created._id}`);
  }

  const RecordModel = await getDataModelRecordModel(tenantDb, {
    slug: SLUG,
    cardinality: DEFINITION.cardinality,
    fields: FIELDS,
    external_ref_field: externalRefField,
  });
  await RecordModel.init();

  const count = await RecordModel.estimatedDocumentCount();
  const indexes = await RecordModel.collection.indexes();
  console.log(`\n📦 Collection dyn_${SLUG} ready in ${tenantDb}`);
  console.log(`   Records  : ${count}`);
  console.log(`   Indexes  :`);
  for (const idx of indexes) {
    const parts = Object.entries(idx.key)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    const flags = [
      idx.unique ? "unique" : null,
      idx.partialFilterExpression ? "partial" : null,
    ]
      .filter(Boolean)
      .join(" ");
    console.log(`     • { ${parts} }${flags ? "  [" + flags + "]" : ""}`);
  }

  await closeAllConnections();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Failed:", err);
    process.exit(1);
  });
