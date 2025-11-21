import { connectToDatabase } from "../src/lib/db/connection";
import { PIMProductModel } from "../src/lib/db/models/pim-product";

async function check() {
  await connectToDatabase();

  const batch_id = process.argv[2] || "batch_test_1763722940427";
  const product = await PIMProductModel.findOne({
    "source.batch_id": batch_id
  }).lean();

  console.log("📦 Full Product Source:");
  console.log(JSON.stringify(product?.source, null, 2));

  console.log("\n📦 Sample Product Fields:");
  console.log("Entity Code:", product?.entity_code);
  console.log("SKU:", product?.sku);
  console.log("Name:", product?.name);
  console.log("Price:", product?.price);
  console.log("Currency:", product?.currency);
  console.log("Stock:", product?.stock_quantity);

  process.exit(0);
}

check();
