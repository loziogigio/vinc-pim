/**
 * Seed: delivery_note (DDT) data model
 *
 * Mirrors the legacy DFL "Documenti di trasporto" tab
 * (b2b.dfl.it/pages/account?page=document — DDT tab): per-customer shipping
 * documents with carrier, tracking, packages, weight, and (once invoiced)
 * a back-reference to the issued numero_fattura.
 *
 * Cardinality `multiple` — a customer has many DDTs over time. `numero_ddt`
 * is the legal shipping-document number and the idempotency key.
 *
 * Usage:
 *   pnpm tsx src/scripts/seed-data-model-delivery-note.ts --tenant hidros-it
 *   pnpm tsx src/scripts/seed-data-model-delivery-note.ts --tenant hidros-it --dry-run
 *   pnpm tsx src/scripts/seed-data-model-delivery-note.ts --tenant hidros-it --force
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

const SLUG = "delivery_note";

const FIELDS: DataModelField[] = [
  {
    // Legal DDT number (unique per tenant per fiscal year). Composite string
    // from the pusher, e.g. "2026/4521" or "DDT/2026/4521". Idempotency key.
    slug: "numero_ddt",
    label: "Numero DDT",
    type: "text",
    required: true,
    filterable: true,
    is_external_ref: true,
  },
  {
    // Internal ERP document identifier (counter-based, e.g. PB2B/2026/82570).
    // Distinct from numero_ddt — useful for cross-referencing the order chain.
    slug: "numero_documento",
    label: "Documento",
    type: "text",
    filterable: true,
  },
  {
    slug: "data",
    label: "Data emissione",
    type: "date",
    required: true,
    filterable: true,
  },
  {
    slug: "data_consegna",
    label: "Data consegna",
    type: "date",
    filterable: true,
  },
  {
    slug: "stato",
    label: "Stato",
    type: "select",
    filterable: true,
    options: [
      {
        value: "in_preparation",
        label: "In preparazione",
        color: "#94a3b8",
        i18n_labels: { it: "In preparazione", en: "In preparation" },
      },
      {
        value: "shipped",
        label: "Spedito",
        color: "#3b82f6",
        i18n_labels: { it: "Spedito", en: "Shipped" },
      },
      {
        value: "in_transit",
        label: "In transito",
        color: "#3b82f6",
        i18n_labels: { it: "In transito", en: "In transit" },
      },
      {
        value: "delivered",
        label: "Consegnato",
        color: "#10b981",
        i18n_labels: { it: "Consegnato", en: "Delivered" },
      },
      {
        value: "returned",
        label: "Reso",
        color: "#f59e0b",
        i18n_labels: { it: "Reso", en: "Returned" },
      },
      {
        value: "cancelled",
        label: "Annullato",
        color: "#f43f5e",
        i18n_labels: { it: "Annullato", en: "Cancelled" },
      },
    ],
  },
  // Shipping
  {
    slug: "corriere",
    label: "Corriere",
    type: "text",
    filterable: true,
  },
  {
    slug: "tracking_number",
    label: "Numero tracking",
    type: "text",
    filterable: true,
  },
  {
    slug: "tracking_url",
    label: "URL tracking",
    type: "text",
  },
  {
    slug: "numero_colli",
    label: "N° colli",
    type: "number",
  },
  {
    slug: "peso_kg",
    label: "Peso (kg)",
    type: "number",
  },
  {
    slug: "volume_m3",
    label: "Volume (m³)",
    type: "number",
  },
  // Address (same shape used by invoice and historical_order)
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
  // Money
  { slug: "valuta", label: "Valuta", type: "text" },
  { slug: "imponibile", label: "Imponibile", type: "number" },
  { slug: "iva", label: "IVA", type: "number" },
  {
    slug: "totale",
    label: "Totale",
    type: "number",
    required: true,
    filterable: true,
  },
  // Cross-reference once the DDT is invoiced. Stored as plain string so a
  // pusher can populate it later; the storefront UI can deep-link to the
  // invoice record by querying ?filter[numero_fattura]=<value>.
  {
    slug: "numero_fattura_collegata",
    label: "Fattura collegata",
    type: "text",
    filterable: true,
  },
  {
    slug: "data_fatturazione",
    label: "Data fatturazione",
    type: "date",
    filterable: true,
  },
  // Optional content
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
  // Downloadable assets — the legacy DDT row columns
  {
    slug: "pdf_url",
    label: "PDF DDT",
    type: "text",
  },
  {
    slug: "pdf_barcode_url",
    label: "PDF codice a barre",
    type: "text",
  },
  // Line items (consistent shape with historical_order.items so the same
  // renderer can show both).
  {
    slug: "items",
    label: "Righe DDT",
    type: "array_of_objects",
    fields: [
      { slug: "line_number", label: "N° riga", type: "number" },
      { slug: "sku", label: "SKU (carti)", type: "text" },
      { slug: "entity_code", label: "Codice articolo (oarti)", type: "text" },
      { slug: "name", label: "Descrizione", type: "text" },
      { slug: "quantity", label: "Qta", type: "number" },
      { slug: "uom", label: "UM", type: "text" },
      { slug: "unit_price", label: "Prezzo unitario", type: "number" },
      { slug: "vat_rate", label: "Aliquota IVA", type: "number" },
      { slug: "line_total", label: "Totale riga", type: "number" },
    ],
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
  name: "Documenti di trasporto",
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

  console.log(`\n📋 Seed delivery_note (DDT) data model`);
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
