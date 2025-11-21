/**
 * Example: Sync Products to All Channels
 * Demonstrates syncing to eBay, Amazon, ManoMano, Trovaprezzi, B2B, B2C, and Solr
 */

import { syncProductToMarketplaces } from "../src/lib/sync/marketplace-sync";

const API_BASE = "http://localhost:3000";

/**
 * Example 1: Import products with batch tracking
 */
async function importProducts() {
  console.log("📦 Step 1: Import products with batch tracking\n");

  const batch_id = `batch_multichannel_${Date.now()}`;
  const batch_metadata = {
    batch_id,
    batch_part: 1,
    batch_total_parts: 1,
    batch_total_items: 3,
  };

  const products = [
    {
      entity_code: "MULTI-001",
      sku: "MULTI-001",
      name: "Professional Power Drill",
      description: "High-performance cordless power drill for professionals",
      price: 199.99,
      wholesale_price: 149.99,
      currency: "EUR",
      stock_quantity: 50,
      status: "published",
      brand: "DeWalt",
      category: "Power Tools",
    },
    {
      entity_code: "MULTI-002",
      sku: "MULTI-002",
      name: "Garden Hose Set",
      description: "Complete garden hose set with spray nozzle",
      price: 49.99,
      wholesale_price: 34.99,
      currency: "EUR",
      stock_quantity: 200,
      status: "published",
      brand: "Gardena",
      category: "Garden & Outdoor",
    },
    {
      entity_code: "MULTI-003",
      sku: "MULTI-003",
      name: "LED Work Light",
      description: "Rechargeable LED work light with magnetic base",
      price: 79.99,
      wholesale_price: 59.99,
      currency: "EUR",
      stock_quantity: 100,
      status: "published",
      brand: "Bosch",
      category: "Lighting",
    },
  ];

  console.log(`   Batch ID: ${batch_id}`);
  console.log(`   Products: ${products.length}\n`);

  const response = await fetch(`${API_BASE}/api/b2b/pim/import/api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      products,
      source_id: "test-default-lang",
      batch_id,
      batch_metadata,
      sync_to_search: false, // We'll sync manually
    }),
  });

  const result = await response.json();

  console.log("✅ Import Result:");
  console.log(`   Imported: ${result.summary.successful}/${result.summary.total}`);
  console.log();

  return products.map((p) => p.entity_code);
}

/**
 * Example 2: Sync to specific channel groups
 */
async function syncToChannelGroups(entity_codes: string[]) {
  console.log("🚀 Step 2: Sync to different channel groups\n");

  for (const entity_code of entity_codes) {
    console.log(`\n📤 Syncing ${entity_code}...`);

    // A. Sync to storefronts (B2B, B2C, Solr)
    console.log("   → Syncing to storefronts (B2B, B2C, Solr)...");
    await syncProductToMarketplaces(entity_code, {
      channels: ["b2b", "b2c", "solr"],
      operation: "update",
      priority: "high",
    });

    // B. Sync to Italian marketplaces (Amazon IT, Trovaprezzi, ManoMano)
    console.log("   → Syncing to Italian marketplaces...");
    await syncProductToMarketplaces(entity_code, {
      channels: ["amazon", "trovaprezzi", "manomano"],
      operation: "update",
      priority: "normal",
    });

    // C. Sync to international marketplaces (eBay)
    console.log("   → Syncing to international marketplaces...");
    await syncProductToMarketplaces(entity_code, {
      channels: ["ebay"],
      operation: "update",
      priority: "normal",
    });

    console.log(`   ✓ ${entity_code} queued for sync to all channels`);
  }

  console.log("\n✅ All products queued for multichannel sync\n");
}

/**
 * Example 3: Sync to ALL enabled channels at once
 */
async function syncToAllChannels(entity_codes: string[]) {
  console.log("🌐 Step 3: Sync to ALL enabled channels\n");

  for (const entity_code of entity_codes) {
    console.log(`   Syncing ${entity_code} to all enabled channels...`);

    // Sync to ALL enabled channels (reads from .env)
    await syncProductToMarketplaces(entity_code, {
      operation: "update",
    });

    console.log(`   ✓ ${entity_code} synced to all channels`);
  }

  console.log("\n✅ All products synced to all enabled channels\n");
}

/**
 * Example 4: Different operations on different channels
 */
async function demonstrateOperations() {
  console.log("⚡ Step 4: Different operations on different channels\n");

  const entity_code = "MULTI-001";

  // Update full product on storefronts
  console.log("   → Full product update on storefronts...");
  await syncProductToMarketplaces(entity_code, {
    channels: ["b2b", "b2c", "solr"],
    operation: "update",
  });

  // Update only inventory on marketplaces (faster)
  console.log("   → Inventory update on marketplaces...");
  await syncProductToMarketplaces(entity_code, {
    channels: ["ebay", "amazon"],
    operation: "inventory",
  });

  // Update only price on price comparison sites
  console.log("   → Price update on price comparison...");
  await syncProductToMarketplaces(entity_code, {
    channels: ["trovaprezzi"],
    operation: "price",
  });

  console.log("\n✅ Different operations completed\n");
}

/**
 * Example 5: Channel-specific use cases
 */
async function demonstrateUseCases() {
  console.log("💡 Channel-Specific Use Cases\n");

  console.log("1. NEW PRODUCT LAUNCH:");
  console.log("   - Sync to B2B first (wholesale customers get priority)");
  console.log("   - Then sync to B2C (retail customers)");
  console.log("   - Index in Solr (make searchable)");
  console.log("   - Finally push to marketplaces\n");

  console.log("2. PRICE UPDATE:");
  console.log("   - Update B2B wholesale prices");
  console.log("   - Update B2C retail prices");
  console.log("   - Sync to marketplaces (eBay, Amazon)");
  console.log("   - Update price feeds (Trovaprezzi)\n");

  console.log("3. INVENTORY SYNC:");
  console.log("   - Real-time sync to B2B/B2C storefronts");
  console.log("   - Batch sync to marketplaces (rate limits)");
  console.log("   - Update Solr stock status\n");

  console.log("4. PRODUCT DISCONTINUATION:");
  console.log("   - Mark as out of stock in B2C");
  console.log("   - Keep available for B2B (clear remaining stock)");
  console.log("   - Remove from marketplaces");
  console.log("   - Keep in Solr but mark as unavailable\n");
}

/**
 * Run all examples
 */
async function main() {
  console.log("=".repeat(70));
  console.log("MULTICHANNEL SYNC EXAMPLE");
  console.log("Channels: eBay, Amazon, ManoMano, Trovaprezzi, B2B, B2C, Solr");
  console.log("=".repeat(70));
  console.log();

  try {
    // Import products
    const entity_codes = await importProducts();

    // Wait for import to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Demonstrate different sync strategies
    await syncToChannelGroups(entity_codes);
    await demonstrateOperations();
    await demonstrateUseCases();

    console.log("=".repeat(70));
    console.log("📋 SUMMARY");
    console.log("=".repeat(70));
    console.log("✓ Imported 3 products with batch tracking");
    console.log("✓ Synced to storefronts (B2B, B2C, Solr)");
    console.log("✓ Synced to Italian marketplaces (Amazon, Trovaprezzi, ManoMano)");
    console.log("✓ Synced to international marketplaces (eBay)");
    console.log("✓ Demonstrated different operations (update, inventory, price)");
    console.log();
    console.log("💡 Key Takeaways:");
    console.log("  - Each channel can be enabled/disabled via .env");
    console.log("  - Sync to specific channels or all at once");
    console.log("  - Different operations for different needs");
    console.log("  - Batch tracking flows through entire system");
    console.log("=".repeat(70));

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Run the example
main();
