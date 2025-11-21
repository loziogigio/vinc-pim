import { connectToDatabase } from "../src/lib/db/connection";
import { LanguageModel } from "../src/lib/db/models/language";

async function check() {
  await connectToDatabase();
  const lang = await LanguageModel.findOne({ code: "it" });
  console.log("Italian language in DB:", {
    code: lang?.code,
    name: lang?.name,
    isEnabled: lang?.isEnabled,
    searchEnabled: lang?.searchEnabled,
    updated_at: lang?.updated_at
  });
  process.exit(0);
}

check();
