#!/usr/bin/env node
/**
 * READ-ONLY audit of pimproducts indexes: lists every index with its key spec and
 * its $indexStats usage (ops since the server last started). Least-used indexes are
 * the candidates to drop in the 24 -> ~13 trim. NO writes, no dropIndex — it only
 * prints the dropIndex commands you would run.
 *
 * Run from repo root: node scripts/pimproduct-index-audit.mjs [tenantDb]
 */
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadUrl() {
  if (process.env.VINC_MONGO_URL) return process.env.VINC_MONGO_URL;
  for (const line of readFileSync(resolve(process.cwd(), ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*VINC_MONGO_URL\s*=\s*(.+?)\s*$/);
    if (m) return m[1].replace(/^['"]|['"]$/g, "");
  }
}
const DB = process.argv[2] || "vinc-hidros-it";
const COLL = process.argv[3] || "pimproducts";
const URL = loadUrl();
if (!URL) { console.error("No VINC_MONGO_URL."); process.exit(2); }

const client = new MongoClient(URL, { serverSelectionTimeoutMS: 8000, readPreference: "primaryPreferred" });

async function main() {
  console.log(`DB ${DB} / ${COLL}  (READ-ONLY index audit)\n`);
  await client.connect();
  const coll = client.db(DB).collection(COLL);

  const indexes = await coll.indexes();
  let stats = [];
  try { stats = await coll.aggregate([{ $indexStats: {} }]).toArray(); } catch (e) { console.warn("indexStats unavailable:", e.message); }
  const ops = Object.fromEntries(stats.map((s) => [s.name, s.accesses?.ops ?? 0]));

  console.log(`Total indexes: ${indexes.length}\n`);
  const rows = indexes
    .map((ix) => ({ name: ix.name, key: JSON.stringify(ix.key), unique: !!ix.unique, ops: ops[ix.name] ?? 0 }))
    .sort((a, b) => a.ops - b.ops);

  console.log("USAGE  UNIQUE  NAME  KEY");
  for (const r of rows) {
    console.log(`${String(r.ops).padStart(8)}  ${r.unique ? "U" : " "}  ${r.name.padEnd(34)} ${r.key}`);
  }

  const dropCandidates = rows.filter((r) => r.name !== "_id_" && r.ops === 0);
  console.log(`\n=== ${dropCandidates.length} index(es) with ZERO usage since server start (review before dropping) ===`);
  for (const r of dropCandidates) {
    console.log(`  db.getSiblingDB("${DB}").${COLL}.dropIndex("${r.name}")   // key ${r.key}`);
  }
  console.log("\nNOTE: 0 ops can also mean 'rarely used' (stats reset on restart). Confirm against query patterns before dropping. Never drop _id_ or the index backing a unique constraint you rely on.");
}
main().catch((e) => { console.error("ERROR:", e?.message || e); process.exitCode = 1; }).finally(() => client.close().catch(() => {}));
