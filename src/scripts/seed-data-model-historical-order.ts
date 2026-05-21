/**
 * Seed: historical_order data model
 *
 * Creates a DataModelDefinition matching the ERP Order History contract at
 * doc/export/time-to-pim/docs/erp-order-history-endpoint.md and materializes
 * the tenant-scoped `dyn_historical_order` collection with the right indexes.
 *
 * Usage:
 *   pnpm tsx src/scripts/seed-data-model-historical-order.ts --tenant hidros-it
 *   pnpm tsx src/scripts/seed-data-model-historical-order.ts --tenant hidros-it --dry-run
 *   pnpm tsx src/scripts/seed-data-model-historical-order.ts --tenant hidros-it --force   # overwrite if exists
 *
 * The model relation is `customer` (records keyed by customer_id), cardinality
 * `multiple` (one customer can have many historical orders), channel
 * `default`. `document_number` is the external_ref idempotency key.
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

const SLUG = "historical_order";

// Field definitions — one-for-one with the ERP order history spec §3.
const FIELDS: DataModelField[] = [
  {
    slug: "document_number",
    label: "Numero documento",
    type: "text",
    required: true,
    filterable: true,
    is_external_ref: true, // idempotency key — spec §4
  },
  {
    slug: "document_date",
    label: "Data documento",
    type: "date",
    required: true,
    filterable: true,
  },
  {
    slug: "delivery_date",
    label: "Data consegna",
    type: "date",
    filterable: true,
  },
  {
    slug: "status",
    label: "Stato",
    type: "select",
    required: true,
    filterable: true,
    // Spec §5 — full enum with default IT labels + badge colors
    options: [
      {
        value: "draft",
        label: "Draft",
        color: "#94a3b8",
        i18n_labels: { it: "Bozza", en: "Draft" },
      },
      {
        value: "submitted",
        label: "Submitted",
        color: "#3b82f6",
        i18n_labels: { it: "Inviato", en: "Submitted" },
      },
      {
        value: "to_fulfill",
        label: "To fulfill",
        color: "#f59e0b",
        i18n_labels: { it: "Da evadere", en: "To fulfill" },
      },
      {
        value: "in_transit",
        label: "In transit",
        color: "#3b82f6",
        i18n_labels: { it: "In consegna", en: "In transit" },
      },
      {
        value: "fulfilled",
        label: "Fulfilled",
        color: "#10b981",
        i18n_labels: { it: "Evaso", en: "Fulfilled" },
      },
      {
        value: "invoiced",
        label: "Invoiced",
        color: "#10b981",
        i18n_labels: { it: "Fatturato", en: "Invoiced" },
      },
      {
        value: "cancelled",
        label: "Cancelled",
        color: "#f43f5e",
        i18n_labels: { it: "Annullato", en: "Cancelled" },
      },
    ],
  },
  {
    slug: "status_label",
    label: "Etichetta stato (override)",
    type: "text",
  },
  {
    slug: "currency",
    label: "Valuta",
    type: "text",
  },
  { slug: "subtotal", label: "Imponibile", type: "number" },
  { slug: "vat_total", label: "Totale IVA", type: "number" },
  { slug: "shipping_cost", label: "Spedizione", type: "number" },
  { slug: "discount_total", label: "Sconto totale", type: "number" },
  {
    slug: "total",
    label: "Totale ordinato",
    type: "number",
    required: true,
  },
  {
    slug: "shipping_address",
    label: "Destinazione",
    type: "object",
    fields: [
      {
        slug: "code",
        label: "Codice indirizzo",
        type: "text",
        filterable: true, // spec §6 Filtra per destinazione
      },
      { slug: "label", label: "Etichetta", type: "text" },
      { slug: "street", label: "Via", type: "text" },
      { slug: "city", label: "Città", type: "text" },
      { slug: "province", label: "Provincia", type: "text" },
      { slug: "postal_code", label: "CAP", type: "text" },
      { slug: "country", label: "Paese", type: "text" },
    ],
  },
  { slug: "payment_method", label: "Pagamento", type: "text" },
  { slug: "agent_code", label: "Agente", type: "text" },
  { slug: "notes", label: "Note", type: "textarea" },
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
  {
    slug: "items",
    label: "Righe ordine",
    type: "array_of_objects",
    fields: [
      { slug: "line_number", label: "N° riga", type: "number" },
      { slug: "sku", label: "SKU (carti)", type: "text" },
      { slug: "entity_code", label: "Codice articolo (oarti)", type: "text" },
      { slug: "name", label: "Descrizione", type: "text" },
      { slug: "quantity", label: "Qta", type: "number" },
      { slug: "uom", label: "UM", type: "text" },
      { slug: "unit_price", label: "Prezzo unitario", type: "number" },
      {
        // Spec ships [10, 5] (array of numbers). No array_of_numbers type
        // yet — pusher serializes as JSON string (`"[10,5]"`) and the
        // frontend JSON.parses on render. Revisit if array_of_primitives
        // becomes a real field type.
        slug: "discounts_json",
        label: "Sconti (JSON)",
        type: "text",
      },
      { slug: "vat_rate", label: "Aliquota IVA", type: "number" },
      { slug: "line_total", label: "Totale riga", type: "number" },
    ],
  },
];

const DEFINITION: Omit<IDataModelDefinition, "_id" | "created_at" | "updated_at"> = {
  name: "Storico ordini",
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

  console.log(`\n📋 Seed historical_order data model`);
  console.log(`   Tenant : ${args.tenant} (database: ${tenantDb})`);
  console.log(`   Slug   : ${SLUG}`);
  console.log(`   Fields : ${FIELDS.length} top-level (incl. shipping_address, erp_meta, items[])\n`);

  // Validate the fields tree using the same logic the API uses
  validateFieldsTree(FIELDS);
  const externalRefField = findExternalRefField(FIELDS);
  console.log(`   external_ref → field "${externalRefField}"`);

  if (args.dryRun) {
    console.log("\n🌵 Dry run — would create:");
    console.log(JSON.stringify({ ...DEFINITION, external_ref_field: externalRefField }, null, 2));
    await closeAllConnections();
    return;
  }

  const { DataModelDefinition } = await connectWithModels(tenantDb);

  const existing = await DataModelDefinition.findOne({ slug: SLUG });
  if (existing) {
    if (!args.force) {
      console.error(
        `\n❌ A data model with slug "${SLUG}" already exists in ${tenantDb}.\n` +
          `   Pass --force to overwrite (this DOES NOT drop existing records — only updates the definition).`
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

  // Materialize the dynamic collection + its indexes
  const RecordModel = await getDataModelRecordModel(tenantDb, {
    slug: SLUG,
    cardinality: DEFINITION.cardinality,
    fields: FIELDS,
    external_ref_field: externalRefField,
  });
  await RecordModel.init();

  // Print collection state
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
