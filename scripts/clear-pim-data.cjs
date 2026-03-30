/**
 * Clear PIM product data for a tenant.
 *
 * Usage:
 *   node scripts/clear-pim-data.cjs offerte-crociere-it
 */

const { runScript } = require("./lib/db-connect.cjs");
const mongoose = require("mongoose");

runScript(async (tenantId) => {
  const db = mongoose.connection.db;

  // Show current counts
  const collections = ["pimproducts", "pimbrands", "pimcategories", "departures", "bookings"];
  console.log("Current data:");
  for (const name of collections) {
    try {
      const count = await db.collection(name).countDocuments();
      console.log(`  ${name}: ${count}`);
    } catch {
      console.log(`  ${name}: (not found)`);
    }
  }

  // Clear pimproducts
  const prodResult = await db.collection("pimproducts").deleteMany({});
  console.log(`\nDeleted ${prodResult.deletedCount} products from pimproducts`);

  // Clear pimbrands
  const brandResult = await db.collection("pimbrands").deleteMany({});
  console.log(`Deleted ${brandResult.deletedCount} brands from pimbrands`);

  // Clear pimcategories
  const catResult = await db.collection("pimcategories").deleteMany({});
  console.log(`Deleted ${catResult.deletedCount} categories from pimcategories`);

  console.log("\nDone. Departures and bookings were NOT touched.");
});
