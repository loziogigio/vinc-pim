import { connectToDatabase } from "../src/lib/db/connection";
import { LanguageModel } from "../src/lib/db/models/language";

async function enable() {
  await connectToDatabase();

  console.log("Before update:");
  let lang = await LanguageModel.findOne({ code: "it" });
  console.log("  searchEnabled:", lang?.searchEnabled);

  // Update using findOneAndUpdate
  const updated = await LanguageModel.findOneAndUpdate(
    { code: "it" },
    { $set: { searchEnabled: true } },
    { new: true }
  );

  console.log("\nAfter update:");
  console.log("  searchEnabled:", updated?.searchEnabled);
  console.log("  updated_at:", updated?.updated_at);

  // Verify by reading again
  lang = await LanguageModel.findOne({ code: "it" });
  console.log("\nVerify read:");
  console.log("  searchEnabled:", lang?.searchEnabled);

  process.exit(0);
}

enable();
