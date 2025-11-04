/**
 * API Import Example - Node.js/JavaScript
 *
 * This demonstrates how to import products to the PIM system via API
 * instead of uploading CSV/Excel files.
 */

const API_URL = "http://localhost:3000/api/b2b/pim/import/api";

// Example products to import
const importData = {
  source_id: "api-supplier-1",
  products: [
    {
      entity_code: "JS-SKU001",
      sku: "JS-SKU001",
      name: "Smart Watch Pro",
      description: "Advanced fitness tracking smartwatch with heart rate monitor",
      price: 199.99,
      sale_price: 159.99,
      category: "Electronics",
      subcategory: "Wearables",
      brand: "FitTech",
      stock: 75,
      weight: 0.08,
      color: "Black",
      model: "SW-PRO-2024",
      warranty_months: 12,
      features: ["Heart Rate Monitor", "GPS", "Water Resistant", "7 Day Battery"],
      images: ["https://example.com/smartwatch.jpg"]
    },
    {
      entity_code: "JS-SKU002",
      sku: "JS-SKU002",
      name: "Laptop Stand Aluminum",
      description: "Ergonomic aluminum laptop stand with cooling ventilation",
      price: 49.99,
      category: "Electronics",
      subcategory: "Laptop Accessories",
      brand: "DeskPro",
      stock: 150,
      weight: 0.8,
      color: "Silver",
      material: "Aluminum",
      model: "LS-ALU-100",
      warranty_months: 24,
      features: ["Adjustable Height", "Cooling Ventilation", "Non-Slip Base"],
      images: ["https://example.com/laptop-stand.jpg"]
    }
  ]
};

async function testApiImport() {
  console.log("🚀 Testing API Product Import");
  console.log("================================\n");
  console.log(`Importing ${importData.products.length} products to source: ${importData.source_id}\n`);

  try {
    const startTime = Date.now();

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(importData),
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Import failed:");
      console.error(JSON.stringify(errorData, null, 2));
      return;
    }

    const result = await response.json();

    console.log("✅ Import Successful!\n");
    console.log("Job ID:", result.job_id);
    console.log("\nSummary:");
    console.log("  - Total products:", result.summary.total);
    console.log("  - Successful:", result.summary.successful);
    console.log("  - Failed:", result.summary.failed);
    console.log("  - Auto-published:", result.summary.auto_published);
    console.log("  - Duration:", result.summary.duration_seconds + "s");
    console.log("  - API Response Time:", duration + "s\n");

    if (result.errors && result.errors.length > 0) {
      console.log("⚠️  Errors:");
      result.errors.forEach(err => {
        console.log(`  - Row ${err.row} (${err.entity_code}): ${err.error}`);
      });
      console.log("");
    }

    console.log("================================");
    console.log("View results at: http://localhost:3000/b2b/pim/jobs");
    console.log("View products at: http://localhost:3000/b2b/pim/products\n");

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

// Run the test
testApiImport();
