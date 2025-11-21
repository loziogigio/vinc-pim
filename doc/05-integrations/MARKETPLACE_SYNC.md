# Marketplace Sync System

Multi-marketplace synchronization system for PIM using **BullMQ + Adapter Pattern**.

**Last Updated:** 2025-11-21

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Supported Marketplaces](#supported-marketplaces)
- [Setup & Configuration](#setup--configuration)
- [Usage](#usage)
- [Workers](#workers)
- [API Integration](#api-integration)
- [Testing](#testing)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Performance](#performance)
- [Security](#security)

---

## 🎯 Overview

The Marketplace Sync System enables automatic product synchronization from PIM to multiple sales channels:
- **Marketplaces** (eBay, Amazon, ManoMano)
- **Price comparison sites** (Trovaprezzi)

**Note:** Search engine (Solr) synchronization is handled separately via the PIM product update system. See [Search Sync Guide](../04-features/SEARCH_SYNC.md) for details.

### Database-Driven Configuration

Marketplace integrations are configured in the MongoDB database, allowing you to:
- Enable/disable marketplaces per tenant
- Configure API credentials securely
- Set marketplace-specific settings
- Manage multiple marketplace accounts

### Key Features

- ✅ **Adapter Pattern** - Unified interface for all marketplaces
- ✅ **Asynchronous Processing** - BullMQ queue system
- ✅ **Auto Retry** - Intelligent retry logic with exponential backoff
- ✅ **Rate Limiting** - Automatic rate limit handling
- ✅ **Monitoring** - Real-time dashboard with BullBoard
- ✅ **Validation** - Pre-sync validation per marketplace
- ✅ **Bulk Operations** - Efficient batch synchronization

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 1: Data Source                      │
│              MongoDB PIM + Marketplace Config                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              LAYER 2: Orchestration (BullMQ)                 │
│                                                               │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │  Sync Queue  │────────▶│  Sync Worker │                  │
│  │  (Redis)     │         │  (Background)│                  │
│  └──────────────┘         └──────────────┘                  │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┬─────────────────┐
        │                │                │                 │
        ▼                ▼                ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│              LAYER 3: Marketplace Adapters                   │
│         (Configured from MongoDB database)                   │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   eBay   │  │  Amazon  │  │ Trovapz. │  │ ManoMano │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Components

1. **Adapters** (`src/lib/adapters/`)
   - Common pattern for all marketplaces
   - Automatic rate limiting
   - Data validation and transformation

2. **Sync Worker** (`src/lib/queue/sync-worker.ts`)
   - Processes sync jobs
   - Multi-channel orchestration
   - Intelligent retry logic

3. **Sync Queue** (`src/lib/queue/queues.ts`)
   - BullMQ queue for async jobs
   - Retry and backoff configuration

4. **Helper Functions** (`src/lib/sync/marketplace-sync.ts`)
   - Convenience functions to trigger sync
   - Bulk operations

---

## 🛒 Supported Marketplaces

All marketplaces are configured via MongoDB database settings, allowing per-tenant customization and secure credential storage.

### ✅ eBay
**API:** Inventory API
**Authentication:** OAuth 2.0
**Environment:** Sandbox / Production
**Setup:** https://developer.ebay.com/

**Features:**
- Create/update listings
- Inventory management
- Pricing sync
- Image upload
- Business policies (shipping, return, payment)

**Required Fields:**
- Title (10-80 chars)
- Description
- Price
- At least 1 image
- Category ID
- Condition

---

### ✅ Amazon SP-API
**API:** Selling Partner API
**Authentication:** LWA OAuth + API credentials
**Environment:** Sandbox / Production
**Setup:** https://developer-docs.amazon.com/sp-api/

**Features:**
- XML feed-based product sync
- Inventory updates
- Pricing updates
- Order management

**Required Fields:**
- SKU
- Title
- Brand
- Product ID (UPC/EAN/ISBN)
- Price
- Quantity

---

### ✅ Trovaprezzi
**Type:** Price comparison (feed-based)
**Format:** XML feed
**Authentication:** None (public feed)
**Update Frequency:** Daily

**Features:**
- XML feed generation
- Product catalog export
- Price updates

**Required Fields:**
- Product name
- Price
- Product URL
- Image URL
- Availability

---

### ✅ ManoMano
**API:** REST API
**Authentication:** API Key
**Setup:** Partner portal

**Features:**
- Product sync
- Inventory management
- Pricing updates
- Order management

**Required Fields:**
- Title
- Description
- Price
- Images
- Category

---

## ⚙️ Setup & Configuration

### 1. Environment Variables

Create `.env.local`:

```bash
# ==========================================
# REDIS (Required for BullMQ)
# ==========================================
REDIS_HOST=localhost
REDIS_PORT=6379

# ==========================================
# MARKETPLACE SYNC CONFIGURATION
# ==========================================
# Note: Individual marketplace settings are stored in MongoDB
# These environment variables are for fallback/default values only

# ==========================================
# EBAY MARKETPLACE
# ==========================================
EBAY_ENABLED=false
EBAY_ENVIRONMENT=sandbox  # or 'production'
EBAY_APP_ID=your-ebay-app-id
EBAY_API_SECRET=your-ebay-api-secret
EBAY_ACCESS_TOKEN=your-ebay-access-token
EBAY_FULFILLMENT_POLICY_ID=your-fulfillment-policy-id
EBAY_PAYMENT_POLICY_ID=your-payment-policy-id
EBAY_RETURN_POLICY_ID=your-return-policy-id

# ==========================================
# AMAZON SP-API
# ==========================================
AMAZON_ENABLED=false
AMAZON_ENVIRONMENT=sandbox  # or 'production'
AMAZON_APP_ID=your-amazon-app-id
AMAZON_API_SECRET=your-amazon-api-secret
AMAZON_REFRESH_TOKEN=your-amazon-refresh-token
AMAZON_MARKETPLACE_ID=A11IL2PNWYJU7H  # Italy
AMAZON_MERCHANT_ID=your-merchant-id

# ==========================================
# TROVAPREZZI
# ==========================================
TROVAPREZZI_ENABLED=false
TROVAPREZZI_FEED_URL=https://yourdomain.com/feeds/trovaprezzi.xml

# ==========================================
# MANOMANO
# ==========================================
MANOMANO_ENABLED=false
MANOMANO_API_KEY=your-manomano-api-key
MANOMANO_API_URL=https://api.manomano.com/v1

# ==========================================
# WORKER CONFIGURATION
# ==========================================
SYNC_WORKER_CONCURRENCY=2
SYNC_RATE_LIMIT_MAX=10
SYNC_RATE_LIMIT_DURATION_MS=60000
```

### 2. Start Docker Services

```bash
cd vinc-apps-docker
docker-compose up -d
```

This will start:
- **Redis** (for BullMQ queues)
- **BullBoard** (monitoring UI)

### 3. Install Dependencies

```bash
cd vinc-pim
pnpm install
```

### 4. Verify Setup

```bash
# Test Redis connection
redis-cli ping
# Should return: PONG

# Test BullBoard
curl http://localhost:3020
# Should open monitoring dashboard
```

---

## 🚀 Usage

### Start Workers

**Option 1: Separate Terminals**

```bash
# Terminal 1: Next.js App
pnpm dev

# Terminal 2: Sync Worker
pnpm worker:sync
```

**Option 2: All Workers**

```bash
pnpm worker:all
```

### Triggering Sync from Code

#### Example 1: Sync Product to All Enabled Marketplaces

```typescript
import { syncProductToMarketplaces } from '@/lib/sync/marketplace-sync';

// Sync after import or update
await syncProductToMarketplaces('PRODUCT-123', {
  operation: 'update',
  priority: 'high',
});
```

#### Example 2: Sync Inventory

```typescript
import { syncInventoryToMarketplaces } from '@/lib/sync/marketplace-sync';

// After stock change
await syncInventoryToMarketplaces('PRODUCT-123', ['ebay', 'amazon']);
```

#### Example 3: Bulk Sync

```typescript
import { bulkSyncProducts } from '@/lib/sync/marketplace-sync';

const productIds = ['PROD-1', 'PROD-2', 'PROD-3', /* ... */];

await bulkSyncProducts(productIds, {
  channels: ['amazon', 'ebay'],
  operation: 'update',
  batchSize: 10,
});
```

#### Example 4: Integration with Import Worker

```typescript
// In src/lib/queue/import-worker.ts
import { syncProductToMarketplaces } from '../sync/marketplace-sync';

// After each product import
await PIMProductModel.create(productData);

// Automatic sync to marketplaces (async)
await syncProductToMarketplaces(productData.entity_code, {
  operation: 'create',
  priority: 'low', // Don't block import process
});
```

---

## 📡 API Integration

### Manual Sync Endpoint

**Endpoint:** `POST /api/b2b/pim/products/:entity_code/sync`

See [API Import Guide](../../02-api/API_IMPORT_GUIDE.md#6-sync-product-to-search-engine) for details.

**Request:**
```bash
curl -X POST "http://localhost:3000/api/b2b/pim/products/PROD-001/sync" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "message": "Product sync initiated for enabled marketplaces",
  "entity_code": "PROD-001",
  "synced_at": "2025-11-21T12:30:00Z"
}
```

### Sync to Specific Channels

```typescript
// app/api/products/[id]/sync-channels/route.ts
import { syncProductToMarketplaces } from '@/lib/sync/marketplace-sync';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { channels } = await req.json();

  const job = await syncProductToMarketplaces(id, {
    channels: channels || undefined, // e.g., ['ebay', 'amazon']
    operation: 'update',
  });

  return Response.json({
    success: true,
    job_id: job.id,
    channels: channels
  });
}
```

---

## 🔧 Workers

### Worker Configuration

Configure via environment variables:

```bash
# Number of simultaneous jobs
SYNC_WORKER_CONCURRENCY=2

# Rate limiting: max 10 jobs in 60 seconds
SYNC_RATE_LIMIT_MAX=10
SYNC_RATE_LIMIT_DURATION_MS=60000
```

### Worker Logs

Workers automatically log progress:

```
🔄 Processing sync job: sync-product-123
   Product: PRODUCT-123
   Operation: update
   Channels: ebay, amazon, manomano

  → Syncing to eBay...
  ✓ eBay: Offer published on eBay

  → Syncing to Amazon SP-API...
  ✓ Amazon SP-API: Product feed submitted

  → Syncing to ManoMano...
  ✓ ManoMano: Product synchronized

✅ Sync completed:
   Successful: 3/3
   Failed: 0/3
```

---

## 📊 Monitoring

### BullBoard Dashboard

Access: **http://localhost:3020**

**Features:**
- View jobs in real-time
- Retry failed jobs
- Monitor queue health
- Inspect job data
- View job logs

**Screenshots:**

```
┌─────────────────────────────────────────────┐
│ BullBoard Dashboard                         │
├─────────────────────────────────────────────┤
│ Queues:                                     │
│  ├─ sync-queue        [Active: 2]          │
│  └─ import-queue      [Active: 0]          │
│                                             │
│ Recent Jobs:                                │
│  ├─ sync-product-123  [Completed] 2s ago   │
│  ├─ sync-product-124  [Active]             │
│  └─ sync-product-125  [Waiting]            │
└─────────────────────────────────────────────┘
```

---

## 🧪 Testing

### Test Individual Adapter

```typescript
// Test eBay adapter
import { EbayAdapter } from '@/lib/adapters/ebay-adapter';

const adapter = new EbayAdapter({
  enabled: true,
  custom_config: {
    app_id: process.env.EBAY_APP_ID,
    api_secret: process.env.EBAY_API_SECRET,
    access_token: process.env.EBAY_ACCESS_TOKEN,
    environment: 'sandbox',
  },
});

await adapter.initialize();

// Test connection
const healthy = await adapter.testConnection();
console.log('eBay healthy:', healthy);

// Sync test product
const product = await PIMProductModel.findOne({
  entity_code: 'TEST-1'
});

const result = await adapter.syncProduct(product);
console.log('Sync result:', result);
```

### Test Health Status

```typescript
import { initializeAdapters } from '@/lib/adapters';

const adapters = await initializeAdapters();

for (const [name, adapter] of adapters) {
  const health = await adapter.getHealthStatus();
  console.log(`${name}:`, health);
}

// Expected output:
// ebay: { status: 'healthy', latency: 120 }
// amazon: { status: 'healthy', latency: 180 }
// manomano: { status: 'healthy', latency: 95 }
```

### Validation Test

```typescript
const adapter = adapters.get('ebay');
const product = await PIMProductModel.findOne({
  entity_code: 'PROD-001'
});

const validation = await adapter.validateProduct(product);

if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
  // Example errors:
  // - Title must be at least 10 characters
  // - Missing required field: image
  // - Price must be greater than 0
}
```

---

## 🐛 Troubleshooting

### Problem: Worker Not Starting

**Symptoms:** Worker exits immediately or doesn't connect

**Solution:**
```bash
# Verify Redis is running
docker ps | grep redis

# Check environment variables
cat .env.local | grep REDIS

# Test Redis connection
redis-cli ping

# Restart worker with verbose logging
DEBUG=* pnpm worker:sync
```

---

### Problem: Sync Fails with Rate Limiting

**Symptoms:** Jobs fail with "rate limited" message

The system handles rate limiting automatically with exponential backoff retry.

**Typical Log:**
```
⏸️  Rate limited on ebay, will retry in 30s...
```

**Solution:**
- Job will be automatically re-queued
- Increase `SYNC_RATE_LIMIT_DURATION_MS` if too aggressive
- Reduce `SYNC_WORKER_CONCURRENCY` to slow down

---

### Problem: Adapter Not Found

**Error:**
```
⚠️  Adapter not found or disabled: ebay
```

**Solution:**
```bash
# Verify enabled in .env
EBAY_ENABLED=true

# Verify credentials exist
echo $EBAY_APP_ID
echo $EBAY_API_SECRET

# Restart worker
pnpm worker:sync
```

---

### Problem: Product Validation Failed

**Log:**
```
✗ eBay: Validation failed
  - Title must be at least 10 characters
  - Missing image
  - Invalid category
```

**Solution:**
1. Complete required fields in PIM
2. Check `completeness_score` of product
3. Use pre-sync validation:

```typescript
const adapter = adapters.get('ebay');
const validation = await adapter.validateProduct(product);

if (!validation.isValid) {
  // Fix product before syncing
  console.error('Fix these fields:', validation.errors);
}
```

---

## ⚡ Performance

### Benchmarks

| Operation | Time | Notes |
|-----------|------|-------|
| eBay sync | ~500ms | Including validation |
| Amazon sync | ~1-2s | XML feed submission |
| ManoMano sync | ~400ms | Single product |
| Trovaprezzi feed | ~100ms | Feed generation per product |
| Bulk sync (100) | ~2-3min | All marketplaces |

### Optimization Tips

#### 1. Use Bulk Sync for Large Volumes

```typescript
// ❌ Slow: One job per product
for (const productId of productIds) {
  await syncProductToMarketplaces(productId);
}

// ✅ Fast: Bulk operation
await bulkSyncProducts(productIds, { batchSize: 10 });
```

#### 2. Job Priorities

```typescript
// High priority for immediate user-facing updates
await syncProductToMarketplaces(productId, {
  priority: 'high',
  channels: ['ebay'], // User's active listing
});

// Low priority for non-urgent bulk sync
await bulkSyncProducts(productIds, {
  priority: 'low',
}); // Overnight batch
```

#### 3. Selective Sync

```typescript
// Only sync to necessary channels
await syncProductToMarketplaces('PRODUCT-123', {
  channels: ['ebay', 'amazon'], // Only specific marketplaces
});
```

#### 4. Concurrent Workers

```bash
# Increase concurrency for faster processing
SYNC_WORKER_CONCURRENCY=5

# But be careful of rate limits!
```

---

## 🔐 Security Best Practices

### 1. Credentials Management

```bash
# ✅ Use .env.local for real credentials
# ✅ .env.local is in .gitignore
# ❌ Never commit credentials to .env
```

### 2. Use Sandbox for Testing

```bash
EBAY_ENVIRONMENT=sandbox
AMAZON_ENVIRONMENT=sandbox
```

### 3. Rotate API Keys

- Rotate keys every 90 days
- Use separate keys for dev/staging/production
- Monitor for unauthorized access

### 4. Monitor Failed Jobs

- Check BullBoard for failed jobs
- Review error logs for sensitive data
- Set up alerts for repeated failures

### 5. Network Security

```bash
# Use HTTPS for production
EBAY_API_URL=https://api.ebay.com
AMAZON_API_URL=https://sellingpartnerapi-eu.amazon.com

# Restrict Redis access
REDIS_PASSWORD=your-secure-password
```

---

## 📝 Next Steps

### 1. Setup eBay Sandbox

1. Register app: https://developer.ebay.com/
2. Configure business policies
3. Get OAuth credentials
4. Test with sample products

### 2. Add Webhook Handlers

```typescript
// app/api/webhooks/ebay/orders/route.ts
export async function POST(req: Request) {
  const event = await req.json();

  // Handle order events
  if (event.eventType === 'ORDER_CREATED') {
    // Process new order
  }

  return Response.json({ success: true });
}
```

### 3. Monitor with BullBoard

- Access: http://localhost:3020
- Setup alerts for job failures
- Monitor queue health
- Review performance metrics

---

## 🤝 Contributing

### Adding a New Marketplace Adapter

1. **Create adapter file:**
   ```typescript
   // src/lib/adapters/your-marketplace-adapter.ts
   import { MarketplaceAdapter } from './base-adapter';

   export class YourMarketplaceAdapter extends MarketplaceAdapter {
     async initialize() { /* ... */ }
     async syncProduct(product) { /* ... */ }
     async validateProduct(product) { /* ... */ }
     // Implement all abstract methods
   }
   ```

2. **Register adapter:**
   ```typescript
   // src/lib/adapters/index.ts
   import { YourMarketplaceAdapter } from './your-marketplace-adapter';

   export function initializeAdapters() {
     // Add your adapter
     adapters.set('yourmarketplace', new YourMarketplaceAdapter(config));
   }
   ```

3. **Add configuration:**
   ```bash
   # .env.local
   YOUR_MARKETPLACE_ENABLED=true
   YOUR_MARKETPLACE_API_KEY=your-api-key
   ```

4. **Test:** Write integration tests

5. **Document:** Update this guide

---

## 📚 Related Documentation

- [API Import Guide](../02-api/API_IMPORT_GUIDE.md) - REST API for syncing
- [Batch Import Guide](../03-import/BATCH_IMPORT_GUIDE.md) - Bulk imports
- [Solr Sync Guide](../04-features/SEARCH_SYNC.md) - Search indexing
- [ERP Integration](ERP_INTEGRATION.md) - Connect ERP systems

---

**Happy Syncing! 🚀**

**Version:** 2.0
**Last Updated:** 2025-11-21
**Status:** Active - Production Ready
