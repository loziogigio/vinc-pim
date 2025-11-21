# Multichannel Sync Architecture

Complete guide to syncing PIM products across multiple marketplaces and storefronts.

## Supported Channels

### Search & Discovery
- **Solr** - Search index for fast product discovery

### Marketplaces
- **eBay** - International marketplace
- **Amazon** - Italy marketplace (configurable)
- **Trovaprezzi** - Italian price comparison
- **ManoMano** - DIY & home improvement marketplace

### Storefronts
- **B2B** - Wholesale/business storefront
- **B2C** - Retail/consumer storefront

---

## Configuration

### Environment Variables

Create a `.env` file with your channel configurations:

```bash
# Solr (Search Index)
SOLR_ENABLED=true
SOLR_URL=http://localhost:8983/solr
SOLR_CORE=mycore

# eBay
EBAY_ENABLED=false
EBAY_APP_ID=your_app_id
EBAY_API_SECRET=your_secret
EBAY_ACCESS_TOKEN=your_token

# Amazon
AMAZON_ENABLED=false
AMAZON_APP_ID=your_app_id
AMAZON_MARKETPLACE_ID=A11IL2PNWYJU7H

# Trovaprezzi
TROVAPREZZI_ENABLED=false
TROVAPREZZI_FEED_URL=https://feed.trovaprezzi.it/upload

# ManoMano
MANOMANO_ENABLED=false
MANOMANO_API_KEY=your_api_key

# B2B Storefront
B2B_ENABLED=true
B2B_API_URL=http://localhost:3001
B2B_API_KEY=your_b2b_key
B2B_TENANT_ID=default

# B2C Storefront
B2C_ENABLED=true
B2C_API_URL=http://localhost:3002
B2C_API_KEY=your_b2c_key
B2C_STORE_ID=store_001
```

---

## Usage Examples

### 1. Sync to All Enabled Channels

```typescript
import { syncProductToMarketplaces } from "@/lib/sync/marketplace-sync";

// Syncs to ALL channels where *_ENABLED=true
await syncProductToMarketplaces('PRODUCT-001');
```

### 2. Sync to Specific Channels

```typescript
// Sync ONLY to storefronts
await syncProductToMarketplaces('PRODUCT-001', {
  channels: ['b2b', 'b2c', 'solr']
});

// Sync ONLY to marketplaces
await syncProductToMarketplaces('PRODUCT-001', {
  channels: ['ebay', 'amazon', 'trovaprezzi', 'manomano']
});

// Sync to Italian channels only
await syncProductToMarketplaces('PRODUCT-001', {
  channels: ['amazon', 'trovaprezzi', 'manomano', 'solr']
});
```

### 3. Different Operations

```typescript
// Full product update
await syncProductToMarketplaces('PRODUCT-001', {
  channels: ['b2b', 'b2c'],
  operation: 'update'
});

// Update inventory only (faster)
await syncInventoryToMarketplaces('PRODUCT-001', ['ebay', 'amazon']);

// Update price only
await syncPriceToMarketplaces('PRODUCT-001', ['trovaprezzi']);

// Delete from channels
await deleteProductFromMarketplaces('PRODUCT-001', ['ebay', 'manomano']);
```

### 4. Batch Import with Multichannel Sync

```typescript
const API_BASE = "http://localhost:3000";

// Step 1: Import products
const response = await fetch(`${API_BASE}/api/b2b/pim/import/api`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    products: [
      {
        entity_code: "PRODUCT-001",
        name: "Power Drill",
        price: 199.99,
        wholesale_price: 149.99,
        // ... other fields
      }
    ],
    source_id: "default-source",
    batch_id: `batch_${Date.now()}`,
    batch_metadata: {
      batch_id: `batch_${Date.now()}`,
      batch_part: 1,
      batch_total_parts: 1,
      batch_total_items: 1,
    },
  }),
});

// Step 2: Sync to all channels
await syncProductToMarketplaces('PRODUCT-001', {
  channels: ['b2b', 'b2c', 'solr', 'ebay', 'amazon', 'trovaprezzi', 'manomano']
});
```

### 5. Channel-Specific Metadata (Tenant ID, Store ID)

You can specify channel-specific identifiers when importing products:

```typescript
const response = await fetch(`${API_BASE}/api/b2b/pim/import/api`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    products: [...],
    source_id: "default-source",
    batch_id: "batch_123",
    batch_metadata: { /* ... */ },

    // Channel-specific metadata
    channel_metadata: {
      b2b: {
        tenant_id: "tenant_001"  // Single tenant
        // OR
        tenant_id: ["tenant_001", "tenant_002"]  // Multiple tenants
      },
      b2c: {
        store_id: "store_001"    // Single store
        // OR
        store_id: ["store_001", "store_002", "store_003"]  // Multiple stores
      },
      amazon: {
        marketplace_id: "A11IL2PNWYJU7H",  // Italy
        seller_id: "A1234567890123"
      },
      ebay: {
        marketplace_id: ["EBAY-IT", "EBAY-DE"],  // Multiple marketplaces
        account_id: "my_ebay_account"
      }
    }
  }),
});
```

**Supported Channel Metadata:**

| Channel | Metadata Fields | Type | Description |
|---------|----------------|------|-------------|
| **b2b** | `tenant_id` | `string \| string[]` | Tenant identifier(s) for B2B multi-tenancy |
| **b2c** | `store_id` | `string \| string[]` | Store identifier(s) for B2C multi-store (supports arrays) |
| **amazon** | `marketplace_id`, `seller_id` | `string \| string[]` | Amazon marketplace and seller identifiers |
| **ebay** | `marketplace_id`, `account_id` | `string \| string[]` | eBay marketplace and account identifiers |
| **trovaprezzi** | `feed_id` | `string` | Feed identifier for Trovaprezzi |
| **manomano** | `seller_id` | `string` | ManoMano seller identifier |

> **Note:** The `channel_metadata` feature is currently a **placeholder** for future implementation. The structure is defined and accepted by the API, but the metadata is not yet passed to the adapters during sync operations.

---

## Channel-Specific Features

### B2B Storefront
- Wholesale pricing
- Minimum order quantities
- Bulk discounts
- Customer group pricing
- Tenant isolation

**API Endpoints:**
- `PUT /api/products/{entity_code}` - Create/update product
- `DELETE /api/products/{entity_code}` - Delete product
- `PATCH /api/products/{entity_code}/inventory` - Update inventory
- `PATCH /api/products/{entity_code}/price` - Update price

### B2C Storefront
- Retail pricing
- Sale prices & discounts
- Featured products
- Bestsellers & new arrivals
- SEO metadata
- Store-specific configuration

**API Endpoints:**
- `PUT /api/products/{entity_code}` - Create/update product
- `DELETE /api/products/{entity_code}` - Delete product
- `PATCH /api/products/{entity_code}/inventory` - Update inventory
- `PATCH /api/products/{entity_code}/price` - Update price

### Solr (Search)
- Full-text search
- Multilingual indexing
- Faceted search
- Real-time updates
- Language-specific fields

### Marketplaces (eBay, Amazon, etc.)
- Marketplace-specific formats
- Rate limiting
- Authentication & OAuth
- Listing management
- Inventory sync

---

## Architecture

### Adapter Pattern

Each channel has its own adapter implementing the `MarketplaceAdapter` interface:

```typescript
abstract class MarketplaceAdapter {
  abstract initialize(): Promise<void>;
  abstract authenticate(): Promise<void>;
  abstract validateProduct(product): Promise<ValidationResult>;
  abstract transformProduct(product): Promise<any>;
  abstract syncProduct(product): Promise<SyncResult>;
  abstract deleteProduct(productId): Promise<SyncResult>;
  abstract syncInventory(sku, quantity): Promise<InventorySyncResult>;
  abstract syncPrice(sku, price): Promise<SyncResult>;
  abstract testConnection(): Promise<boolean>;
}
```

### Registry

All adapters are registered in `src/lib/adapters/index.ts`:

```typescript
const ADAPTER_REGISTRY = {
  solr: SolrAdapter,
  ebay: EbayAdapter,
  amazon: AmazonAdapter,
  trovaprezzi: TrovaprezziAdapter,
  manomano: ManoManoAdapter,
  b2b: B2BAdapter,
  b2c: B2CAdapter,
};
```

### Sync Worker

The sync worker processes jobs from BullMQ queue:

1. Receives sync job with channels array
2. Fetches product from MongoDB
3. Loops through each channel
4. Gets adapter for channel
5. Calls `adapter.syncProduct(product, options)`
6. Returns results for all channels

### Batch Tracking

Batch information flows through the entire system:

```
Import API → MongoDB → Sync Job → Marketplace Adapter
   ↓            ↓          ↓              ↓
batch_id    stored     queued         logged
batch_metadata  ↓          ↓              ↓
            source.    job.data.    adapter receives
            batch_id   batch_id     full product
```

---

## Common Use Cases

### 1. New Product Launch
```typescript
// 1. Import product
await importProduct(productData);

// 2. Sync to B2B first (wholesale priority)
await syncProductToMarketplaces('PRODUCT-001', {
  channels: ['b2b'],
  priority: 'high'
});

// 3. Then B2C
await syncProductToMarketplaces('PRODUCT-001', {
  channels: ['b2c', 'solr'],
  priority: 'high'
});

// 4. Finally marketplaces
await syncProductToMarketplaces('PRODUCT-001', {
  channels: ['ebay', 'amazon', 'trovaprezzi', 'manomano'],
  priority: 'normal'
});
```

### 2. Price Update
```typescript
// Update prices everywhere
await syncPriceToMarketplaces('PRODUCT-001');
```

### 3. Inventory Sync
```typescript
// Real-time inventory update
await syncInventoryToMarketplaces('PRODUCT-001', [
  'b2b', 'b2c', 'ebay', 'amazon'
]);
```

### 4. Product Discontinuation
```typescript
// Remove from marketplaces
await deleteProductFromMarketplaces('PRODUCT-001', [
  'ebay', 'amazon', 'trovaprezzi', 'manomano'
]);

// Mark out of stock in storefronts
await syncInventoryToMarketplaces('PRODUCT-001', ['b2b', 'b2c'], 0);
```

---

## Adding New Channels

### 1. Create Adapter

Create `src/lib/adapters/your-channel-adapter.ts`:

```typescript
import { MarketplaceAdapter } from './marketplace-adapter';

export class YourChannelAdapter extends MarketplaceAdapter {
  readonly name = 'Your Channel';
  readonly id = 'your-channel';
  readonly requiresAuth = true;

  async initialize(): Promise<void> {
    // Initialize connection
  }

  async syncProduct(product, options): Promise<SyncResult> {
    // Transform and sync product
  }

  // ... implement other methods
}
```

### 2. Register Adapter

In `src/lib/adapters/index.ts`:

```typescript
import { YourChannelAdapter } from './your-channel-adapter';

const ADAPTER_REGISTRY = {
  // ... existing adapters
  'your-channel': YourChannelAdapter,
};

export function loadAdapterConfigs() {
  return {
    // ... existing configs
    'your-channel': {
      enabled: process.env.YOUR_CHANNEL_ENABLED === 'true',
      api_key: process.env.YOUR_CHANNEL_API_KEY,
      // ... other config
    },
  };
}

export { YourChannelAdapter } from './your-channel-adapter';
```

### 3. Update Sync Helper

In `src/lib/sync/marketplace-sync.ts`:

```typescript
export function getEnabledChannels(): string[] {
  const channels: string[] = [];

  // ... existing channels
  if (process.env.YOUR_CHANNEL_ENABLED === 'true') {
    channels.push('your-channel');
  }

  return channels;
}
```

### 4. Add Environment Variables

```bash
YOUR_CHANNEL_ENABLED=true
YOUR_CHANNEL_API_KEY=your_key
```

---

## Monitoring & Debugging

### Check Sync Status

```typescript
import { syncQueue } from '@/lib/queue/queues';

// Get job status
const job = await syncQueue.getJob(jobId);
const state = await job.getState();
const progress = job.progress;
```

### View Worker Logs

```bash
# Start worker
pnpm worker:pim

# Check logs
tail -f logs/sync-worker.log
```

### Test Channel Connections

```typescript
import { AdapterFactory, loadAdapterConfigs } from '@/lib/adapters';

const configs = loadAdapterConfigs();
const adapter = AdapterFactory.create('b2b', configs.b2b);

const connected = await adapter.testConnection();
console.log('B2B Connected:', connected);
```

---

## Performance Tips

1. **Use Bulk Operations**: Sync multiple products at once
2. **Prioritize Channels**: Use priority levels (high/normal/low)
3. **Batch Size**: Process in batches of 100-1000 products
4. **Rate Limits**: Respect marketplace rate limits
5. **Async Jobs**: Use queue system for background processing
6. **Channel Groups**: Sync to similar channels together

---

## Troubleshooting

### Channel Not Syncing

1. Check if channel is enabled in `.env`
2. Verify credentials are correct
3. Test connection: `adapter.testConnection()`
4. Check worker logs for errors

### Slow Sync Performance

1. Reduce batch size
2. Enable only needed channels
3. Use inventory/price operations instead of full update
4. Check network latency to marketplaces

### Authentication Errors

1. Verify API keys/tokens in `.env`
2. Check if tokens are expired
3. Refresh OAuth tokens if needed
4. Verify marketplace account status

---

## See Also

- **[Batch Import Guide](../03-import/BATCH_IMPORT.md)** - Complete guide to importing products with batch tracking
- **[Channel Metadata in Batch Import](../03-import/BATCH_IMPORT.md#example-with-channel-metadata-single-store)** - How to use channel metadata during import
- **[API Documentation](../02-api/)** - API endpoint documentation
- **[Examples](../../examples/)** - Code examples and scripts
