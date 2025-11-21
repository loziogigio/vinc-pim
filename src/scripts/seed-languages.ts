/**
 * Seed Languages Script
 * Populates database with initial language configuration
 *
 * Usage: npx ts-node src/scripts/seed-languages.ts
 */

import { connectToDatabase } from "../lib/db/connection";
import { LanguageModel } from "../lib/db/models/language";

const initialLanguages = [
  // ========== Currently enabled languages ==========
  {
    code: "it",
    name: "Italian",
    nativeName: "Italiano",
    isDefault: true,
    isEnabled: true,
    searchEnabled: true, // Search indexing enabled
    solrAnalyzer: "text_it",
    direction: "ltr" as const,
    dateFormat: "DD/MM/YYYY",
    numberFormat: "it-IT",
    order: 1,
  },
  {
    code: "de",
    name: "German",
    nativeName: "Deutsch",
    isDefault: false,
    isEnabled: true,
    searchEnabled: false, // Data entry enabled, search not yet indexed
    solrAnalyzer: "text_de",
    direction: "ltr" as const,
    dateFormat: "DD.MM.YYYY",
    numberFormat: "de-DE",
    order: 2,
  },
  {
    code: "en",
    name: "English",
    nativeName: "English",
    isDefault: false,
    isEnabled: true,
    searchEnabled: false, // Data entry enabled, search not yet indexed
    solrAnalyzer: "text_en",
    direction: "ltr" as const,
    dateFormat: "MM/DD/YYYY",
    numberFormat: "en-US",
    order: 3,
  },
  {
    code: "cs",
    name: "Czech",
    nativeName: "Čeština",
    isDefault: false,
    isEnabled: true,
    searchEnabled: false, // Data entry enabled, search not yet indexed
    solrAnalyzer: "text_general",
    direction: "ltr" as const,
    dateFormat: "DD.MM.YYYY",
    numberFormat: "cs-CZ",
    order: 4,
  },

  // ========== Additional Western European languages (disabled by default) ==========
  { code: "fr", name: "French", nativeName: "Français", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_fr", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "fr-FR", order: 5 },
  { code: "es", name: "Spanish", nativeName: "Español", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_es", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "es-ES", order: 6 },
  { code: "pt", name: "Portuguese", nativeName: "Português", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_pt", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "pt-PT", order: 7 },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_nl", direction: "ltr" as const, dateFormat: "DD-MM-YYYY", numberFormat: "nl-NL", order: 8 },
  { code: "ca", name: "Catalan", nativeName: "Català", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_ca", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "ca-ES", order: 9 },

  // ========== Nordic languages ==========
  { code: "sv", name: "Swedish", nativeName: "Svenska", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_sv", direction: "ltr" as const, dateFormat: "YYYY-MM-DD", numberFormat: "sv-SE", order: 10 },
  { code: "da", name: "Danish", nativeName: "Dansk", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_da", direction: "ltr" as const, dateFormat: "DD-MM-YYYY", numberFormat: "da-DK", order: 11 },
  { code: "fi", name: "Finnish", nativeName: "Suomi", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_fi", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "fi-FI", order: 12 },
  { code: "no", name: "Norwegian", nativeName: "Norsk", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_no", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "nb-NO", order: 13 },
  { code: "is", name: "Icelandic", nativeName: "Íslenska", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "is-IS", order: 14 },

  // ========== Central/Eastern European languages ==========
  { code: "pl", name: "Polish", nativeName: "Polski", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "pl-PL", order: 15 },
  { code: "hu", name: "Hungarian", nativeName: "Magyar", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_hu", direction: "ltr" as const, dateFormat: "YYYY.MM.DD", numberFormat: "hu-HU", order: 16 },
  { code: "ro", name: "Romanian", nativeName: "Română", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_ro", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "ro-RO", order: 17 },
  { code: "sk", name: "Slovak", nativeName: "Slovenčina", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "sk-SK", order: 18 },
  { code: "sl", name: "Slovenian", nativeName: "Slovenščina", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "sl-SI", order: 19 },
  { code: "hr", name: "Croatian", nativeName: "Hrvatski", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "hr-HR", order: 20 },
  { code: "sr", name: "Serbian", nativeName: "Српски", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "sr-RS", order: 21 },
  { code: "bg", name: "Bulgarian", nativeName: "Български", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_bg", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "bg-BG", order: 22 },
  { code: "mk", name: "Macedonian", nativeName: "Македонски", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "mk-MK", order: 23 },
  { code: "sq", name: "Albanian", nativeName: "Shqip", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "sq-AL", order: 24 },

  // ========== Baltic languages ==========
  { code: "et", name: "Estonian", nativeName: "Eesti", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "et-EE", order: 25 },
  { code: "lv", name: "Latvian", nativeName: "Latviešu", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_lv", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "lv-LV", order: 26 },
  { code: "lt", name: "Lithuanian", nativeName: "Lietuvių", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "YYYY-MM-DD", numberFormat: "lt-LT", order: 27 },

  // ========== Other European languages ==========
  { code: "el", name: "Greek", nativeName: "Ελληνικά", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_el", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "el-GR", order: 28 },
  { code: "ru", name: "Russian", nativeName: "Русский", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_ru", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "ru-RU", order: 29 },
  { code: "uk", name: "Ukrainian", nativeName: "Українська", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "uk-UA", order: 30 },
  { code: "be", name: "Belarusian", nativeName: "Беларуская", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "be-BY", order: 31 },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_tr", direction: "ltr" as const, dateFormat: "DD.MM.YYYY", numberFormat: "tr-TR", order: 32 },

  // ========== Middle Eastern/RTL languages ==========
  { code: "ar", name: "Arabic", nativeName: "العربية", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_ar", direction: "rtl" as const, dateFormat: "DD/MM/YYYY", numberFormat: "ar-SA", order: 33 },
  { code: "he", name: "Hebrew", nativeName: "עברית", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "rtl" as const, dateFormat: "DD/MM/YYYY", numberFormat: "he-IL", order: 34 },
  { code: "fa", name: "Persian", nativeName: "فارسی", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_fa", direction: "rtl" as const, dateFormat: "YYYY/MM/DD", numberFormat: "fa-IR", order: 35 },

  // ========== Asian languages ==========
  { code: "ja", name: "Japanese", nativeName: "日本語", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_ja", direction: "ltr" as const, dateFormat: "YYYY/MM/DD", numberFormat: "ja-JP", order: 36 },
  { code: "zh", name: "Chinese (Simplified)", nativeName: "简体中文", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_cjk", direction: "ltr" as const, dateFormat: "YYYY-MM-DD", numberFormat: "zh-CN", order: 37 },
  { code: "ko", name: "Korean", nativeName: "한국어", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_cjk", direction: "ltr" as const, dateFormat: "YYYY-MM-DD", numberFormat: "ko-KR", order: 38 },
  { code: "th", name: "Thai", nativeName: "ไทย", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_th", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "th-TH", order: 39 },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "vi-VN", order: 40 },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_id", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "id-ID", order: 41 },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_general", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "ms-MY", order: 42 },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", isDefault: false, isEnabled: false, searchEnabled: false, solrAnalyzer: "text_hi", direction: "ltr" as const, dateFormat: "DD/MM/YYYY", numberFormat: "hi-IN", order: 43 },
];

async function seedLanguages() {
  try {
    // Connect to MongoDB
    await connectToDatabase();
    console.log("Connected to MongoDB");

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

    console.log("\n✅ Language seeding complete!");
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
