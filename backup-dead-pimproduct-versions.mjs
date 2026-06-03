#!/usr/bin/env node
/**
 * BACKUP the DEAD PIMProduct versions to a gzipped NDJSON file BEFORE deletion.
 *
 * Use this ONLY if `mongodump` is unavailable on the box (it is not, here).
 * Prefer `mongodump` when you have it (see the runbook). This driver-based
 * fallback streams every doc matching the dead filter to a .ndjson.gz file so
 * the cleanup is fully reversible via the companion restore script.
 *
 * READ-ONLY against Mongo. Writes only the local backup file.
 *
 * Usage:
 *   node backup-dead-pimproduct-versions.mjs --db vinc-hidros-it --out /path/backup.ndjson.gz
 */
import { MongoClient } from "mongodb";
import { createWriteStream, readFileSync } from "node:fs";
import { createGzip } from "node:zlib";
import { resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { EJSON } from "bson";

const REPO_ROOT = resolve(
  "/home/jire87/software/www-website/www-data/vendereincloud-app/vendereincloud-it/vinc-commerce-suite"
);
function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
function loadUrl() {
  if (process.env.VINC_MONGO_URL) return process.env.VINC_MONGO_URL;
  try {
    let url;
    for (const l of readFileSync(resolve(REPO_ROOT, ".env"), "utf8").split(/\r?\n/)) {
      const m = l.match(/^\s*VINC_MONGO_URL\s*=\s*(.+?)\s*$/);
      if (m) url = m[1].replace(/^['"]|['"]$/g, "");
    }
    return url;
  } catch {
    return undefined;
  }
}
const MONGO_URL = arg("mongo-url", loadUrl());
const DB = arg("db");
const COLL = arg("collection", "pimproducts");
const OUT = arg("out");
if (!MONGO_URL || !DB || !OUT) {
  console.error("Usage: node backup-dead-pimproduct-versions.mjs --db <db> --out <file.ndjson.gz> [--collection pimproducts]");
  process.exit(2);
}
const DEAD_FILTER = { isCurrent: { $ne: true }, isCurrentPublished: { $ne: true } };

const client = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 10000 });
async function main() {
  await client.connect();
  const coll = client.db(DB).collection(COLL);
  const expected = await coll.countDocuments(DEAD_FILTER);
  console.log(`Backing up ${expected.toLocaleString("en-US")} dead docs from ${DB}.${COLL} -> ${OUT}`);

  const cursor = coll.find(DEAD_FILTER).batchSize(1000);
  let n = 0;
  async function* lines() {
    for await (const doc of cursor) {
      n++;
      if (n % 50000 === 0) console.log(`  ...${n.toLocaleString("en-US")} written`);
      yield EJSON.stringify(doc) + "\n"; // canonical EJSON preserves ObjectId/Date/etc.
    }
  }
  await pipeline(Readable.from(lines()), createGzip({ level: 6 }), createWriteStream(OUT));
  console.log(`Done. Wrote ${n.toLocaleString("en-US")} docs (expected ${expected.toLocaleString("en-US")}).`);
  if (n !== expected) console.warn("WARN: written count != expected (collection changed during backup). Re-run if unexpected.");
  console.log("\nJSON_SUMMARY " + JSON.stringify({ db: DB, collection: COLL, backedUp: n, expected, out: OUT }));
}
main().catch((e) => { console.error("FATAL:", e?.stack || e); process.exitCode = 1; }).finally(() => client.close().catch(() => {}));
