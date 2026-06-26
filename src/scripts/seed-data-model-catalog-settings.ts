/**
 * Seed: catalog_settings data model (channel-scoped catalog UI config)
 *
 * One config record per sales channel (relation: "channel"): the definition
 * applies to all channels (channel "*"), every record is pinned to the sentinel
 * relation_id "_channel", and the record's `channel` field is the scope key.
 * The record holds two enums — `default_view` (grid|list) and `product_open_mode`
 * (modal|detail_page) — consumed by vinc-b2b's time-theme catalog listing.
 *
 * Fetched by vinc-b2b at runtime (Redis-cached) via
 *   GET /api/b2b/data-models/catalog_settings/records?channel=<code>
 * and re-exposed to the storefront through /api/b2b/catalog-settings.
 *
 * `readable_by_end_user: false` — server-side only. Once seeded, schema + record
 * are editable from the admin at /b2b/admin/data-models/catalog_settings.
 *
 * Usage:
 *   pnpm tsx src/scripts/seed-data-model-catalog-settings.ts --tenant <id> --channel b2b
 *   pnpm tsx src/scripts/seed-data-model-catalog-settings.ts --tenant <id> --channel b2b --view list --open detail_page
 *   pnpm tsx src/scripts/seed-data-model-catalog-settings.ts --tenant <id> --channel b2b --dry-run
 *   pnpm tsx src/scripts/seed-data-model-catalog-settings.ts --tenant <id> --channel b2b --force
 *
 * Defaults: --view grid, --open modal (matches the previous hardcoded behaviour).
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
import { CATALOG_SETTINGS_BLUEPRINT } from "@/lib/data-models/blueprints/catalog-settings";

type View = "grid" | "list";
type OpenMode = "modal" | "detail_page";

interface Args {
  tenant?: string;
  channel: string;
  view: View;
  open: OpenMode;
  dryRun: boolean;
  force: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const out: Args = {
    channel: "b2b",
    view: "grid",
    open: "modal",
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
      case "--view": {
        const v = argv[++i];
        if (v !== "grid" && v !== "list") {
          console.error(`--view must be 'grid' or 'list' (got "${v}")`);
          process.exit(1);
        }
        out.view = v;
        break;
      }
      case "--open": {
        const v = argv[++i];
        if (v !== "modal" && v !== "detail_page") {
          console.error(`--open must be 'modal' or 'detail_page' (got "${v}")`);
          process.exit(1);
        }
        out.open = v;
        break;
      }
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
const { definition: BLUEPRINT_DEF } = CATALOG_SETTINGS_BLUEPRINT;
const SLUG = BLUEPRINT_DEF.slug;
const FIELDS = BLUEPRINT_DEF.fields;

async function main() {
  const args = parseArgs();
  if (!args.tenant) {
    console.error(
      "Usage: --tenant <id> [--channel <code>] [--view grid|list] [--open modal|detail_page] [--dry-run] [--force]"
    );
    process.exit(1);
  }
  const tenantDb = `vinc-${args.tenant}`;
  const channel = args.channel;

  // Channel models are always single-cardinality and apply to all channels
  // (definition channel "*"); the record's own channel field is the scope key.
  const definition = applyChannelRelationDefaults({ ...BLUEPRINT_DEF, channel: "*" });

  const recordData = {
    default_view: args.view,
    product_open_mode: args.open,
  };

  console.log(`\n📋 Seed catalog_settings data model`);
  console.log(`   Tenant           : ${args.tenant} (database: ${tenantDb})`);
  console.log(`   Slug             : ${SLUG}`);
  console.log(`   Relation         : channel (definition channel: "*")`);
  console.log(`   Record           : relation_id="${CHANNEL_RELATION_ID}", channel="${channel}"`);
  console.log(`   default_view     : ${recordData.default_view}`);
  console.log(`   product_open_mode: ${recordData.product_open_mode}\n`);

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
