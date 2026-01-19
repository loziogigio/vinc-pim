/**
 * Fix double-nested language fields in PIM products
 *
 * Fixes products with structure like:
 *   name: { it: { it: "Product Name" } }
 *
 * To correct structure:
 *   name: { it: "Product Name" }
 *
 * Usage:
 *   npx tsx scripts/fix-double-nested-lang.ts --tenant dfl-eventi-it
 *   npx tsx scripts/fix-double-nested-lang.ts --tenant hidros-it --dry-run
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { PIMProductModel } from "../src/lib/db/models/pim-product";

/**
 * Parse command line arguments
 */
function parseArgs(): { tenant?: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  const tenantIndex = args.indexOf("--tenant");
  const dryRun = args.includes("--dry-run");

  const tenant = tenantIndex >= 0 && args[tenantIndex + 1]
    ? args[tenantIndex + 1]
    : undefined;

  return { tenant, dryRun };
}

/**
 * Check if a value is double-nested (e.g., { it: { it: "value" } })
 */
function isDoubleNested(obj: any): boolean {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return false;
  }

  const keys = Object.keys(obj);
  if (keys.length !== 1) return false;

  const firstKey = keys[0];
  const firstValue = obj[firstKey];

  // Check if value is an object with the same key
  if (typeof firstValue !== 'object' || firstValue === null) {
    return false;
  }

  const innerKeys = Object.keys(firstValue);
  return innerKeys.length === 1 && innerKeys[0] === firstKey;
}

/**
 * Unnest double-nested language structure
 */
function unnest(obj: any): any {
  if (isDoubleNested(obj)) {
    const key = Object.keys(obj)[0];
    return obj[key]; // Return { it: "value" } instead of { it: { it: "value" } }
  }
  return obj;
}

async function fixDoubleNestedLanguages() {
  try {
    const { tenant, dryRun } = parseArgs();

    if (!tenant) {
      console.log('\n❌ Error: --tenant parameter is required');
      console.log('\nUsage:');
      console.log('  npx tsx scripts/fix-double-nested-lang.ts --tenant dfl-eventi-it');
      console.log('  npx tsx scripts/fix-double-nested-lang.ts --tenant hidros-it --dry-run');
      process.exit(1);
    }

    const tenantDb = `vinc-${tenant}`;
    console.log(`\n🔧 Fixing double-nested language fields${dryRun ? ' (DRY RUN)' : ''}`);
    console.log(`🎯 Target tenant: ${tenant} (database: ${tenantDb})\n`);

    await connectToDatabase(tenantDb);

    // Find all current products
    const products = await PIMProductModel.find({ isCurrent: true });
    console.log(`📦 Found ${products.length} products to check\n`);

    let fixed = 0;
    const multilangFields = ['name', 'short_description', 'description'];

    for (const product of products) {
      let needsUpdate = false;
      const updates: any = {};

      for (const field of multilangFields) {
        const value = product[field];
        if (value && isDoubleNested(value)) {
          const unnested = unnest(value);
          updates[field] = unnested;
          needsUpdate = true;

          console.log(`🔍 ${product.entity_code} (${product.sku})`);
          console.log(`   ${field}: ${JSON.stringify(value)} → ${JSON.stringify(unnested)}`);
        }
      }

      if (needsUpdate) {
        if (!dryRun) {
          await PIMProductModel.updateOne(
            { _id: product._id },
            { $set: updates }
          );
          console.log(`   ✅ Fixed\n`);
        } else {
          console.log(`   🔍 Would fix (dry run)\n`);
        }
        fixed++;
      }
    }

    console.log('='.repeat(60));
    if (fixed === 0) {
      console.log(`✅ No products needed fixing`);
    } else {
      console.log(`${dryRun ? '🔍' : '✅'} ${fixed} product${fixed !== 1 ? 's' : ''} ${dryRun ? 'would be' : 'were'} fixed`);
    }
    console.log('='.repeat(60) + '\n');

    if (dryRun) {
      console.log('💡 Remove --dry-run to apply changes');
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

fixDoubleNestedLanguages();
