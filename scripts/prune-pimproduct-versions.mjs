#!/usr/bin/env node
/**
 * One-time PIM version-history cap: keep the NEWEST `keep` versions per entity_code,
 * delete the older dead ones. Mirrors capVersionsForProduct, but as a supervised
 * batch for the existing backlog.
 *
 * SAFETY
 *  - DRY-RUN by default (read-only: aggregate + count only, NO writes).
 *  - --execute requires --confirm=<tenantDb> (single tenant per run).
 *  - Per-batch deleteMany is guarded with isCurrent:{$ne:true} AND
 *    isCurrentPublished:{$ne:true} — a concurrently-promoted current can never be
 *    deleted (the guard is re-checked server-side at delete time).
 *  - Codes with != 1 isCurrent (double/zero-current anomalies) are SKIPPED, not pruned.
 *  - WiredTiger dirty% / write-queue throttle backs off under load.
 *  - Resumable via a checkpoint file; deletes are idempotent (_id-keyed).
 *  - NO PITR on a standalone server — take a mongodump of the to-delete set and
 *    verify-restore it BEFORE running --execute.
 *
 * RUN LOCATION: from the repo root (ESM resolves node_modules/mongodb here).
 *   node scripts/prune-pimproduct-versions.mjs --tenant=vinc-hidros-it          # dry-run
 *   node scripts/prune-pimproduct-versions.mjs --tenant=vinc-hidros-it --execute --confirm=vinc-hidros-it
 */

import { MongoClient } from "mongodb";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
function loadMongoUrl() {
  if (process.env.VINC_MONGO_URL) return process.env.VINC_MONGO_URL;
  try {
    let url;
    for (const line of readFileSync(resolve(ROOT, ".env"), "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*VINC_MONGO_URL\s*=\s*(.+?)\s*$/);
      if (m) url = m[1].replace(/^['"]|['"]$/g, "");
    }
    return url;
  } catch {
    return undefined;
  }
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  })
);

const DB = args.tenant || "vinc-hidros-it";
const COLL = args.collection || "pimproducts";
const KEEP = Math.max(1, parseInt(args.keep || "10", 10) || 10);
const EXECUTE = !!args.execute;
const BATCH = Math.max(1, parseInt(args["batch-size"] || "2000", 10) || 2000);
const SLEEP_MS = parseInt(args["sleep-ms"] || "150", 10) || 150;
const DIRTY_MAX = parseFloat(args["dirty-pct-max"] || "15"); // 15%: WT baseline is ~5%, trigger ~20%
const WQ_MAX = parseInt(args["write-queue-max"] || "10", 10) || 10;
const MAX_DELETES = args["max-deletes"] ? parseInt(args["max-deletes"], 10) : Infinity;
const CKPT = resolve("/tmp", `prune-ckpt-${DB}.json`);

const URL = loadMongoUrl();
if (!URL) { console.error("No VINC_MONGO_URL (env or repo .env)."); process.exit(2); }
const redact = (u) => u.replace(/\/\/([^:@/]+):([^@/]+)@/, "//$1:****@");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (EXECUTE && args.confirm !== DB) {
  console.error(`Refusing --execute without --confirm=${DB} (got --confirm=${args.confirm ?? "<none>"}).`);
  process.exit(2);
}

// Read-only oracle: per-entity_code, keep newest KEEP by {version desc, created_at desc, _id desc};
// count deletable (tail, non-current, non-published), but ZERO for codes with != 1 isCurrent (skipped).
const ORACLE = [
  { $sort: { entity_code: 1, version: -1, created_at: -1, _id: -1 } },
  { $group: {
      _id: "$entity_code",
      total: { $sum: 1 },
      currents: { $sum: { $cond: [{ $eq: ["$isCurrent", true] }, 1, 0] } },
      docs: { $push: { c: "$isCurrent", p: "$isCurrentPublished" } },
  } },
  { $project: {
      total: 1, currents: 1,
      tail: { $slice: ["$docs", KEEP, 100000] },
  } },
  { $project: {
      total: 1, currents: 1,
      deletable: {
        $cond: [
          { $eq: ["$currents", 1] },
          { $size: { $filter: { input: "$tail", cond: { $and: [{ $ne: ["$$this.c", true] }, { $ne: ["$$this.p", true] }] } } } },
          0,
        ],
      },
      protectedInTail: { $size: { $filter: { input: "$tail", cond: { $or: [{ $eq: ["$$this.c", true] }, { $eq: ["$$this.p", true] }] } } } },
  } },
  { $group: {
      _id: null,
      codes: { $sum: 1 },
      totalDocs: { $sum: "$total" },
      selected: { $sum: "$deletable" },
      protectedInTail: { $sum: "$protectedInTail" },
      codesOver10: { $sum: { $cond: [{ $gt: ["$total", KEEP] }, 1, 0] } },
      codesSkipped: { $sum: { $cond: [{ $ne: ["$currents", 1] }, 1, 0] } },
  } },
];

const client = new MongoClient(URL, {
  serverSelectionTimeoutMS: 8000,
  readPreference: "primaryPreferred",
});

async function dirtyPressureHigh(admin) {
  try {
    const s = await admin.command({ serverStatus: 1 });
    const cache = s.wiredTiger?.cache;
    const dirty = cache ? (cache["tracked dirty bytes in the cache"] / cache["maximum bytes configured"]) * 100 : 0;
    const wq = s.globalLock?.currentQueue?.writers ?? 0;
    return { high: dirty >= DIRTY_MAX || wq >= WQ_MAX, dirty: +dirty.toFixed(2), wq };
  } catch {
    return { high: false, dirty: -1, wq: -1 }; // unreadable => proceed (the pace provides gentleness)
  }
}

async function main() {
  console.log(`Mongo:      ${redact(URL)}`);
  console.log(`Database:   ${DB}   Collection: ${COLL}   keep=${KEEP}`);
  console.log(`Mode:       ${EXECUTE ? "EXECUTE (DELETES)" : "DRY-RUN (read-only)"}\n`);

  await client.connect();
  const coll = client.db(DB).collection(COLL);
  const admin = client.db("admin");

  const [total, live] = await Promise.all([
    coll.countDocuments({}),
    coll.countDocuments({ isCurrent: true }),
  ]);
  const [o] = await coll.aggregate(ORACLE, { allowDiskUse: true }).toArray();
  const sel = o || { codes: 0, totalDocs: 0, selected: 0, protectedInTail: 0, codesOver10: 0, codesSkipped: 0 };

  console.log("=== DRY-RUN ORACLE (what would be deleted) ===");
  console.log(`  total docs                 : ${total.toLocaleString("en-US")}`);
  console.log(`  live (isCurrent:true)      : ${live.toLocaleString("en-US")}`);
  console.log(`  distinct entity_code       : ${sel.codes.toLocaleString("en-US")}`);
  console.log(`  selected for deletion      : ${sel.selected.toLocaleString("en-US")}`);
  console.log(`  would keep                 : ${(total - sel.selected).toLocaleString("en-US")}`);
  console.log(`  codes with > ${KEEP} versions    : ${sel.codesOver10.toLocaleString("en-US")}`);
  console.log(`  codes SKIPPED (!=1 current) : ${sel.codesSkipped.toLocaleString("en-US")}`);
  console.log(`  published-in-tail (kept)    : ${sel.protectedInTail.toLocaleString("en-US")}`);
  console.log(`  sanity: codes == live?     : ${sel.codes === live ? "yes" : `NO (codes ${sel.codes} vs live ${live})`}\n`);

  if (!EXECUTE) {
    console.log("DRY-RUN complete. No documents were modified. Re-run with --execute --confirm=" + DB + " to delete (after mongodump + verify-restore).");
    return;
  }

  // ---- EXECUTE path (guarded, throttled, resumable) ----
  // Buffer to-delete _ids ACROSS codes into BATCH-sized chunks so the throttle +
  // pace apply per chunk (not per tiny per-code delete). Every deleteMany is
  // guarded server-side, so a freshly-promoted current/published doc is never hit.
  const done = existsSync(CKPT) ? new Set(JSON.parse(readFileSync(CKPT, "utf8")).done || []) : new Set();
  let deletedTotal = 0, scanned = 0, batches = 0;
  let buffer = [];

  async function flush() {
    if (buffer.length === 0) return;
    for (let t = 0; t < 40; t++) { const g = await dirtyPressureHigh(admin); if (!g.high) break; console.log(`  ⏸ backoff (dirty=${g.dirty}% wq=${g.wq})`); await sleep(3000); }
    const chunk = buffer; buffer = [];
    const r = await coll.deleteMany({ _id: { $in: chunk }, isCurrent: { $ne: true }, isCurrentPublished: { $ne: true } });
    deletedTotal += r.deletedCount ?? 0;
    batches += 1;
    console.log(`  batch ${batches}: deleted ${r.deletedCount ?? 0} (total ${deletedTotal.toLocaleString("en-US")})`);
    await sleep(SLEEP_MS);
  }

  const codeCursor = coll.aggregate([{ $group: { _id: "$entity_code" } }], { allowDiskUse: true });
  for await (const { _id: code } of codeCursor) {
    if (done.has(code)) continue;
    if (deletedTotal >= MAX_DELETES) { console.log(`Reached --max-deletes=${MAX_DELETES}, stopping (resumable).`); break; }

    const versions = await coll
      .find({ entity_code: code }, { projection: { _id: 1, version: 1, isCurrent: 1, isCurrentPublished: 1, created_at: 1 } })
      .sort({ version: -1, created_at: -1, _id: -1 })
      .toArray();

    const currents = versions.filter((v) => v.isCurrent === true).length;
    if (currents !== 1) { console.warn(`[SKIP] ${code}: ${currents} isCurrent (anomaly) — left for manual review`); continue; }

    for (const v of versions.slice(KEEP)) {
      if (v.isCurrent !== true && v.isCurrentPublished !== true) {
        buffer.push(v._id);
        if (buffer.length >= BATCH) await flush();
      }
    }

    done.add(code);
    if (++scanned % 1000 === 0) { writeFileSync(CKPT, JSON.stringify({ done: [...done] })); console.log(`  …${scanned} codes scanned, ${deletedTotal.toLocaleString("en-US")} deleted`); }
  }
  await flush();
  writeFileSync(CKPT, JSON.stringify({ done: [...done] }));
  console.log(`\nEXECUTE complete: ${deletedTotal.toLocaleString("en-US")} versions deleted in ${batches} batches (${scanned} codes scanned).`);
}

main().catch((e) => { console.error("\nERROR:", e?.message || e); process.exitCode = 1; }).finally(() => client.close().catch(() => {}));
