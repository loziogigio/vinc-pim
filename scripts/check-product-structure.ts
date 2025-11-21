/**
 * Check Product Structure - Inspect how data is stored
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { PIMProductModel } from "../src/lib/db/models/pim-product";

async function checkProductStructure() {
  try {
    await connectToDatabase();

    const product = await PIMProductModel.findOne({
      entity_code: "FULL-001",
      isCurrent: true,
    });

    if (!product) {
      console.log("❌ Product not found");
      process.exit(1);
    }

    console.log("📦 Product Structure for FULL-001:\n");
    console.log("Specifications type:", typeof product.specifications);
    console.log("Specifications value:", product.specifications);
    console.log("\nAttributes type:", typeof product.attributes);
    console.log("Attributes value:", product.attributes);
    console.log("\nFeatures type:", typeof product.features);
    console.log("Features value:", product.features);

    process.exit(0);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

checkProductStructure();
