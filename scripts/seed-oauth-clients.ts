/**
 * Seed OAuth Clients Script
 *
 * Run with: pnpm vite-node scripts/seed-oauth-clients.ts
 *
 * Options:
 *   --force    Recreate existing clients (generates new secrets)
 */

import { config } from "dotenv";
import { connectToAdminDatabase } from "../src/lib/db/admin-connection";
import { seedOAuthClients, listOAuthClients } from "../src/lib/sso/seed-clients";

// Load environment variables
config();

async function main() {
  const force = process.argv.includes("--force");

  console.log("=".repeat(60));
  console.log("SSO OAuth Client Seeder");
  console.log("=".repeat(60));
  console.log();

  if (force) {
    console.log("⚠️  Force mode enabled - existing clients will be recreated");
    console.log();
  }

  try {
    // Connect to admin database
    console.log("Connecting to admin database...");
    await connectToAdminDatabase();
    console.log("✅ Connected\n");

    // Seed clients
    console.log("Seeding OAuth clients...\n");
    const results = await seedOAuthClients(force);

    // Display results
    console.log("-".repeat(60));
    console.log("Results:");
    console.log("-".repeat(60));

    let hasNewSecrets = false;

    for (const result of results) {
      const statusIcon =
        result.status === "created"
          ? "✅"
          : result.status === "exists"
          ? "⏭️ "
          : "❌";

      console.log(`${statusIcon} ${result.client_id}`);
      console.log(`   Name: ${result.name}`);
      console.log(`   Status: ${result.status}`);

      if (result.client_secret) {
        hasNewSecrets = true;
        console.log(`   🔑 Client Secret: ${result.client_secret}`);
      }

      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }

      console.log();
    }

    if (hasNewSecrets) {
      console.log("=".repeat(60));
      console.log("⚠️  IMPORTANT: Save the client secrets above!");
      console.log("   They cannot be retrieved later.");
      console.log("=".repeat(60));
      console.log();
    }

    // List all clients
    console.log("-".repeat(60));
    console.log("All registered OAuth clients:");
    console.log("-".repeat(60));

    const clients = await listOAuthClients();

    for (const client of clients) {
      console.log(`• ${client.client_id}`);
      console.log(`  Name: ${client.name}`);
      console.log(`  Type: ${client.type}`);
      console.log(`  First-party: ${client.is_first_party ? "Yes" : "No"}`);
      console.log(`  Redirect URIs: ${client.redirect_uris.length}`);
      console.log();
    }

    console.log("Done!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();
