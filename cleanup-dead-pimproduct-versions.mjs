#!/usr/bin/env node
/**
 * SAFE, BATCHED, RESUMABLE cleanup of DEAD PIMProduct versions.
 *
 * "Dead" version = a version doc that is neither the current version nor the
 * currently-published version of its entity_code. We delete with the exact
 * defense-in-depth predicate used by the in-app retention service:
 *
 *     { isCurrent: { $ne: true }, isCurrentPublished: { $ne: true } }
 *
 * This provably CANNOT match the live doc: per design there is exactly one
 * isCurrent:true doc per entity_code (flipped via updateMany on supersede /
 * rollback). The {$ne:true} form also excludes any doc where isCurrent is
 * null/missing/anything-other-than-true, so a malformed doc is KEPT, not
 * deleted. Same for isCurrentPublished. We additionally NEVER key the delete
 * on `version` (the current version is not always the max version).
 *
 * ORPHAN SAFETY: an entity_code that somehow has NO isCurrent:true doc would,
 * under a naive { isCurrent:{$ne:true} } sweep, lose ALL of its versions. To
 * avoid silently nuking a product's entire history we default to PROTECTING
 * such entity_codes: before deleting a chunk we look up which of its
 * entity_codes currently lack any live doc and exclude them (see
 * --orphan-mode). Today the probe found 0 such codes in vinc-hidros-it, but
 * the guard is cheap and prevents a foot-gun under concurrency.
 *
 * STRATEGY: walk the collection by _id (ObjectId) ascending using the unique
 * _id index — the cursor position is a single ObjectId we checkpoint to a
 * resume file, so the job is fully resumable after a crash/Ctrl-C. Each
 * iteration: read up to --scan-batch dead-candidate _ids in the current _id
 * window, drop orphan-protected ones, then deleteMany on that exact _id set
 * (re-asserting the isCurrent/isCurrentPublished guard at delete time so a
 * doc promoted to current between read and delete is still spared). Pace with
 * --sleep-ms between batches to avoid hammering a live standalone mongod.
 *
 * READ-ONLY UNLESS --execute. Default mode is --dry-run (counts only, no writes).
 *
 * RUN LOCATION: must run from the repo root (or any dir whose node_modules has
 * `mongodb`). ESM ignores NODE_PATH, so /tmp gives ERR_MODULE_NOT_FOUND.
 *
 * Usage:
 *   # DRY RUN (default) — counts candidates, writes nothing:
 *   node cleanup-dead-pimproduct-versions.mjs --db vinc-hidros-it
 *
 *   # EXECUTE deletion (must be explicit):
 *   node cleanup-dead-pimproduct-versions.mjs --db vinc-hidros-it --execute
 *
 *   # Resume an interrupted run (reads the resume file automatically):
 *   node cleanup-dead-pimproduct-versions.mjs --db vinc-hidros-it --execute
 *
 * Flags:
 *   --db <name>            tenant DB (REQUIRED; no default — forces intent)
 *   --collection <name>    default: pimproducts
 *   --execute              actually delete. Omit = dry run.
 *   --scan-batch <n>       _ids read+deleted per iteration (default 1000)
 *   --sleep-ms <n>         pause between batches in ms (default 250)
 *   --max-delete <n>       safety cap: stop after N deletes (default: unlimited)
 *   --orphan-mode <skip|delete>  how to treat entity_codes with no live doc.
 *                          skip (default) = protect them; delete = allow purge.
 *   --resume-file <path>   checkpoint file (default ./.cleanup-resume-<db>.json)
 *   --from-id <hex>        start _id (overrides resume file)
 *   --reset                ignore/overwrite any existing resume checkpoint
 *   --mongo-url <uri>      override; else env VINC_MONGO_URL; else repo .env
 *
 * SAFETY: no $out/$merge, no createIndex/admin/DDL. Only find (projection _id)
 * + deleteMany on an explicit _id set with the guard re-applied. Writes go to
 * the primary (the only node); reads/scan use the default read preference.
 */

import { MongoClient, ObjectId } from "mongodb";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(
  "/home/jire87/software/www-website/www-data/vendereincloud-app/vendereincloud-it/vinc-commerce-suite"
);

// ----------------------------- arg parsing --------------------------------
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        out[key] = true; // boolean flag
      } else {
        out[key] = next;
        i++;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));

function loadMongoUrlFromEnvFile() {
  try {
    const envText = readFileSync(resolve(REPO_ROOT, ".env"), "utf8");
    let url;
    for (const line of envText.split(/\r?\n/)) {
      const m = line.match(/^\s*VINC_MONGO_URL\s*=\s*(.+?)\s*$/);
      if (m) url = m[1].replace(/^['"]|['"]$/g, ""); // last definition wins
    }
    return url;
  } catch {
    return undefined;
  }
}

const MONGO_URL =
  args["mongo-url"] || process.env.VINC_MONGO_URL || loadMongoUrlFromEnvFile();
const DB_NAME = args.db || process.env.VINC_DB_NAME;
const COLLECTION = args.collection || "pimproducts";
const EXECUTE = args.execute === true; // must be explicit
const DRY_RUN = !EXECUTE;
const SCAN_BATCH = Math.max(1, parseInt(args["scan-batch"] || "1000", 10));
const SLEEP_MS = Math.max(0, parseInt(args["sleep-ms"] || "250", 10));
const MAX_DELETE =
  args["max-delete"] != null ? parseInt(args["max-delete"], 10) : Infinity;
const ORPHAN_MODE = args["orphan-mode"] === "delete" ? "delete" : "skip";
const RESET = args.reset === true;
const RESUME_FILE =
  args["resume-file"] ||
  resolve(REPO_ROOT, `.cleanup-resume-${DB_NAME || "unknown"}.json`);
const FROM_ID = typeof args["from-id"] === "string" ? args["from-id"] : null;

if (!MONGO_URL) {
  console.error("ERROR: No Mongo URL. Use --mongo-url, set VINC_MONGO_URL, or add it to the repo .env.");
  process.exit(2);
}
if (!DB_NAME) {
  console.error("ERROR: --db <tenantDb> is REQUIRED (e.g. --db vinc-hidros-it). No default to force explicit intent.");
  process.exit(2);
}

function redact(uri) {
  return uri.replace(/\/\/([^:@/]+):([^@/]+)@/, "//$1:****@");
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The EXACT dead-version predicate. Mirrors version-retention.service.ts:116-120.
const DEAD_FILTER = { isCurrent: { $ne: true }, isCurrentPublished: { $ne: true } };

// ----------------------------- resume state -------------------------------
function loadCheckpoint() {
  if (RESET) return null;
  if (FROM_ID) return { lastId: FROM_ID, deleted: 0, scanned: 0 };
  if (existsSync(RESUME_FILE)) {
    try {
      const j = JSON.parse(readFileSync(RESUME_FILE, "utf8"));
      if (j && j.lastId) return j;
    } catch {
      /* ignore corrupt checkpoint */
    }
  }
  return null;
}
function saveCheckpoint(state) {
  if (DRY_RUN) return; // dry run never writes a checkpoint
  try {
    writeFileSync(
      RESUME_FILE,
      JSON.stringify({ ...state, db: DB_NAME, collection: COLLECTION, updatedAt: new Date().toISOString() }, null, 2)
    );
  } catch (e) {
    console.warn(`WARN: could not write resume file ${RESUME_FILE}: ${e.message}`);
  }
}

// --------------------------------- main -----------------------------------
const client = new MongoClient(MONGO_URL, {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  // Writes always go to the primary; standalone has only one node anyway.
});

let interrupted = false;
process.on("SIGINT", () => {
  console.log("\n[signal] SIGINT — finishing current batch then stopping (resume file preserved)...");
  interrupted = true;
});
process.on("SIGTERM", () => {
  console.log("\n[signal] SIGTERM — finishing current batch then stopping...");
  interrupted = true;
});

async function getOrphanEntityCodes(coll, entityCodes) {
  // Return the subset of entityCodes that currently have NO isCurrent:true doc.
  // These are the codes we must PROTECT (skip) so we never wipe a product's
  // entire history. Index-backed: {entity_code:1,isCurrent:1}.
  if (entityCodes.length === 0) return new Set();
  const live = await coll
    .find({ entity_code: { $in: entityCodes }, isCurrent: true }, { projection: { entity_code: 1, _id: 0 } })
    .toArray();
  const liveSet = new Set(live.map((d) => d.entity_code));
  const orphans = new Set();
  for (const ec of entityCodes) if (!liveSet.has(ec)) orphans.add(ec);
  return orphans;
}

async function main() {
  const startedAt = Date.now();
  console.log("==================================================================");
  console.log(" PIMProduct DEAD-version cleanup");
  console.log("==================================================================");
  console.log(`Mongo:        ${redact(MONGO_URL)}`);
  console.log(`Database:     ${DB_NAME}`);
  console.log(`Collection:   ${COLLECTION}`);
  console.log(`Mode:         ${DRY_RUN ? "DRY RUN (no writes)" : "EXECUTE (DELETING)"}`);
  console.log(`Dead filter:  ${JSON.stringify(DEAD_FILTER)}`);
  console.log(`scan-batch:   ${SCAN_BATCH}   sleep-ms: ${SLEEP_MS}   max-delete: ${MAX_DELETE}`);
  console.log(`orphan-mode:  ${ORPHAN_MODE} (skip = protect codes with no live doc)`);
  console.log(`resume-file:  ${RESUME_FILE}${RESET ? "  (RESET)" : ""}`);
  console.log("");

  await client.connect();
  const coll = client.db(DB_NAME).collection(COLLECTION);

  // Up-front snapshot (index-backed counts).
  const [total, live, deadTotal] = await Promise.all([
    coll.estimatedDocumentCount(),
    coll.countDocuments({ isCurrent: true }),
    coll.countDocuments(DEAD_FILTER),
  ]);
  console.log("=== Snapshot ===");
  console.log(`  total (est)            : ${total.toLocaleString("en-US")}`);
  console.log(`  live (isCurrent:true)  : ${live.toLocaleString("en-US")}`);
  console.log(`  dead (delete target)   : ${deadTotal.toLocaleString("en-US")}`);
  console.log("");

  if (DRY_RUN) {
    console.log("DRY RUN: no documents will be deleted. Re-run with --execute to delete.");
    console.log(`DRY RUN: would delete up to ${Math.min(deadTotal, MAX_DELETE).toLocaleString("en-US")} docs matching the dead filter`);
    console.log("         (minus any orphan-protected entity_codes under orphan-mode=skip).");
    console.log("\nJSON_SUMMARY " + JSON.stringify({ db: DB_NAME, collection: COLLECTION, mode: "dry-run", total, live, deadTotal, wouldDelete: Math.min(deadTotal, MAX_DELETE) }));
    return;
  }

  // ----------------------------- EXECUTE -----------------------------------
  const cp = loadCheckpoint();
  let cursorId = cp?.lastId ? new ObjectId(cp.lastId) : null; // exclusive lower bound
  let deleted = cp?.deleted || 0;
  let scanned = cp?.scanned || 0;
  let orphanProtected = 0;
  let batches = 0;
  if (cp?.lastId) console.log(`Resuming from _id > ${cp.lastId} (already deleted ${deleted.toLocaleString("en-US")}).`);

  while (!interrupted && deleted < MAX_DELETE) {
    const idFilter = cursorId ? { _id: { $gt: cursorId } } : {};

    // Read a window of dead-candidate _ids (plus entity_code for orphan check),
    // ascending by _id (unique index → stable, resumable cursor position).
    const candidates = await coll
      .find({ ...DEAD_FILTER, ...idFilter }, { projection: { _id: 1, entity_code: 1 } })
      .sort({ _id: 1 })
      .limit(SCAN_BATCH)
      .toArray();

    if (candidates.length === 0) {
      console.log("No more dead candidates. Done scanning.");
      break;
    }

    scanned += candidates.length;
    const lastInWindow = candidates[candidates.length - 1]._id; // advance cursor regardless
    let toDelete = candidates;

    // Orphan protection: never delete the LAST surviving version of a product.
    if (ORPHAN_MODE === "skip") {
      const codes = [...new Set(candidates.map((c) => c.entity_code).filter(Boolean))];
      const orphans = await getOrphanEntityCodes(coll, codes);
      if (orphans.size > 0) {
        const before = toDelete.length;
        toDelete = toDelete.filter((c) => !orphans.has(c.entity_code));
        const skippedNow = before - toDelete.length;
        orphanProtected += skippedNow;
        console.log(`  [orphan-guard] protected ${skippedNow} doc(s) across ${orphans.size} entity_code(s) with no live version`);
      }
    }

    // Respect the max-delete cap precisely.
    if (deleted + toDelete.length > MAX_DELETE) {
      toDelete = toDelete.slice(0, MAX_DELETE - deleted);
    }

    if (toDelete.length > 0) {
      const ids = toDelete.map((c) => c._id);
      // Re-assert the guard at delete time: if a candidate was promoted to
      // current/published between read and now, it is excluded here.
      const res = await coll.deleteMany({ _id: { $in: ids }, ...DEAD_FILTER });
      deleted += res.deletedCount || 0;
      batches++;
    }

    // Advance + checkpoint past the whole scanned window (orphan/promoted docs
    // were intentionally skipped; we don't want to re-scan them every loop).
    cursorId = lastInWindow;
    saveCheckpoint({ lastId: String(cursorId), deleted, scanned });

    const pct = deadTotal > 0 ? ((deleted / Math.min(deadTotal, MAX_DELETE)) * 100).toFixed(1) : "?";
    const rate = deleted / Math.max(1, (Date.now() - startedAt) / 1000);
    console.log(
      `  [batch ${String(batches).padStart(5)}] deleted=${deleted.toLocaleString("en-US")} ` +
        `(${pct}%) scanned=${scanned.toLocaleString("en-US")} ` +
        `lastId=${String(cursorId)} ~${rate.toFixed(0)}/s`
    );

    if (SLEEP_MS > 0 && !interrupted) await sleep(SLEEP_MS);
  }

  const liveAfter = await coll.countDocuments({ isCurrent: true });
  const deadAfter = await coll.countDocuments(DEAD_FILTER);

  console.log("\n=== Result ===");
  console.log(`  deleted this run       : ${deleted.toLocaleString("en-US")}`);
  console.log(`  scanned this run       : ${scanned.toLocaleString("en-US")}`);
  console.log(`  orphan-protected       : ${orphanProtected.toLocaleString("en-US")}`);
  console.log(`  live AFTER (sanity)    : ${liveAfter.toLocaleString("en-US")}  (should equal live BEFORE: ${live.toLocaleString("en-US")})`);
  console.log(`  dead remaining         : ${deadAfter.toLocaleString("en-US")}`);
  console.log(`  duration               : ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  if (interrupted) console.log("  STOPPED early (signal). Re-run the same command to resume from the checkpoint.");
  if (liveAfter !== live) {
    console.error("  !!! LIVE COUNT CHANGED — investigate immediately. The guard should make this impossible.");
    process.exitCode = 3;
  }
  if (deadAfter === 0 && !interrupted && MAX_DELETE === Infinity) {
    console.log("  All dead versions removed. You may delete the resume file.");
  }
  console.log("\nJSON_SUMMARY " + JSON.stringify({
    db: DB_NAME, collection: COLLECTION, mode: "execute",
    deletedThisRun: deleted, orphanProtected, liveBefore: live, liveAfter, deadRemaining: deadAfter,
  }));
}

main()
  .catch((err) => {
    console.error("\nFATAL:", err?.stack || err?.message || err);
    console.error("Resume file (if any) is preserved — re-run the same command to continue.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.close().catch(() => {});
  });
