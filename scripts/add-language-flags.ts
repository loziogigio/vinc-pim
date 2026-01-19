/**
 * Migration Script: Add Flag Emojis to Languages
 * Usage:
 *   npx tsx scripts/add-language-flags.ts --tenant dfl-eventi-it
 *   npx tsx scripts/add-language-flags.ts --tenant hidros-it
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { LanguageModel } from "../src/lib/db/models/language";

/**
 * Parse command line arguments
 */
function parseArgs(): { tenant?: string } {
  const args = process.argv.slice(2);
  const tenantIndex = args.indexOf('--tenant');

  if (tenantIndex >= 0 && args[tenantIndex + 1]) {
    return { tenant: args[tenantIndex + 1] };
  }

  return {};
}

// Map of ISO 639-1 language codes to flag emojis
const languageFlags: Record<string, string> = {
  // European Languages
  it: "🇮🇹", // Italian
  en: "🇬🇧", // English
  de: "🇩🇪", // German
  fr: "🇫🇷", // French
  es: "🇪🇸", // Spanish
  pt: "🇵🇹", // Portuguese
  nl: "🇳🇱", // Dutch
  pl: "🇵🇱", // Polish
  cs: "🇨🇿", // Czech
  sk: "🇸🇰", // Slovak
  hu: "🇭🇺", // Hungarian
  ro: "🇷🇴", // Romanian
  bg: "🇧🇬", // Bulgarian
  hr: "🇭🇷", // Croatian
  sl: "🇸🇮", // Slovenian
  sr: "🇷🇸", // Serbian
  uk: "🇺🇦", // Ukrainian
  ru: "🇷🇺", // Russian
  el: "🇬🇷", // Greek
  da: "🇩🇰", // Danish
  sv: "🇸🇪", // Swedish
  no: "🇳🇴", // Norwegian
  fi: "🇫🇮", // Finnish
  et: "🇪🇪", // Estonian
  lv: "🇱🇻", // Latvian
  lt: "🇱🇹", // Lithuanian

  // Asian Languages
  zh: "🇨🇳", // Chinese
  ja: "🇯🇵", // Japanese
  ko: "🇰🇷", // Korean
  th: "🇹🇭", // Thai
  vi: "🇻🇳", // Vietnamese
  id: "🇮🇩", // Indonesian
  ms: "🇲🇾", // Malay

  // Middle Eastern Languages
  ar: "🇸🇦", // Arabic
  he: "🇮🇱", // Hebrew
  tr: "🇹🇷", // Turkish
  fa: "🇮🇷", // Persian

  // Other Languages
  hi: "🇮🇳", // Hindi
  bn: "🇧🇩", // Bengali
  ur: "🇵🇰", // Urdu
  sw: "🇰🇪", // Swahili
};

async function addLanguageFlags() {
  try {
    const { tenant } = parseArgs();

    if (!tenant) {
      console.log('\n❌ Error: --tenant parameter is required');
      console.log('\nUsage:');
      console.log('  npx tsx scripts/add-language-flags.ts --tenant dfl-eventi-it');
      console.log('  npx tsx scripts/add-language-flags.ts --tenant hidros-it');
      process.exit(1);
    }

    const tenantDb = `vinc-${tenant}`;
    console.log(`\n🚩 Adding Language Flags`);
    console.log(`🎯 Target tenant: ${tenant} (database: ${tenantDb})\n`);

    console.log("🔌 Connecting to database...");
    await connectToDatabase(tenantDb);

    console.log("📝 Fetching all languages...");
    const languages = await LanguageModel.find({});
    console.log(`Found ${languages.length} languages`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const language of languages) {
      const flag = languageFlags[language.code];

      if (flag) {
        if (language.flag !== flag) {
          language.flag = flag;
          await language.save();
          console.log(`✅ Updated ${language.code} (${language.name}) with flag ${flag}`);
          updatedCount++;
        } else {
          console.log(`⏭️  Skipped ${language.code} (${language.name}) - flag already set`);
          skippedCount++;
        }
      } else {
        console.log(`⚠️  No flag mapping for ${language.code} (${language.name})`);
        skippedCount++;
      }
    }

    console.log("\n✨ Migration completed!");
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(`   Total: ${languages.length}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

addLanguageFlags();
