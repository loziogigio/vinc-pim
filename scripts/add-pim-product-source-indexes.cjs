#!/usr/bin/env node
/**
 * Add the indexes that back the PIM job-detail page query.
 *
 * Why: /b2b/pim/jobs/[jobId] loads imported items via a query of the form
 *   $and:[
 *     { 'source.source_id': <id> },
 *     { $or: [
 *         { 'source.job_id': <jobId> },
 *         { 'source.imported_at': { $gte, $lte } },
 *       ] },
 *   ]
 * Without an index on `source.imported_at` (and `source.job_id`), the fallback
 * branch does a full collection scan. On tenants with >1M products this
 * exceeds the HTTP/proxy timeout and the page renders empty.
 *
 * The schema in src/lib/db/models/pim-product.ts now declares these indexes,
 * so new tenants get them via Mongoose autoIndex. This script is for existing
 * tenants whose pimproducts collections were created before the schema change.
 *
 * Usage:
 *   node scripts/add-pim-product-source-indexes.cjs <tenant-id>      # one tenant
 *   node scripts/add-pim-product-source-indexes.cjs --all            # every vinc-* db
 *
 * Examples:
 *   node scripts/add-pim-product-source-indexes.cjs dfl-it
 *   node scripts/add-pim-product-source-indexes.cjs --all
 *
 * createIndex runs with background: true so it does not block writes.
 * Index creation on a multi-million-document collection can take minutes.
 */
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const mongoose = require("mongoose");

const INDEXES = [
  { spec: { "source.imported_at": 1 }, name: "source.imported_at_1" },
  { spec: { "source.job_id": 1 }, name: "source.job_id_1" },
  // Wildcard over the multilingual slug map — backs the public B2B product
  // resolver's `slug.{lang}` lookup (any locale, no scan).
  { spec: { "slug.$**": 1 }, name: "slug.$**_1" },
];

async function processDb(dbName) {
  const conn = await mongoose
    .createConnection(process.env.VINC_MONGO_URL, { dbName })
    .asPromise();
  const collection = conn.db.collection("pimproducts");

  // Skip empty collections — happens for fresh tenants
  const docCount = await collection.estimatedDocumentCount();
  if (docCount === 0) {
    console.log(`  · ${dbName}: empty pimproducts, skipping`);
    await conn.close();
    return;
  }

  const existing = (await collection.indexes()).map((i) => i.name);

  for (const { spec, name } of INDEXES) {
    if (existing.includes(name)) {
      console.log(`  · ${dbName}: ${name} already exists`);
      continue;
    }
    const t0 = Date.now();
    process.stdout.write(`  → ${dbName}: creating ${name} ...`);
    await collection.createIndex(spec, { background: true, name });
    console.log(` done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }

  await conn.close();
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error(
      "Usage: node scripts/add-pim-product-source-indexes.cjs <tenant-id|--all>",
    );
    process.exit(1);
  }

  if (arg === "--all") {
    // Enumerate vinc-* databases via the admin connection
    const admin = await mongoose
      .createConnection(process.env.VINC_MONGO_URL, { dbName: "admin" })
      .asPromise();
    const dbs = await admin.db.admin().listDatabases();
    await admin.close();

    const tenantDbs = dbs.databases
      .map((d) => d.name)
      .filter((n) => n.startsWith("vinc-") && n !== "vinc-admin");

    console.log(`Processing ${tenantDbs.length} tenant databases:\n`);
    for (const dbName of tenantDbs) {
      await processDb(dbName);
    }
  } else {
    const dbName = arg.startsWith("vinc-") ? arg : `vinc-${arg}`;
    console.log(`Processing ${dbName}:\n`);
    await processDb(dbName);
  }

  console.log("\n✅ Done");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
