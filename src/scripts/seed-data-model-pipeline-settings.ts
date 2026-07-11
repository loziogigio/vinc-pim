import "dotenv/config";
import { connectWithModels, closeAllConnections } from "@/lib/db/connection";
import { getDataModelRecordModel } from "@/lib/db/model-registry";
import {
  findExternalRefField,
  validateFieldsTree,
  applyChannelRelationDefaults,
  CHANNEL_RELATION_ID,
} from "@/lib/db/models/data-model-definition";
import { validateRecordData } from "@/lib/data-models/validate-record";
import { PIPELINE_SETTINGS_BLUEPRINT } from "@/lib/data-models/blueprints/pipeline-settings";

/**
 * Install the `pipeline_settings` data model + a channel-scoped record for the
 * selling-machine pipeline (Twenty CRM + RudderStack). Values left empty fall
 * back to env at runtime; fill them in via the CS admin data-model editor or
 * the optional flags below.
 *
 * Usage:
 *   pnpm tsx src/scripts/seed-data-model-pipeline-settings.ts --tenant vendereincloud-it [--channel default] \
 *     [--twenty-base-url URL] [--twenty-api-key KEY] [--twenty-webhook-secret SECRET] \
 *     [--rs-write-key KEY] [--rs-dataplane-url URL] [--dry-run] [--force]
 */
interface Args {
  tenant?: string;
  channel: string;
  values: Record<string, string>;
  dryRun: boolean;
  force: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const out: Args = { channel: "default", values: {}, dryRun: false, force: false };
  const map: Record<string, string> = {
    "--twenty-base-url": "twenty_base_url",
    "--twenty-api-key": "twenty_api_key",
    "--twenty-webhook-secret": "twenty_webhook_secret",
    "--rs-write-key": "rudderstack_write_key",
    "--rs-dataplane-url": "rudderstack_dataplane_url",
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tenant") out.tenant = argv[++i];
    else if (a === "--channel") out.channel = argv[++i];
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--force") out.force = true;
    else if (map[a]) out.values[map[a]] = argv[++i];
  }
  return out;
}

const { definition: BLUEPRINT_DEF } = PIPELINE_SETTINGS_BLUEPRINT;
const SLUG = BLUEPRINT_DEF.slug;
const FIELDS = BLUEPRINT_DEF.fields;

async function main() {
  const args = parseArgs();
  if (!args.tenant) {
    console.error(
      "Usage: --tenant <id> [--channel default] [--twenty-base-url URL] [--twenty-api-key KEY] " +
        "[--twenty-webhook-secret SECRET] [--rs-write-key KEY] [--rs-dataplane-url URL] [--dry-run] [--force]"
    );
    process.exit(1);
  }
  const tenantDb = `vinc-${args.tenant}`;
  const channel = args.channel;
  const definition = applyChannelRelationDefaults({ ...BLUEPRINT_DEF, channel: "*" });

  validateFieldsTree(FIELDS);
  const externalRefField = findExternalRefField(FIELDS); // undefined — single cardinality
  const coercedRecord = validateRecordData(args.values, FIELDS, { strict: true });

  console.log(`\n📋 Seed pipeline_settings data model`);
  console.log(`   Tenant   : ${args.tenant} (database: ${tenantDb})`);
  console.log(`   Slug     : ${SLUG}`);
  console.log(`   Record   : relation_id="${CHANNEL_RELATION_ID}", channel="${channel}"`);
  console.log(`   Values   : ${JSON.stringify(coercedRecord)} (empty -> env fallback at runtime)\n`);

  if (args.dryRun) {
    console.log("🌵 Dry run — would create/update definition + record. Exiting.");
    await closeAllConnections();
    return;
  }

  const { DataModelDefinition } = await connectWithModels(tenantDb);
  const existing = await DataModelDefinition.findOne({ slug: SLUG });
  if (existing) {
    if (!args.force) {
      console.error(`\n❌ "${SLUG}" already exists in ${tenantDb}. Pass --force to overwrite the definition.`);
      await closeAllConnections();
      process.exit(1);
    }
    existing.name = definition.name;
    existing.relation = definition.relation;
    existing.cardinality = definition.cardinality;
    existing.channel = definition.channel;
    existing.fields = FIELDS;
    existing.external_ref_field = externalRefField;
    existing.readable_by_end_user = definition.readable_by_end_user;
    existing.enabled = definition.enabled;
    existing.markModified("fields");
    await existing.save();
    console.log(`✏️  Updated definition ${existing._id}`);
  } else {
    const created = await DataModelDefinition.create({ ...definition, external_ref_field: externalRefField });
    console.log(`✅ Created definition ${created._id}`);
  }

  const RecordModel = await getDataModelRecordModel(tenantDb, {
    slug: SLUG,
    cardinality: definition.cardinality,
    fields: FIELDS,
    external_ref_field: externalRefField,
  });
  await RecordModel.init();

  const recordFilter = { relation_id: CHANNEL_RELATION_ID, channel };
  const existingRecord = await RecordModel.findOne(recordFilter).lean();
  if (existingRecord && !args.force) {
    console.log(`↩️  channel="${channel}" record exists — left untouched (pass --force to reset values).`);
  } else {
    await RecordModel.findOneAndUpdate(
      recordFilter,
      { $set: { relation_id: CHANNEL_RELATION_ID, channel, data: coercedRecord, source: "seed", imported_at: new Date() } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    console.log(`${existingRecord ? "✏️  Reset" : "✅ Created"} channel="${channel}" record`);
  }

  const count = await RecordModel.estimatedDocumentCount();
  console.log(`\n📦 Collection dyn_${SLUG} ready in ${tenantDb} — ${count} record(s)`);
  await closeAllConnections();
  console.log("\n✨ Done.\n");
}

main().catch(async (err) => {
  console.error("\n💥 Seed failed:", err);
  await closeAllConnections();
  process.exit(1);
});
