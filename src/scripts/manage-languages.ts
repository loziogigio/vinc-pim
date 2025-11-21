/**
 * Language Management CLI
 * Easily enable/disable languages for the PIM system
 *
 * Usage:
 *   npx ts-node src/scripts/manage-languages.ts list
 *   npx ts-node src/scripts/manage-languages.ts enable fr es pt
 *   npx ts-node src/scripts/manage-languages.ts disable fr
 *   npx ts-node src/scripts/manage-languages.ts set-default de
 */

import mongoose from "mongoose";
import { LanguageModel } from "../lib/db/models/language";
import { addLanguageFieldsToSolr, removeLanguageFieldsFromSolr } from "../services/solr-schema.service";

async function listLanguages() {
  const languages = await LanguageModel.find().sort({ order: 1 });

  console.log("\n📋 Available Languages:\n");
  console.log("─".repeat(80));
  console.log(
    "Code".padEnd(6) +
    "Name".padEnd(25) +
    "Native Name".padEnd(20) +
    "Status".padEnd(15) +
    "Default"
  );
  console.log("─".repeat(80));

  languages.forEach(lang => {
    const status = lang.isEnabled ? "✅ Enabled" : "⭕ Disabled";
    const isDefault = lang.isDefault ? "⭐" : "";

    console.log(
      lang.code.padEnd(6) +
      lang.name.padEnd(25) +
      lang.nativeName.padEnd(20) +
      status.padEnd(15) +
      isDefault
    );
  });

  console.log("─".repeat(80));
  console.log(`\nTotal: ${languages.length} languages`);
  console.log(`Enabled: ${languages.filter(l => l.isEnabled).length}`);
  console.log(`Default: ${languages.find(l => l.isDefault)?.code || "none"}\n`);
}

async function enableLanguages(codes: string[], updateSolr: boolean = true) {
  console.log(`\n🔓 Enabling languages: ${codes.join(", ")}\n`);

  const enabledLanguages = [];

  for (const code of codes) {
    const lang = await LanguageModel.findOne({ code });

    if (!lang) {
      console.log(`❌ Language '${code}' not found`);
      continue;
    }

    if (lang.isEnabled) {
      console.log(`ℹ️  ${code} (${lang.name}) - already enabled`);
    } else {
      await LanguageModel.updateOne(
        { code },
        { $set: { isEnabled: true } }
      );
      console.log(`✅ ${code} (${lang.name}) - enabled in database`);
      enabledLanguages.push(lang);
    }
  }

  // Update Solr schema for newly enabled languages
  if (updateSolr && enabledLanguages.length > 0) {
    console.log("\n🔧 Updating Solr schema...");
    for (const lang of enabledLanguages) {
      try {
        await addLanguageFieldsToSolr(lang);
      } catch (error: any) {
        console.error(`❌ Failed to update Solr for '${lang.code}':`, error.message);
        console.log("You may need to update Solr schema manually");
      }
    }
  }

  console.log("\n✅ Languages enabled! No restart needed - changes are live immediately.\n");
}

async function disableLanguages(codes: string[], updateSolr: boolean = false) {
  console.log(`\n🔒 Disabling languages: ${codes.join(", ")}\n`);

  const disabledLanguages = [];

  for (const code of codes) {
    const lang = await LanguageModel.findOne({ code });

    if (!lang) {
      console.log(`❌ Language '${code}' not found`);
      continue;
    }

    if (lang.isDefault) {
      console.log(`❌ ${code} (${lang.name}) - cannot disable default language`);
      continue;
    }

    if (!lang.isEnabled) {
      console.log(`ℹ️  ${code} (${lang.name}) - already disabled`);
    } else {
      await LanguageModel.updateOne(
        { code },
        { $set: { isEnabled: false } }
      );
      console.log(`✅ ${code} (${lang.name}) - disabled in database`);
      disabledLanguages.push(lang);
    }
  }

  // Note: We don't automatically remove Solr fields when disabling
  // because they may contain data. Admin should handle this manually.
  if (updateSolr && disabledLanguages.length > 0) {
    console.log("\n⚠️  Solr schema not modified (fields may contain data)");
    console.log("To remove fields from Solr, you need to:");
    console.log("1. Backup your data");
    console.log("2. Clear the Solr index");
    console.log("3. Remove the field definitions");
    console.log("4. Reindex without the disabled languages");
  }

  console.log("\n✅ Languages disabled! No restart needed - changes are live immediately.\n");
}

async function setDefaultLanguage(code: string) {
  console.log(`\n⭐ Setting default language to: ${code}\n`);

  const lang = await LanguageModel.findOne({ code });

  if (!lang) {
    console.log(`❌ Language '${code}' not found`);
    return;
  }

  if (!lang.isEnabled) {
    console.log(`❌ Language '${code}' must be enabled before setting as default`);
    return;
  }

  // Remove default from all languages
  await LanguageModel.updateMany(
    { isDefault: true },
    { $set: { isDefault: false } }
  );

  // Set new default
  await LanguageModel.updateOne(
    { code },
    { $set: { isDefault: true } }
  );

  console.log(`✅ ${code} (${lang.name}) set as default language\n`);
}

async function main() {
  try {
    const command = process.argv[2];
    const args = process.argv.slice(3);

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/pim";
    await mongoose.connect(mongoUri);

    switch (command) {
      case "list":
        await listLanguages();
        break;

      case "enable":
        if (args.length === 0) {
          console.log("❌ Please provide language codes to enable");
          console.log("Example: npx ts-node src/scripts/manage-languages.ts enable fr es pt");
          process.exit(1);
        }
        // Check for --skip-solr flag
        const skipSolrEnable = args.includes("--skip-solr");
        const enableCodes = args.filter(a => a !== "--skip-solr");
        await enableLanguages(enableCodes, !skipSolrEnable);
        break;

      case "disable":
        if (args.length === 0) {
          console.log("❌ Please provide language codes to disable");
          console.log("Example: npx ts-node src/scripts/manage-languages.ts disable fr");
          process.exit(1);
        }
        const disableCodes = args.filter(a => a !== "--skip-solr");
        await disableLanguages(disableCodes, false);
        break;

      case "set-default":
        if (args.length !== 1) {
          console.log("❌ Please provide exactly one language code");
          console.log("Example: npx ts-node src/scripts/manage-languages.ts set-default de");
          process.exit(1);
        }
        await setDefaultLanguage(args[0]);
        break;

      default:
        console.log("\n📖 Language Management CLI\n");
        console.log("Usage:");
        console.log("  npx ts-node src/scripts/manage-languages.ts list");
        console.log("  npx ts-node src/scripts/manage-languages.ts enable <code> [<code> ...]");
        console.log("  npx ts-node src/scripts/manage-languages.ts disable <code> [<code> ...]");
        console.log("  npx ts-node src/scripts/manage-languages.ts set-default <code>");
        console.log("\nExamples:");
        console.log("  npx ts-node src/scripts/manage-languages.ts list");
        console.log("  npx ts-node src/scripts/manage-languages.ts enable fr es pt");
        console.log("  npx ts-node src/scripts/manage-languages.ts disable fr");
        console.log("  npx ts-node src/scripts/manage-languages.ts set-default it\n");
    }

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().then(() => process.exit(0));
}

export { listLanguages, enableLanguages, disableLanguages, setDefaultLanguage };
