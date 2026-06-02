/**
 * Seed: erp_settings data model (provider-agnostic ERP config)
 *
 * Generic ERP behavior config for the `vinc-erp` package. A `provider` select
 * field discriminates which ERP client the factory builds — today the only
 * option is "MyMb - Time" (`mymb_time` → `MyMbErpClient`). The behavior fields
 * below are that provider's config (formerly the Python `os.getenv`-driven
 * PACKAGING_OPTIONS_ID, IS_MANAGED_SUBSTITUTES, IS_MANAGED_SUPPLIER_ORDER,
 * CASES, and cache TTLs). A future provider adds a `provider` option + its
 * client in vinc-erp.
 *
 * Authored per tenant here, fetched by vinc-b2b at runtime (Redis-cached) via
 *   GET /api/b2b/data-models/erp_settings/records?relation_id=_global&channel=<code>
 *
 * It is global config, not per-customer: cardinality is `single` and we store a
 * single record under the sentinel relation_id `_global`. Single cardinality
 * upserts by (relation_id, channel), so no is_external_ref field is needed.
 *
 * `readable_by_end_user: false` — server-side only; never exposed to the browser.
 *
 * Once seeded, both the schema (Schema tab) and the `_global` record (Records tab)
 * are editable from the admin at /b2b/admin/data-models/erp_settings.
 *
 * Usage:
 *   pnpm tsx src/scripts/seed-data-model-erp-settings.ts --tenant your-tenant-id
 *   pnpm tsx src/scripts/seed-data-model-erp-settings.ts --tenant your-tenant-id --channel b2b
 *   pnpm tsx src/scripts/seed-data-model-erp-settings.ts --tenant your-tenant-id --dry-run
 *   pnpm tsx src/scripts/seed-data-model-erp-settings.ts --tenant your-tenant-id --force
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
} from "@/lib/db/models/data-model-definition";
import { validateRecordData } from "@/lib/data-models/validate-record";
import { ERP_SETTINGS_BLUEPRINT } from "@/lib/data-models/blueprints/erp-settings";

interface Args {
  tenant?: string;
  channel: string;
  dryRun: boolean;
  force: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const out: Args = { channel: "default", dryRun: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--tenant":
        out.tenant = argv[++i];
        break;
      case "--channel":
        out.channel = argv[++i];
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

// Single source of truth — same blueprint the install API route consumes.
const { definition: BLUEPRINT_DEF, defaultRecord } = ERP_SETTINGS_BLUEPRINT;
const SLUG = BLUEPRINT_DEF.slug;
const FIELDS = BLUEPRINT_DEF.fields;

/** Sentinel relation_id — this is global config, not attached to a real customer. */
const GLOBAL_RELATION_ID = defaultRecord!.relationId;
const DEFAULT_RECORD_DATA = defaultRecord!.data;

async function main() {
  const args = parseArgs();
  if (!args.tenant) {
    console.error("Usage: --tenant <id> [--channel <code>] [--dry-run] [--force]");
    process.exit(1);
  }
  const tenantDb = `vinc-${args.tenant}`;
  const channel = args.channel;
  const definition = { ...BLUEPRINT_DEF, channel };

  console.log(`\n📋 Seed erp_settings data model`);
  console.log(`   Tenant  : ${args.tenant} (database: ${tenantDb})`);
  console.log(`   Slug    : ${SLUG}`);
  console.log(`   Channel : ${channel}`);
  console.log(`   Record  : relation_id="${GLOBAL_RELATION_ID}" (global config)`);
  console.log(`   Fields  : ${FIELDS.length} top-level\n`);

  validateFieldsTree(FIELDS);
  const externalRefField = findExternalRefField(FIELDS); // undefined — single cardinality

  // Validate the default record against the schema up front, so a dry run also
  // surfaces any schema/data mismatch.
  const coercedRecord = validateRecordData(DEFAULT_RECORD_DATA, FIELDS, { strict: true });

  if (args.dryRun) {
    console.log("\n🌵 Dry run — would create definition:");
    console.log(JSON.stringify({ ...definition, external_ref_field: externalRefField }, null, 2));
    console.log("\n🌵 Dry run — would seed _global record data:");
    console.log(JSON.stringify(coercedRecord, null, 2));
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
    existing.name = definition.name;
    existing.fields = FIELDS;
    existing.external_ref_field = externalRefField;
    existing.readable_by_end_user = definition.readable_by_end_user;
    existing.enabled = definition.enabled;
    existing.markModified("fields");
    await existing.save();
    console.log(`\n✏️  Updated existing definition ${existing._id}`);
  } else {
    const created = await DataModelDefinition.create({
      ...definition,
      external_ref_field: externalRefField,
    });
    console.log(`\n✅ Created definition ${created._id}`);
  }

  const RecordModel = await getDataModelRecordModel(tenantDb, {
    slug: SLUG,
    cardinality: definition.cardinality,
    fields: FIELDS,
    external_ref_field: externalRefField,
  });
  await RecordModel.init();

  // Seed the global config record. Single cardinality upserts by (relation_id,
  // channel); only write when absent unless --force, to preserve admin edits.
  const recordFilter = { relation_id: GLOBAL_RELATION_ID, channel };
  const existingRecord = await RecordModel.findOne(recordFilter).lean();
  if (existingRecord && !args.force) {
    console.log(
      `\n↩️  _global record already exists — left untouched ` +
        `(pass --force to reset it to defaults).`
    );
  } else {
    await RecordModel.findOneAndUpdate(
      recordFilter,
      {
        $set: {
          relation_id: GLOBAL_RELATION_ID,
          channel,
          data: coercedRecord,
          source: "seed",
          imported_at: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    console.log(
      `\n${existingRecord ? "✏️  Reset" : "✅ Created"} _global record with default config`
    );
  }

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

  console.log(
    `\n🛠️  Editable in admin → /b2b/admin/data-models/${SLUG}` +
      ` (Schema tab = fields, Records tab = _global config)`
  );

  await closeAllConnections();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Failed:", err);
    process.exit(1);
  });
