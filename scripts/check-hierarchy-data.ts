#!/usr/bin/env tsx
/**
 * Check hierarchy data in MongoDB
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { PIMProductModel } from "../src/lib/db/models/pim-product";

async function checkHierarchy() {
  try {
    await connectToDatabase();

    const product = await PIMProductModel.findOne(
      { entity_code: "DRILL-BOSCH-001" }
    ).lean();

    if (!product) {
      console.log("Product not found");
      process.exit(1);
    }

    console.log("\n📊 Category Hierarchy:");
    console.log(JSON.stringify(product.category, null, 2));

    console.log("\n📊 Brand Hierarchy:");
    console.log(JSON.stringify(product.brand, null, 2));

    console.log("\n📊 Product Type Hierarchy:");
    console.log(JSON.stringify(product.product_type, null, 2));

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkHierarchy();
