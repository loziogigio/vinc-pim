/**
 * Bulk Sync Products to Solr
 * Fetches all published products and syncs them directly to Solr
 *
 * Usage:
 *   npx tsx scripts/bulk-sync-to-solr.ts --tenant dfl-eventi-it
 *   npx tsx scripts/bulk-sync-to-solr.ts --tenant hidros-it
 *   npx tsx scripts/bulk-sync-to-solr.ts --tenant hidros-it --limit 50
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { PIMProductModel } from "../src/lib/db/models/pim-product";
import { SolrAdapter, loadAdapterConfigs } from "../src/lib/adapters";

/**
 * Parse command line arguments
 */
function parseArgs(): { tenant?: string; limit?: number } {
  const args = process.argv.slice(2);
  const tenantIndex = args.indexOf('--tenant');
  const limitIndex = args.indexOf('--limit');

  const tenant = tenantIndex >= 0 && args[tenantIndex + 1]
    ? args[tenantIndex + 1]
    : undefined;

  const limit = limitIndex >= 0 && args[limitIndex + 1]
    ? parseInt(args[limitIndex + 1])
    : undefined;

  return { tenant, limit };
}

async function bulkSyncToSolr() {
  try {
    const { tenant, limit } = parseArgs();

    if (!tenant) {
      console.log('\n❌ Error: --tenant parameter is required');
      console.log('\nUsage:');
      console.log('  npx tsx scripts/bulk-sync-to-solr.ts --tenant dfl-eventi-it');
      console.log('  npx tsx scripts/bulk-sync-to-solr.ts --tenant hidros-it');
      console.log('  npx tsx scripts/bulk-sync-to-solr.ts --tenant hidros-it --limit 50');
      process.exit(1);
    }

    const tenantDb = `vinc-${tenant}`;
    console.log(`\n🔄 Bulk Syncing Products to Solr`);
    console.log(`🎯 Target tenant: ${tenant} (database: ${tenantDb})`);
    if (limit) {
      console.log(`📊 Limit: ${limit} products`);
    }
    console.log('');

    await connectToDatabase(tenantDb);

    // Initialize Solr adapter for this tenant
    const adapterConfigs = loadAdapterConfigs(tenant);
    const solrAdapter = new SolrAdapter(adapterConfigs.solr);
    await solrAdapter.initialize();

    console.log(`🔍 Solr core: ${adapterConfigs.solr.custom_config?.solr_core}\n`);

    // Find all published products
    let query = PIMProductModel.find({
      isCurrent: true,
      status: 'published'
    }).select('entity_code sku name');

    if (limit) {
      query = query.limit(limit);
    }

    const products = await query.lean();

    console.log(`📦 Found ${products.length} published products to sync\n`);

    if (products.length === 0) {
      console.log('ℹ️  No published products to sync');
      process.exit(0);
    }

    let synced = 0;
    let failed = 0;
    const errors: Array<{ entity_code: string; error: string }> = [];

    // Sync each product
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const entityCode = product.entity_code;
      const displayName = product.name?.it || product.sku;
      const progress = `[${i + 1}/${products.length}]`;

      process.stdout.write(`${progress} 🔄 Syncing ${entityCode} (${displayName})...`);

      try {
        // Get full product data for sync
        const fullProduct: any = await PIMProductModel.findOne({
          entity_code: entityCode,
          isCurrent: true
        }).lean();

        if (!fullProduct) {
          failed++;
          console.log(' ❌ Product not found');
          errors.push({ entity_code: entityCode, error: 'Product not found' });
          continue;
        }

        // Sync to Solr
        const result = await solrAdapter.syncProduct(fullProduct);

        if (result.success) {
          synced++;
          console.log(' ✅');

          // Update last_synced_at timestamp
          await PIMProductModel.updateOne(
            { _id: fullProduct._id },
            {
              $set: {
                "analytics.last_synced_at": new Date(),
              },
            }
          );
        } else {
          failed++;
          const errorMsg = result.message || 'Unknown error';
          console.log(` ❌ ${errorMsg}`);
          errors.push({ entity_code: entityCode, error: errorMsg });
        }
      } catch (error: any) {
        failed++;
        console.log(` ❌ ${error.message}`);
        errors.push({ entity_code: entityCode, error: error.message });
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully synced: ${synced}/${products.length}`);
    if (failed > 0) {
      console.log(`❌ Failed: ${failed}/${products.length}`);
      console.log('\nErrors:');
      errors.forEach(({ entity_code, error }) => {
        console.log(`  - ${entity_code}: ${error}`);
      });
    }
    console.log('='.repeat(60) + '\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

bulkSyncToSolr();
