#!/usr/bin/env node
/**
 * Drop ONLY the hardcoded safe-orphan indexes on one tenant's pimproducts.
 * These 6 are 0-usage AND not declared by the current schema, so:
 *   - dropping them is reversible (a rebuild re-adds them), and
 *   - deploying current code will NOT recreate them (they aren't in the schema).
 * The script refuses to drop anything not in SAFE_ORPHANS. No data is touched.
 *
 * Run from repo root:
 *   node scripts/drop-pimproduct-orphan-indexes.mjs --tenant=vinc-hidros-it --confirm=vinc-hidros-it
 * Add --dry-run to only print what it would drop.
 */
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Excludes sku_1 and source.job_id_1 (those back the SKU-fallback resolver and the
// import-job audit view respectively — kept pending an explicit decision).
const SAFE_ORPHANS = [
  "source.source_id_1",
  "source.batch_id_1",
  "has_conflict_1",
  "channels_1",
  "not_visible_1",
  "source.imported_at_1",
];

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  })
);
const DB = args.tenant || "vinc-hidros-it";
const COLL = args.collection || "pimproducts";
const DRY = !!args["dry-run"];

function loadUrl() {
  if (process.env.VINC_MONGO_URL) return process.env.VINC_MONGO_URL;
  for (const line of readFileSync(resolve(process.cwd(), ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*VINC_MONGO_URL\s*=\s*(.+?)\s*$/);
    if (m) return m[1].replace(/^['"]|['"]$/g, "");
  }
}
const URL = loadUrl();
if (!URL) { console.error("No VINC_MONGO_URL."); process.exit(2); }
if (!DRY && args.confirm !== DB) {
  console.error(`Refusing to drop without --confirm=${DB} (got --confirm=${args.confirm ?? "<none>"}). Use --dry-run to preview.`);
  process.exit(2);
}

const client = new MongoClient(URL, { serverSelectionTimeoutMS: 8000 });
async function main() {
  console.log(`DB ${DB} / ${COLL}  mode=${DRY ? "DRY-RUN" : "DROP"}\n`);
  await client.connect();
  const coll = client.db(DB).collection(COLL);
  const before = await coll.indexes();
  const present = new Set(before.map((i) => i.name));
  console.log(`Indexes before: ${before.length}`);

  for (const name of SAFE_ORPHANS) {
    if (!present.has(name)) { console.log(`  - ${name}: not present (skip)`); continue; }
    if (DRY) { console.log(`  • would drop ${name}`); continue; }
    try { await coll.dropIndex(name); console.log(`  ✓ dropped ${name}`); }
    catch (e) { console.log(`  ✗ ${name}: ${e.message}`); }
  }

  const after = (await coll.indexes()).length;
  console.log(`\nIndexes ${DRY ? "(unchanged, dry-run): " : "now: "}${after}`);
}
main().catch((e) => { console.error("ERROR:", e?.message || e); process.exitCode = 1; }).finally(() => client.close().catch(() => {}));
