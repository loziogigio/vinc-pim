/**
 * Marketplace Sync Worker
 * Processes marketplace sync jobs using the adapter pattern
 */

import { Worker, Job } from 'bullmq';
import { connectToDatabase } from '../db/connection';
import { PIMProductModel } from '../db/models/pim-product';
import { initializeAdapters, MarketplaceAdapter } from '../adapters';
import { SyncJobData, SyncOperation } from '../adapters/types';

/**
 * Global adapters map (initialized once)
 */
let adapters: Map<string, MarketplaceAdapter> | null = null;

/**
 * Sync job result
 */
interface SyncJobResult {
  product_id: string;
  operation: SyncOperation;
  results: Array<{
    channel: string;
    success: boolean;
    status: string;
    message?: string;
    errors?: string[];
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

/**
 * Process a marketplace sync job
 */
async function processSyncJob(job: Job<SyncJobData>): Promise<SyncJobResult> {
  const { product_id, product_ids, tenant_id, operation, channels, options, language, productCount } = job.data;

  console.log(`\n🔄 Processing sync job: ${job.id}`);
  console.log(`   Product${product_ids ? 's' : ''}: ${product_ids ? `${product_ids.length} products` : product_id}`);
  console.log(`   Operation: ${operation}`);
  console.log(`   Channels: ${channels.join(', ')}`);

  // Connect to database
  await connectToDatabase();

  // Handle bulk language indexing operation specially
  if (operation === 'bulk-index-language' && language) {
    console.log(`\n🔍 Bulk indexing products for language: ${language}`);
    console.log(`   Estimated products: ${productCount || 'unknown'}`);

    // Initialize adapters if not already done
    if (!adapters) {
      console.log('📦 Initializing marketplace adapters...');
      adapters = await initializeAdapters();
      console.log(`✓ Initialized ${adapters.size} adapters`);
    }

    const solrAdapter = adapters.get('solr');
    if (!solrAdapter) {
      throw new Error('Solr adapter not available');
    }

    // Fetch products with content in this language
    const products = await PIMProductModel.find({
      isCurrent: true,
      $or: [
        { [`name.${language}`]: { $exists: true, $ne: "" } },
        { [`description.${language}`]: { $exists: true, $ne: "" } },
        { [`features.${language}`]: { $exists: true, $ne: [] } },
      ]
    }).limit(1000); // Process in batches of 1000

    console.log(`📊 Found ${products.length} products with ${language.toUpperCase()} content`);

    let successCount = 0;
    let failCount = 0;

    // Index each product
    for (let i = 0; i < products.length; i++) {
      const product = products[i];

      try {
        await solrAdapter.syncProduct(product as any, { language });
        successCount++;

        // Update progress every 10 products
        if ((i + 1) % 10 === 0) {
          const progress = Math.round(((i + 1) / products.length) * 100);
          await job.updateProgress(progress);
          console.log(`  Progress: ${i + 1}/${products.length} (${progress}%)`);
        }
      } catch (error: any) {
        console.error(`  ✗ Failed to index ${product.entity_code}:`, error.message);
        failCount++;
      }
    }

    console.log(`✅ Bulk indexing completed for ${language}`);
    console.log(`   Successful: ${successCount}/${products.length}`);
    console.log(`   Failed: ${failCount}/${products.length}`);

    return {
      product_id: `bulk-${language}`,
      operation: 'bulk-index-language',
      results: [{
        channel: 'solr',
        success: true,
        status: 'completed',
        message: `Indexed ${successCount} products for ${language.toUpperCase()}`,
      }],
      summary: {
        total: 1,
        successful: 1,
        failed: 0,
      },
    };
  }

  // Handle bulk sync operation (batch multiple products)
  if (operation === 'bulk-sync' && product_ids && product_ids.length > 0) {
    console.log(`\n📦 Bulk syncing ${product_ids.length} products`);

    // Initialize adapters if not already done
    if (!adapters) {
      console.log('📦 Initializing marketplace adapters...');
      adapters = await initializeAdapters();
      console.log(`✓ Initialized ${adapters.size} adapters`);
    }

    // Fetch all products
    const products = await PIMProductModel.find({
      entity_code: { $in: product_ids },
      isCurrent: true,
    });

    console.log(`📊 Found ${products.length}/${product_ids.length} products in database`);

    const results: SyncJobResult['results'] = [];

    // Sync to each channel
    for (const channel of channels) {
      const adapter = adapters.get(channel);

      if (!adapter) {
        console.warn(`⚠️  Adapter not found or disabled: ${channel}`);
        results.push({
          channel,
          success: false,
          status: 'error',
          message: `Adapter not available: ${channel}`,
        });
        continue;
      }

      try {
        console.log(`  → Bulk syncing to ${adapter.name}...`);

        // Use bulk indexing for Solr
        if (channel === 'solr' && 'bulkIndexProducts' in adapter) {
          const bulkResult = await (adapter as any).bulkIndexProducts(products, options);

          console.log(`  ✓ ${adapter.name}: ${bulkResult.success}/${products.length} successful`);

          results.push({
            channel,
            success: bulkResult.success === products.length,
            status: bulkResult.success === products.length ? 'active' : 'error',
            message: `Bulk indexed ${bulkResult.success} products`,
            errors: bulkResult.errors,
          });
        } else {
          // For other channels, sync one by one
          let successCount = 0;
          const errors: string[] = [];

          for (const product of products) {
            try {
              const result = await adapter.syncProduct(product as any, options);
              if (result.success) successCount++;
              else errors.push(`${product.entity_code}: ${result.message}`);
            } catch (error: any) {
              errors.push(`${product.entity_code}: ${error.message}`);
            }
          }

          console.log(`  ✓ ${adapter.name}: ${successCount}/${products.length} successful`);

          results.push({
            channel,
            success: successCount === products.length,
            status: successCount === products.length ? 'active' : 'error',
            message: `Synced ${successCount}/${products.length} products`,
            errors: errors.length > 0 ? errors : undefined,
          });
        }

      } catch (error: any) {
        console.error(`  ✗ ${adapter.name}: ${error.message}`);

        results.push({
          channel,
          success: false,
          status: 'error',
          message: error.message,
          errors: [error.message],
        });
      }
    }

    // Calculate summary
    const summary = {
      total: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    };

    console.log(`✅ Bulk sync completed:`);
    console.log(`   Successful: ${summary.successful}/${summary.total} channels`);
    console.log(`   Failed: ${summary.failed}/${summary.total} channels`);

    return {
      product_id: `bulk-${product_ids.length}`,
      operation: 'bulk-sync',
      results,
      summary,
    };
  }

  // Initialize adapters if not already done
  if (!adapters) {
    console.log('📦 Initializing marketplace adapters...');
    adapters = await initializeAdapters();
    console.log(`✓ Initialized ${adapters.size} adapters`);
  }

  const results: SyncJobResult['results'] = [];

  try {
    // Fetch product from database
    let product = null;

    if (operation !== 'delete') {
      product = await PIMProductModel.findOne({
        entity_code: product_id,
        isCurrent: true,
      });

      if (!product) {
        throw new Error(`Product not found: ${product_id}`);
      }
    }

    // Process each channel
    for (const channel of channels) {
      const adapter = adapters.get(channel);

      if (!adapter) {
        console.warn(`⚠️  Adapter not found or disabled: ${channel}`);
        results.push({
          channel,
          success: false,
          status: 'error',
          message: `Adapter not available: ${channel}`,
        });
        continue;
      }

      try {
        console.log(`  → Syncing to ${adapter.name}...`);

        let result;

        // Execute operation based on type
        switch (operation) {
          case 'create':
          case 'update':
            if (!product) throw new Error('Product data required for create/update');
            result = await adapter.syncProduct(product as any, options);
            break;

          case 'delete':
            result = await adapter.deleteProduct(product_id);
            break;

          case 'inventory':
            if (!product) throw new Error('Product data required for inventory sync');
            result = await adapter.syncInventory(
              product.sku || product_id,
              product.stock_quantity || 0
            );
            break;

          case 'price':
            if (!product) throw new Error('Product data required for price sync');
            result = await adapter.syncPrice(
              product.sku || product_id,
              product.price || 0
            );
            break;

          default:
            throw new Error(`Unknown operation: ${operation}`);
        }

        // Log result
        if (result.success) {
          console.log(`  ✓ ${adapter.name}: ${result.message || 'Success'}`);
        } else {
          console.error(`  ✗ ${adapter.name}: ${result.message || 'Failed'}`);
        }

        results.push({
          channel,
          success: result.success,
          status: result.status,
          message: result.message,
          errors: result.errors,
        });

      } catch (error: any) {
        console.error(`  ✗ ${adapter.name}: ${error.message}`);

        // Handle rate limiting - re-queue job for later
        if (error.status === 429 || error.message?.includes('rate limit')) {
          console.warn(`  ⏸️  Rate limited on ${channel}, will retry...`);

          // Calculate delay based on rate limit info
          const rateLimitInfo = adapter.getRateLimitInfo();
          const delay = rateLimitInfo?.retryAfter
            ? rateLimitInfo.retryAfter * 1000
            : 60000; // Default 1 minute

          // Update job data to retry only this channel
          throw new Error(`RATE_LIMIT:${channel}:${delay}`);
        }

        results.push({
          channel,
          success: false,
          status: 'error',
          message: error.message,
          errors: [error.message],
        });
      }

      // Small delay between channels to avoid overwhelming
      await sleep(1000);
    }

    // Calculate summary
    const summary = {
      total: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    };

    console.log(`✅ Sync completed:`);
    console.log(`   Successful: ${summary.successful}/${summary.total}`);
    console.log(`   Failed: ${summary.failed}/${summary.total}`);

    return {
      product_id,
      operation,
      results,
      summary,
    };

  } catch (error: any) {
    console.error(`❌ Sync job failed:`, error.message);

    // Check if it's a rate limit error
    if (error.message?.startsWith('RATE_LIMIT:')) {
      const [, channel, delay] = error.message.split(':');

      // Re-throw to trigger BullMQ retry with delay
      throw new Error(`Rate limited on ${channel}, retry in ${delay}ms`);
    }

    throw error;
  }
}

/**
 * Create and export the sync worker
 */
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

// Worker configuration
const WORKER_CONCURRENCY = parseInt(process.env.SYNC_WORKER_CONCURRENCY || '2');
const RATE_LIMIT_MAX = parseInt(process.env.SYNC_RATE_LIMIT_MAX || '10');
const RATE_LIMIT_DURATION = parseInt(process.env.SYNC_RATE_LIMIT_DURATION_MS || '60000');

console.log(`🔧 Sync Worker Configuration:`);
console.log(`   Concurrency: ${WORKER_CONCURRENCY} jobs`);
console.log(`   Rate Limit: ${RATE_LIMIT_MAX} jobs per ${RATE_LIMIT_DURATION / 1000}s`);

export const syncWorker = new Worker('sync-queue', processSyncJob, {
  connection: {
    host: REDIS_HOST,
    port: REDIS_PORT,
  },
  concurrency: WORKER_CONCURRENCY,
  limiter: {
    max: RATE_LIMIT_MAX,
    duration: RATE_LIMIT_DURATION,
  },
});

// Event listeners
syncWorker.on('completed', (job, result) => {
  console.log(`✓ Sync job ${job.id} completed`);
  console.log(`  Summary: ${result.summary.successful}/${result.summary.total} successful`);
});

syncWorker.on('failed', (job, err) => {
  console.error(`✗ Sync job ${job?.id} failed:`, err.message);

  // Check if we should retry
  if (err.message?.includes('Rate limited')) {
    console.log(`  ⏸️  Will retry when rate limit resets`);
  }
});

syncWorker.on('progress', (job, progress) => {
  console.log(`Sync job ${job.id}: ${progress}%`);
});

// Helper function
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
