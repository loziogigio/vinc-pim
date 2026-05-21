/**
 * One-off verification for the PIM version-retention service.
 *
 * Usage:
 *   pnpm dlx tsx scripts/verify-pim-version-prune.ts dfl-it           # dry-run only
 *   pnpm dlx tsx scripts/verify-pim-version-prune.ts dfl-it --apply   # actually delete
 *
 * Reports the top products by version count, runs getPrunePreview()
 * for the configured retention policy, and (only with --apply) runs
 * pruneVersionsForTenant() and re-reports.
 */

import "dotenv/config";
import {
  pruneVersionsForTenant,
  getPrunePreview,
  DEFAULT_VERSION_RETENTION_POLICY,
} from "../src/lib/pim/version-retention.service";
import { connectWithModels } from "../src/lib/db/connection";
import { closeAllConnections } from "../src/lib/db/connection-pool";

async function topProductsByVersionCount(tenantDb: string, n = 10) {
  const { PIMProduct } = await connectWithModels(tenantDb);
  return PIMProduct.aggregate([
    { $group: { _id: "$entity_code", versions: { $sum: 1 } } },
    { $sort: { versions: -1 } },
    { $limit: n },
  ]);
}

async function main() {
  const tenant = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!tenant) {
    console.error("Usage: verify-pim-version-prune.ts <tenant_id> [--apply]");
    process.exit(2);
  }
  const tenantDb = `vinc-${tenant}`;

  console.log(`\n=== Verifying PIM version retention against ${tenantDb} ===\n`);
  console.log("Policy (effective):", DEFAULT_VERSION_RETENTION_POLICY);

  const topBefore = await topProductsByVersionCount(tenantDb);
  console.log("\nTop products by version count (before):");
  for (const t of topBefore) console.log(`  ${String(t._id).padEnd(20)} ${t.versions}`);

  console.time("preview");
  const preview = await getPrunePreview(tenantDb);
  console.timeEnd("preview");
  console.log("\nDry-run preview:");
  console.log(`  productsScanned       = ${preview.productsScanned}`);
  console.log(`  candidatesForDeletion = ${preview.candidatesForDeletion}`);

  if (!apply) {
    console.log("\n(dry-run only — re-run with --apply to delete)");
    await closeAllConnections();
    return;
  }

  console.log("\n--apply set: pruning for real…");
  console.time("prune");
  const result = await pruneVersionsForTenant(tenantDb);
  console.timeEnd("prune");
  console.log("Result:", result);

  const topAfter = await topProductsByVersionCount(tenantDb);
  console.log("\nTop products by version count (after):");
  for (const t of topAfter) console.log(`  ${String(t._id).padEnd(20)} ${t.versions}`);

  await closeAllConnections();
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
