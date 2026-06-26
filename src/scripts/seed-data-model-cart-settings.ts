/**
 * Seed: cart_settings data model (channel-scoped cart UI toggles)
 *
 * One config record per sales channel (relation: "channel"): the definition
 * applies to all channels (channel "*"), every record is pinned to the sentinel
 * relation_id "_channel", and the record's `channel` field is the scope key.
 * The record holds two booleans — `show_line_note` (per-line note input in the
 * cart table) and `show_head_note` (order head note textarea on checkout).
 *
 * Fetched by vinc-b2b at runtime (Redis-cached) via
 *   GET /api/b2b/data-models/cart_settings/records?channel=<code>
 * and re-exposed to the storefront through /api/b2b/cart-settings.
 *
 * `readable_by_end_user: false` — server-side only. Once seeded, schema + record
 * are editable from the admin at /b2b/admin/data-models/cart_settings.
 *
 * Usage:
 *   pnpm tsx src/scripts/seed-data-model-cart-settings.ts --tenant <id> --channel b2b
 *   pnpm tsx src/scripts/seed-data-model-cart-settings.ts --tenant <id> --channel b2b --line-note --head-note
 *   pnpm tsx src/scripts/seed-data-model-cart-settings.ts --tenant <id> --channel b2b --dry-run
 *   pnpm tsx src/scripts/seed-data-model-cart-settings.ts --tenant <id> --channel b2b --force
 *
 * Both notes default OFF; pass --line-note / --head-note to seed them ON.
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
import { CART_SETTINGS_BLUEPRINT } from "@/lib/data-models/blueprints/cart-settings";

interface Args {
  tenant?: string;
  channel: string;
  lineNote: boolean;
  headNote: boolean;
  pickup: boolean;
  dryRun: boolean;
  force: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const out: Args = {
    channel: "b2b",
    lineNote: false,
    headNote: false,
    // Pickup defaults ON (it was always shown before this flag existed); pass
    // --hide-pickup to seed it OFF.
    pickup: true,
    dryRun: false,
    force: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--tenant":
        out.tenant = argv[++i];
        break;
      case "--channel":
        out.channel = argv[++i];
        break;
      case "--line-note":
        out.lineNote = true;
        break;
      case "--head-note":
        out.headNote = true;
        break;
      case "--hide-pickup":
        out.pickup = false;
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
const { definition: BLUEPRINT_DEF } = CART_SETTINGS_BLUEPRINT;
const SLUG = BLUEPRINT_DEF.slug;
const FIELDS = BLUEPRINT_DEF.fields;

async function main() {
  const args = parseArgs();
  if (!args.tenant) {
    console.error(
      "Usage: --tenant <id> [--channel <code>] [--line-note] [--head-note] [--hide-pickup] [--dry-run] [--force]"
    );
    process.exit(1);
  }
  const tenantDb = `vinc-${args.tenant}`;
  const channel = args.channel;

  // Channel models are always single-cardinality and apply to all channels
  // (definition channel "*"); the record's own channel field is the scope key.
  const definition = applyChannelRelationDefaults({ ...BLUEPRINT_DEF, channel: "*" });

  const recordData = {
    show_line_note: args.lineNote,
    show_head_note: args.headNote,
    show_pickup: args.pickup,
  };

  console.log(`\n📋 Seed cart_settings data model`);
  console.log(`   Tenant        : ${args.tenant} (database: ${tenantDb})`);
  console.log(`   Slug          : ${SLUG}`);
  console.log(`   Relation      : channel (definition channel: "*")`);
  console.log(`   Record        : relation_id="${CHANNEL_RELATION_ID}", channel="${channel}"`);
  console.log(`   show_line_note: ${recordData.show_line_note}`);
  console.log(`   show_head_note: ${recordData.show_head_note}`);
  console.log(`   show_pickup   : ${recordData.show_pickup}\n`);

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

  // Single cardinality upserts by (relation_id, channel). Only write when
  // absent unless --force, to preserve admin edits.
  const recordFilter = { relation_id: CHANNEL_RELATION_ID, channel };
  const existingRecord = await RecordModel.findOne(recordFilter).lean();
  if (existingRecord && !args.force) {
    console.log(
      `\n↩️  channel="${channel}" record already exists — left untouched ` +
        `(pass --force to reset it).`
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
    console.log(
      `\n${existingRecord ? "✏️  Reset" : "✅ Created"} channel="${channel}" record`
    );
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
