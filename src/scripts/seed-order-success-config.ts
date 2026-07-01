/**
 * Seed: point a channel's cart_settings at the per-language order-success CMS
 * pages created by seed-order-success-pages.ts.
 *
 * - Ensures the live cart_settings definition has the `order_success_pages`
 *   field (adds it from the blueprint if missing — non-destructive).
 * - Merges the 6 lang→slug mappings into the channel record's data, preserving
 *   the existing show_* booleans.
 *
 * Usage:
 *   pnpm tsx src/scripts/seed-order-success-config.ts --tenant baseprotection-com --channel b2b
 *   pnpm tsx src/scripts/seed-order-success-config.ts --tenant baseprotection-com --dry-run
 */

import "dotenv/config";
import { connectWithModels, closeAllConnections } from "@/lib/db/connection";
import { getDataModelRecordModel } from "@/lib/db/model-registry";
import { CHANNEL_RELATION_ID } from "@/lib/db/models/data-model-definition";
import { CART_SETTINGS_BLUEPRINT } from "@/lib/data-models/blueprints/cart-settings";

const SLUG = "cart_settings";
const FIELD = "order_success_pages";

const MAPPINGS = [
  { lang: "it", slug: "ordine-ricevuto" },
  { lang: "en", slug: "order-received" },
  { lang: "fr", slug: "commande-recue" },
  { lang: "de", slug: "bestellung-erhalten" },
  { lang: "es", slug: "pedido-recibido" },
  { lang: "pt", slug: "pedido-recebido" },
];

interface Args {
  tenant?: string;
  channel: string;
  dryRun: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const out: Args = { channel: "b2b", dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--tenant":
        out.tenant = argv[++i];
        break;
      case "--channel":
        out.channel = argv[++i];
        break;
      case "--dry-run":
        out.dryRun = true;
        break;
      default:
        console.error(`Unknown argument: ${argv[i]}`);
        process.exit(1);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs();
  if (!args.tenant) {
    console.error("Usage: --tenant <id> [--channel b2b] [--dry-run]");
    process.exit(1);
  }
  const tenantDb = `vinc-${args.tenant}`;
  const channel = args.channel;

  console.log(`\n🔗 Wire cart_settings → order-success pages`);
  console.log(`   Tenant : ${args.tenant} (database: ${tenantDb})`);
  console.log(`   Channel: ${channel}`);
  console.log(`   Mapping: ${MAPPINGS.map((m) => `${m.lang}→${m.slug}`).join(", ")}\n`);

  const { DataModelDefinition } = await connectWithModels(tenantDb);
  const def = await DataModelDefinition.findOne({ slug: SLUG });
  if (!def) {
    console.error(`❌ No ${SLUG} definition in ${tenantDb}. Seed cart_settings first.`);
    await closeAllConnections();
    process.exit(1);
  }

  // 1) Ensure the definition carries the order_success_pages field.
  const hasField = (def.fields as any[]).some((f) => f.slug === FIELD);
  if (!hasField) {
    const fieldDef = CART_SETTINGS_BLUEPRINT.definition.fields.find(
      (f) => f.slug === FIELD,
    );
    if (!fieldDef) throw new Error(`Blueprint is missing the ${FIELD} field`);
    if (args.dryRun) {
      console.log(`🌵 Would add "${FIELD}" field to the definition.`);
    } else {
      (def.fields as any[]).push(fieldDef);
      def.markModified("fields");
      await def.save();
      console.log(`✏️  Added "${FIELD}" field to the definition.`);
    }
  } else {
    console.log(`✓ Definition already has "${FIELD}".`);
  }

  // 2) Merge the mappings into the channel record, preserving other fields.
  const RecordModel = await getDataModelRecordModel(tenantDb, {
    slug: SLUG,
    cardinality: def.cardinality,
    fields: def.fields as any[],
    external_ref_field: def.external_ref_field,
  });
  await RecordModel.init();

  const filter = { relation_id: CHANNEL_RELATION_ID, channel };
  const existing = await RecordModel.findOne(filter).lean<{ data?: Record<string, unknown> } | null>();
  const merged = { ...(existing?.data ?? {}), [FIELD]: MAPPINGS };

  console.log(`\nRecord data (channel="${channel}") after merge:`);
  console.log(JSON.stringify(merged, null, 2));

  if (args.dryRun) {
    console.log("\n🌵 Dry run — nothing written.");
    await closeAllConnections();
    return;
  }

  await RecordModel.findOneAndUpdate(
    filter,
    {
      $set: {
        relation_id: CHANNEL_RELATION_ID,
        channel,
        data: merged,
        updated_at: new Date(),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  console.log(`\n✅ Record updated.`);
  console.log("\n✨ Done.\n");
}

main()
  .catch((err) => {
    console.error("\n💥 Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeAllConnections();
  });
