/**
 * Seed Campaign Templates Script
 *
 * Seeds the new product and generic campaign templates.
 *
 * Usage: npx tsx scripts/seed-campaign-templates.ts [--force]
 */

import "dotenv/config";
import { seedCampaignTemplates } from "../src/lib/notifications/seed-templates";

const TENANT_DB = process.env.VINC_MONGO_DB || "vinc-hidros-it";

async function main() {
  const force = process.argv.includes("--force");

  console.log("=== Seed Campaign Templates ===\n");
  console.log(`Tenant: ${TENANT_DB}`);
  console.log(`Force: ${force}\n`);

  const result = await seedCampaignTemplates(TENANT_DB, force);

  console.log("\n=== Results ===");
  console.log(`Created: ${result.created}`);
  console.log(`Skipped: ${result.skipped}`);

  console.log("\n=== Done ===");
  process.exit(0);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
