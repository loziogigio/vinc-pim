/**
 * Marketplace Sync Helper
 * Convenient functions to trigger marketplace synchronization
 */

import { syncQueue } from '../queue/queues';
import { SyncJobData, SyncOperation } from '../adapters/types';

/**
 * Sync a product to all enabled marketplaces
 */
export async function syncProductToMarketplaces(
  productId: string,
  options?: {
    tenantId?: string;
    channels?: string[]; // Specific channels, or all if not provided
    operation?: SyncOperation;
    priority?: 'low' | 'normal' | 'high';
  }
) {
  const jobData: SyncJobData = {
    product_id: productId,
    tenant_id: options?.tenantId || process.env.VINC_TENANT_ID || 'default',
    operation: options?.operation || 'update',
    channels: options?.channels || getEnabledChannels(),
    priority: options?.priority || 'normal',
  };

  const job = await syncQueue.add('sync-product', jobData, {
    priority: getPriorityValue(options?.priority),
  });

  console.log(`📤 Queued sync job ${job.id} for product ${productId}`);
  console.log(`   Channels: ${jobData.channels.join(', ')}`);

  return job;
}

/**
 * Sync only to Solr (for fast search indexing)
 */
export async function syncProductToSolr(productId: string) {
  return syncProductToMarketplaces(productId, {
    channels: ['solr'],
    operation: 'update',
    priority: 'high', // Search indexing is high priority
  });
}

/**
 * Sync inventory/stock to all marketplaces
 */
export async function syncInventoryToMarketplaces(
  productId: string,
  channels?: string[]
) {
  return syncProductToMarketplaces(productId, {
    channels: channels || getEnabledChannels(),
    operation: 'inventory',
  });
}

/**
 * Sync price to all marketplaces
 */
export async function syncPriceToMarketplaces(
  productId: string,
  channels?: string[]
) {
  return syncProductToMarketplaces(productId, {
    channels: channels || getEnabledChannels(),
    operation: 'price',
  });
}

/**
 * Delete product from all marketplaces
 */
export async function deleteProductFromMarketplaces(
  productId: string,
  channels?: string[]
) {
  return syncProductToMarketplaces(productId, {
    channels: channels || getEnabledChannels(),
    operation: 'delete',
  });
}

/**
 * Bulk sync multiple products
 */
export async function bulkSyncProducts(
  productIds: string[],
  options?: {
    channels?: string[];
    operation?: SyncOperation;
    batchSize?: number;
  }
) {
  const batchSize = options?.batchSize || 10;
  const jobs = [];

  for (let i = 0; i < productIds.length; i += batchSize) {
    const batch = productIds.slice(i, i + batchSize);

    for (const productId of batch) {
      const job = await syncProductToMarketplaces(productId, {
        channels: options?.channels,
        operation: options?.operation,
        priority: 'low', // Bulk operations are low priority
      });
      jobs.push(job);
    }

    // Small delay between batches
    await sleep(1000);
  }

  console.log(`📦 Queued ${jobs.length} sync jobs for ${productIds.length} products`);

  return jobs;
}

/**
 * Get list of enabled channels from environment
 */
export function getEnabledChannels(): string[] {
  const channels: string[] = [];

  if (process.env.SOLR_ENABLED === 'true') channels.push('solr');
  if (process.env.EBAY_ENABLED === 'true') channels.push('ebay');
  if (process.env.AMAZON_ENABLED === 'true') channels.push('amazon');
  if (process.env.TROVAPREZZI_ENABLED === 'true') channels.push('trovaprezzi');
  if (process.env.MANOMANO_ENABLED === 'true') channels.push('manomano');
  if (process.env.B2B_ENABLED === 'true') channels.push('b2b');
  if (process.env.B2C_ENABLED === 'true') channels.push('b2c');

  return channels;
}

/**
 * Get priority value for BullMQ (lower number = higher priority)
 */
function getPriorityValue(priority?: 'low' | 'normal' | 'high'): number {
  switch (priority) {
    case 'high':
      return 1;
    case 'normal':
      return 5;
    case 'low':
      return 10;
    default:
      return 5;
  }
}

/**
 * Helper: Sleep for ms milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
