import { connectToDatabase } from "../src/lib/db/connection";
import { PIMProductModel } from "../src/lib/db/models/pim-product";

async function debug() {
  await connectToDatabase();

  const product = await PIMProductModel.findOne({ entity_code: "TEST-001" }).lean();

  console.log("📦 Complete Product Document:");
  console.log(JSON.stringify(product, null, 2));

  process.exit(0);
}

debug();
