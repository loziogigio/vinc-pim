/**
 * Seed: analytics_settings data model (channel-scoped ad-destination config)
 *
 * One config record per sales channel (relation: "channel"): the definition
 * applies to all channels (channel "*"), every record is pinned to the sentinel
 * relation_id "_channel", and the record's `channel` field is the scope key. The
 * record holds per-destination on/off + PUBLIC ids only; API tokens live in
 * rudder-server, never here.
 *
 * Read server-side by the marketing site via
 *   GET /api/b2b/data-models/analytics_settings/records?channel=<code>
 * to set RudderStack per-event `integrations`. `readable_by_end_user: false`.
 * Once seeded, schema + record are editable from the admin at
 * /b2b/admin/data-models/analytics_settings.
 *
 * Usage:
 *   pnpm tsx src/scripts/seed-data-model-analytics-settings.ts --tenant <id> --channel <code>
 *   pnpm tsx src/scripts/seed-data-model-analytics-settings.ts --tenant <id> --channel <code> --dry-run
 *   pnpm tsx src/scripts/seed-data-model-analytics-settings.ts --tenant <id> --channel <code> --force
 *
 * Seeds all destinations OFF (edit in admin to enable). --force overwrites the
 * definition and resets the record.
 */

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
import { ANALYTICS_SETTINGS_BLUEPRINT } from "@/lib/data-models/blueprints/analytics-settings";

interface Args {
  tenant?: string;
  channel: string;
  dryRun: boolean;
  force: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const out: Args = { channel: "", dryRun: false, force: false };
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

// Single source of truth — same blueprint the admin/install path consumes.
const { definition: BLUEPRINT_DEF } = ANALYTICS_SETTINGS_BLUEPRINT;
const SLUG = BLUEPRINT_DEF.slug;
const FIELDS = BLUEPRINT_DEF.fields;

async function main() {
  const args = parseArgs();
  if (!args.tenant || !args.channel) {
    console.error("Usage: --tenant <id> --channel <code> [--dry-run] [--force]");
    process.exit(1);
  }
  const tenantDb = `vinc-${args.tenant}`;
  const channel = args.channel;

  // Channel models are single-cardinality and apply to all channels (definition
  // channel "*"); the record's own channel field is the scope key.
  const definition = applyChannelRelationDefaults({ ...BLUEPRINT_DEF, channel: "*" });
  const recordData = ANALYTICS_SETTINGS_BLUEPRINT.defaultRecord!.data;

  console.log(`\n📋 Seed analytics_settings data model`);
  console.log(`   Tenant   : ${args.tenant} (database: ${tenantDb})`);
  console.log(`   Slug     : ${SLUG}`);
  console.log(`   Relation : channel (definition channel: "*")`);
  console.log(`   Record   : relation_id="${CHANNEL_RELATION_ID}", channel="${channel}" (all destinations OFF)\n`);

  validateFieldsTree(FIELDS);
  const externalRefField = findExternalRefField(FIELDS); // undefined — single cardinality
  const coercedRecord = validateRecordData(recordData, FIELDS, { strict: true });

  if (args.dryRun) {
    console.log("\n🌵 Dry run — would create definition:");
    console.log(JSON.stringify({ ...definition, external_ref_field: externalRefField }, null, 2));
    console.log(`\n🌵 Dry run — would seed channel="${channel}" record data:`);
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
    existing.relation = definition.relation;
    existing.cardinality = definition.cardinality;
    existing.channel = definition.channel;
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

  // Single cardinality upserts by (relation_id, channel). Only write when absent
  // unless --force, to preserve admin edits.
  const recordFilter = { relation_id: CHANNEL_RELATION_ID, channel };
  const existingRecord = await RecordModel.findOne(recordFilter).lean();
  if (existingRecord && !args.force) {
    console.log(
      `\n↩️  channel="${channel}" record already exists — left untouched (pass --force to reset it).`
    );
  } else {
    await RecordModel.findOneAndUpdate(
      recordFilter,
      {
        $set: {
          relation_id: CHANNEL_RELATION_ID,
          channel,
          data: coercedRecord,
          source: "seed",
          imported_at: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    console.log(`\n${existingRecord ? "✏️  Reset" : "✅ Created"} channel="${channel}" record`);
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
