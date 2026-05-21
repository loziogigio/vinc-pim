/**
 * Seed: credit_exposure data model
 *
 * Mirrors the legacy DFL "Esposizione" view (b2b.dfl.it/pages/account?page=exposition):
 * a per-customer credit-position snapshot with line-by-line breakdown
 * (rimesse, RIBA, bolle, ordini non evasi, …) and roll-up totals
 * (totale_esposizione, fido_assicurato, differenza).
 *
 * Cardinality is `multiple` so daily snapshots accumulate — `snapshot_date`
 * is the idempotency key, so re-running the pusher on the same day upserts
 * the row in place.
 *
 * Usage:
 *   pnpm tsx src/scripts/seed-data-model-credit-exposure.ts --tenant hidros-it
 *   pnpm tsx src/scripts/seed-data-model-credit-exposure.ts --tenant hidros-it --dry-run
 *   pnpm tsx src/scripts/seed-data-model-credit-exposure.ts --tenant hidros-it --force
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

const SLUG = "credit_exposure";

const FIELDS: DataModelField[] = [
  {
    slug: "snapshot_date",
    label: "Data snapshot",
    type: "date",
    required: true,
    filterable: true,
    is_external_ref: true, // one row per (customer, channel, date) — daily pusher is idempotent
  },
  {
    slug: "currency",
    label: "Valuta",
    type: "text",
  },
  {
    slug: "lines",
    label: "Voci esposizione",
    type: "array_of_objects",
    fields: [
      {
        slug: "code",
        label: "Codice",
        type: "text",
        required: true,
      },
      {
        slug: "label",
        label: "Etichetta",
        type: "text",
        required: true,
      },
      { slug: "scaduto", label: "Scaduto", type: "number" },
      { slug: "da_scadere", label: "Da scadere", type: "number" },
      { slug: "totale", label: "Totale", type: "number" },
    ],
  },
  {
    slug: "scaduto_totale",
    label: "Scaduto totale",
    type: "number",
    filterable: true, // surface customers with overdue exposure
  },
  {
    slug: "da_scadere_totale",
    label: "Da scadere totale",
    type: "number",
  },
  {
    slug: "totale_esposizione",
    label: "Totale esposizione",
    type: "number",
    required: true,
    filterable: true,
  },
  {
    slug: "fido_assicurato",
    label: "Fido assicurato",
    type: "number",
    filterable: true,
  },
  {
    slug: "differenza",
    label: "Differenza (fido - totale)",
    type: "number",
    filterable: true, // negative differenza = over-fido alert
  },
];

const DEFINITION: Omit<IDataModelDefinition, "_id" | "created_at" | "updated_at"> = {
  name: "Esposizione",
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

  console.log(`\n📋 Seed credit_exposure data model`);
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
