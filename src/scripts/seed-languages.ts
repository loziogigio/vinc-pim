/**
 * Seed Languages Script
 * Populates database with initial language configuration
 *
 * Usage:
 *   npx tsx src/scripts/seed-languages.ts --tenant dfl-eventi-it
 *   npx tsx src/scripts/seed-languages.ts --tenant hidros-it
 */

import { connectToDatabase } from "../lib/db/connection";
import { LanguageModel } from "../lib/db/models/language";

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

const initialLanguages = [
  // ========== Currently enabled languages ==========
  {
    code: "it",
    name: "Italian",
    nativeName: "Italiano",
    flag: "🇮🇹",
    isDefault: true,
    isEnabled: true,
    searchEnabled: true, // Search indexing enabled
    solrAnalyzer: "text_it",
    direction: "ltr" as const,
    dateFormat: "DD/MM/YYYY",
    numberFormat: "it-IT",
    order: 1,
  },

  // ========== Other European languages (disabled by default) ==========
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_de", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "de-DE", order: 2 },
  { code: "en", name: "English", nativeName: "English", flag: "🇬🇧", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_en", direction: "ltr" as const, dateFormat: "MM/DD/YYYY", numberFormat: "en-US", order: 3 },
  { code: "cs", name: "Czech", nativeName: "Čeština", flag: "🇨🇿", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "cs-CZ", order: 4 },

  // ========== Additional Western European languages (disabled by default) ==========
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_fr", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "fr-FR", order: 5 },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_es", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "es-ES", order: 6 },
  { code: "pt", name: "Portuguese", nativeName: "Português", flag: "🇵🇹", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_pt", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "pt-PT", order: 7 },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", flag: "🇳🇱", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_nl", direction: "ltr" as const, dateFormat: "DD-MM-YYYY", numberFormat: "nl-NL", order: 8 },
  { code: "ca", name: "Catalan", nativeName: "Català", flag: "🇪🇸", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_ca", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "ca-ES", order: 9 },

  // ========== Nordic languages ==========
  { code: "sv", name: "Swedish", nativeName: "Svenska", flag: "🇸🇪", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_sv", direction: "ltr" as const, dateFormat: "YYYY-MM-DD", numberFormat: "sv-SE", order: 10 },
  { code: "da", name: "Danish", nativeName: "Dansk", flag: "🇩🇰", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_da", direction: "ltr" as const, dateFormat: "DD-MM-YYYY", numberFormat: "da-DK", order: 11 },
  { code: "fi", name: "Finnish", nativeName: "Suomi", flag: "🇫🇮", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_fi", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "fi-FI", order: 12 },
  { code: "no", name: "Norwegian", nativeName: "Norsk", flag: "🇳🇴", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_no", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "nb-NO", order: 13 },
  { code: "is", name: "Icelandic", nativeName: "Íslenska", flag: "🇮🇸", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "is-IS", order: 14 },

  // ========== Central/Eastern European languages ==========
  { code: "pl", name: "Polish", nativeName: "Polski", flag: "🇵🇱", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "pl-PL", order: 15 },
  { code: "hu", name: "Hungarian", nativeName: "Magyar", flag: "🇭🇺", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_hu", direction: "ltr" as const, dateFormat: "YYYY.MM.DD", numberFormat: "hu-HU", order: 16 },
  { code: "ro", name: "Romanian", nativeName: "Română", flag: "🇷🇴", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_ro", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "ro-RO", order: 17 },
  { code: "sk", name: "Slovak", nativeName: "Slovenčina", flag: "🇸🇰", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "sk-SK", order: 18 },
  { code: "sl", name: "Slovenian", nativeName: "Slovenščina", flag: "🇸🇮", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "sl-SI", order: 19 },
  { code: "hr", name: "Croatian", nativeName: "Hrvatski", flag: "🇭🇷", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "hr-HR", order: 20 },
  { code: "sr", name: "Serbian", nativeName: "Српски", flag: "🇷🇸", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "sr-RS", order: 21 },
  { code: "bg", name: "Bulgarian", nativeName: "Български", flag: "🇧🇬", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_bg", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "bg-BG", order: 22 },
  { code: "mk", name: "Macedonian", nativeName: "Македонски", flag: "🇲🇰", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "mk-MK", order: 23 },
  { code: "sq", name: "Albanian", nativeName: "Shqip", flag: "🇦🇱", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "sq-AL", order: 24 },

  // ========== Baltic languages ==========
  { code: "et", name: "Estonian", nativeName: "Eesti", flag: "🇪🇪", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "et-EE", order: 25 },
  { code: "lv", name: "Latvian", nativeName: "Latviešu", flag: "🇱🇻", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_lv", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "lv-LV", order: 26 },
  { code: "lt", name: "Lithuanian", nativeName: "Lietuvių", flag: "🇱🇹", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "YYYY-MM-DD", numberFormat: "lt-LT", order: 27 },

  // ========== Other European languages ==========
  { code: "el", name: "Greek", nativeName: "Ελληνικά", flag: "🇬🇷", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_el", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "el-GR", order: 28 },
  { code: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_ru", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "ru-RU", order: 29 },
  { code: "uk", name: "Ukrainian", nativeName: "Українська", flag: "🇺🇦", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "uk-UA", order: 30 },
  { code: "be", name: "Belarusian", nativeName: "Беларуская", flag: "🇧🇾", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "be-BY", order: 31 },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", flag: "🇹🇷", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_tr", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "tr-TR", order: 32 },

  // ========== Middle Eastern/RTL languages ==========
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_ar", direction: "rtl" as const, dateFormat: "DD/MM/YYYY", numberFormat: "ar-SA", order: 33 },
  { code: "he", name: "Hebrew", nativeName: "עברית", flag: "🇮🇱", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "rtl" as const, dateFormat: "DD/MM/YYYY", numberFormat: "he-IL", order: 34 },
  { code: "fa", name: "Persian", nativeName: "فارسی", flag: "🇮🇷", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_fa", direction: "rtl" as const, dateFormat: "YYYY/MM/DD", numberFormat: "fa-IR", order: 35 },

  // ========== Asian languages ==========
  { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_ja", direction: "ltr" as const, dateFormat: "YYYY/MM/DD", numberFormat: "ja-JP", order: 36 },
  { code: "zh", name: "Chinese (Simplified)", nativeName: "简体中文", flag: "🇨🇳", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_cjk", direction: "ltr" as const, dateFormat: "YYYY-MM-DD", numberFormat: "zh-CN", order: 37 },
  { code: "ko", name: "Korean", nativeName: "한국어", flag: "🇰🇷", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_cjk", direction: "ltr" as const, dateFormat: "YYYY-MM-DD", numberFormat: "ko-KR", order: 38 },
  { code: "th", name: "Thai", nativeName: "ไทย", flag: "🇹🇭", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_th", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "th-TH", order: 39 },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", flag: "🇻🇳", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "vi-VN", order: 40 },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", flag: "🇮🇩", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_id", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "id-ID", order: 41 },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu", flag: "🇲🇾", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "ms-MY", order: 42 },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_hi", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "hi-IN", order: 43 },
];

async function seedLanguages() {
  try {
    const { tenant } = parseArgs();

    if (!tenant) {
      console.log('\n❌ Error: --tenant parameter is required');
      console.log('\nUsage:');
      console.log('  npx tsx src/scripts/seed-languages.ts --tenant dfl-eventi-it');
      console.log('  npx tsx src/scripts/seed-languages.ts --tenant hidros-it');
      process.exit(1);
    }

    const tenantDb = `vinc-${tenant}`;
    console.log(`\n🌍 Seeding Languages`);
    console.log(`🎯 Target tenant: ${tenant} (database: ${tenantDb})\n`);

    // Connect to MongoDB
    await connectToDatabase(tenantDb);
    console.log("✅ Connected to MongoDB\n");

    // Check if languages already exist
    const existingCount = await LanguageModel.countDocuments();

    if (existingCount > 0) {
      console.log(`\n⚠️  Database already contains ${existingCount} language(s)`);
      console.log("Do you want to:");
      console.log("  1. Skip seeding (keep existing)");
      console.log("  2. Add missing languages only");
      console.log("  3. Clear all and reseed");

      // For now, we'll just skip if exists
      console.log("\nSkipping seed (languages already exist)");
      console.log("To force reseed, delete languages from DB first");
      return;
    }

    // Seed languages
    console.log("\nSeeding languages...");

    for (const lang of initialLanguages) {
      const existing = await LanguageModel.findOne({ code: lang.code });

      if (existing) {
        console.log(`  ✓ ${lang.code} (${lang.name}) - already exists`);
      } else {
        await LanguageModel.create(lang);
        console.log(`  ✅ ${lang.code} (${lang.name}) - created`);
      }
    }

    console.log(`\n✅ Language seeding complete for tenant: ${tenant}!`);
    console.log(`\nTotal languages: ${await LanguageModel.countDocuments()}`);
    console.log(`Enabled: ${await LanguageModel.countDocuments({ isEnabled: true })}`);
    console.log(`Default: ${(await LanguageModel.findOne({ isDefault: true }))?.code || "none"}`);

  } catch (error) {
    console.error("❌ Error seeding languages:", error);
    throw error;
  }
}

export { seedLanguages };

// Run if called directly
seedLanguages()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
