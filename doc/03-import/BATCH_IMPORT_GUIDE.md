# PIM Batch Import Guide

## Overview

The PIM Batch Import system allows you to import large numbers of products efficiently using scripts that directly insert data into MongoDB and sync to Solr search engine.

**Current Performance:** 6-7 products per second with full Solr synchronization

**Last Updated:** 2025-11-21

---

## When to Use Batch Import

### ✅ Use Batch Import For:
- **Initial data migration** from legacy systems
- **Large bulk updates** (100+ products)
- **Scheduled imports** from external systems
- **Testing and development** with sample data
- **Emergency data recovery** scenarios

### ❌ Do NOT Use Batch Import For:
- **Single product updates** (use UI or API instead)
- **Real-time updates** (use API endpoints)
- **User-initiated imports** (use API with job queue)
- **Small datasets** (<10 products - use UI)

---

## Batch Import Methods

### Method 1: Direct Script Import (Recommended for Development)
**File:** `scripts/batch-import-direct.ts`

**Best For:**
- Testing and development
- Small to medium batches (10-100 products)
- Quick data seeding

**Pros:**
- Immediate feedback
- Simple to use
- Direct Solr sync
- No job queue overhead

**Cons:**
- Blocks execution until complete
- Not suitable for very large datasets
- No progress tracking

### Method 2: Large-Scale Batch Import
**File:** `scripts/batch-import-1000.ts`

**Best For:**
- Production data migration
- Large datasets (1,000+ products)
- Performance testing

**Pros:**
- Processes in batches of 250
- Progress tracking
- Performance metrics
- Scalable to thousands of products

**Cons:**
- More complex setup
- Requires more memory

---

## Product Data Structure

### Minimum Required Fields

```typescript
{
  entity_code: string,      // Unique identifier (e.g., "PROD-001")
  sku: string,              // Stock keeping unit
  name: string | MultilingualString,
  description?: string | MultilingualString,
  short_description?: string | MultilingualString,
  price: number,
  currency: string,         // ISO 4217 code (e.g., "EUR", "USD")
  stock_quantity: number
}
```

### Complete Product Structure

```typescript
{
  // Required Fields
  entity_code: string,
  sku: string,

  // Multilingual Fields
  name: MultilingualString,              // { it: "...", en: "...", de: "..." }
  description: MultilingualString,
  short_description: MultilingualString,
  features?: MultilingualString,
  specifications?: MultilingualString,

  // Pricing
  price: number,
  currency: string,

  // Inventory
  stock_quantity: number,

  // Optional Fields
  brand_id?: ObjectId,
  category_ids?: ObjectId[],
  collection_ids?: ObjectId[],
  product_type_id?: ObjectId,
  tag_ids?: ObjectId[],

  // Images (handled separately - see image upload guide)
  image?: {
    id: string,
    thumbnail: string,
    original: string
  },

  // Metadata
  meta_title?: MultilingualString,
  meta_description?: MultilingualString,
  meta_keywords?: string[],

  // Dimensions & Weight
  weight?: number,
  weight_unit?: string,
  dimensions?: {
    length: number,
    width: number,
    height: number,
    unit: string
  },

  // Status
  status?: "draft" | "published" | "archived",
  visibility?: "visible" | "hidden",

  // SEO
  url_key?: MultilingualString
}
```

---

## Multilingual Data Format

### Simple String (Auto-Converted to Default Language)

```typescript
const product = {
  entity_code: "PROD-001",
  name: "Cacciavite Professionale",
  description: "Cacciavite di alta qualità"
};

// Automatically converted to:
// {
//   name: { it: "Cacciavite Professionale" },
//   description: { it: "Cacciavite di alta qualità" }
// }
```

### Multilingual Object (Recommended)

```typescript
const product = {
  entity_code: "PROD-001",
  name: {
    it: "Cacciavite Professionale",
    en: "Professional Screwdriver",
    de: "Professioneller Schraubendreher",
    fr: "Tournevis Professionnel"
  },
  description: {
    it: "Cacciavite di alta qualità con impugnatura ergonomica",
    en: "High-quality screwdriver with ergonomic grip",
    de: "Hochwertiger Schraubendreher mit ergonomischem Griff",
    fr: "Tournevis de haute qualité avec poignée ergonomique"
  }
};
```

### Supported Language Codes

ISO 639-1 codes with flag emojis:

| Code | Language | Flag | Code | Language | Flag |
|------|----------|------|------|----------|------|
| `it` | Italian | 🇮🇹 | `en` | English | 🇬🇧 |
| `de` | German | 🇩🇪 | `fr` | French | 🇫🇷 |
| `es` | Spanish | 🇪🇸 | `pt` | Portuguese | 🇵🇹 |
| `nl` | Dutch | 🇳🇱 | `pl` | Polish | 🇵🇱 |
| `cs` | Czech | 🇨🇿 | `sk` | Slovak | 🇸🇰 |

[See full list in language model]

---

## Example 1: Basic 10-Product Import

**File:** `scripts/examples/basic-import.ts`

```typescript
import { connectToDatabase } from "../src/lib/db/connection";
import { ImportSourceModel } from "../src/lib/db/models/import-source";
import { PIMProductModel } from "../src/lib/db/models/pim-product";
import { projectConfig } from "../src/config/project.config";
import { SolrAdapter } from "../src/lib/adapters/solr-adapter";

const products = [
  {
    entity_code: "TOOL-001",
    sku: "SCR-PRO-001",
    name: "Cacciavite Professionale",
    description: "Cacciavite di alta qualità con impugnatura ergonomica",
    short_description: "Cacciavite professionale",
    price: 15.99,
    currency: "EUR",
    stock_quantity: 100
  },
  {
    entity_code: "TOOL-002",
    sku: "HAM-CAR-001",
    name: "Martello da Carpentiere",
    description: "Martello robusto con manico in legno resistente",
    short_description: "Martello professionale",
    price: 24.50,
    currency: "EUR",
    stock_quantity: 75
  },
  // Add more products...
];

function applyDefaultLanguage(data: any): void {
  const defaultLang = projectConfig.defaultLanguage;
  const MULTILINGUAL_FIELDS = [
    "name",
    "description",
    "short_description",
    "features",
    "specifications"
  ];

  for (const field of MULTILINGUAL_FIELDS) {
    if (data[field] && typeof data[field] === "string") {
      data[field] = { [defaultLang]: data[field] };
    }
  }
}

async function importProducts() {
  await connectToDatabase();

  // Get import source
  const source = await ImportSourceModel.findOne({
    source_id: "batch-import"
  });

  // Initialize Solr adapter
  const solrAdapter = new SolrAdapter({
    enabled: true,
    custom_config: {
      solr_url: process.env.SOLR_URL || "http://localhost:8983/solr",
      solr_core: process.env.SOLR_CORE || process.env.MONGODB_DATABASE,
    },
  });
  await solrAdapter.initialize();

  let successCount = 0;
  let syncedCount = 0;

  for (const productData of products) {
    try {
      // Convert to multilingual format
      applyDefaultLanguage(productData);

      // Create product
      const createdProduct = await PIMProductModel.create({
        ...productData,
        version: 1,
        isCurrent: true,
        isCurrentPublished: true,
        status: "published",
        published_at: new Date(),
        image: {
          id: `placeholder-${productData.entity_code}`,
          thumbnail: '/images/placeholder-product.jpg',
          original: '/images/placeholder-product.jpg',
        },
        source: {
          source_id: source.source_id,
          source_name: source.source_name,
          imported_at: new Date(),
        },
        completeness_score: 100,
        analytics: {
          views_30d: 0,
          clicks_30d: 0,
          add_to_cart_30d: 0,
          conversions_30d: 0,
          priority_score: 0,
        },
      });

      console.log(`✅ Created: ${productData.entity_code}`);
      successCount++;

      // Sync to Solr
      const syncResult = await solrAdapter.syncProduct(
        createdProduct.toObject()
      );

      if (syncResult.success) {
        await PIMProductModel.updateOne(
          { _id: createdProduct._id },
          { $set: { "analytics.last_synced_at": new Date() } }
        );
        console.log(`   🔍 Synced to search engine`);
        syncedCount++;
      }
    } catch (error: any) {
      console.error(`❌ Failed: ${productData.entity_code}`, error.message);
    }
  }

  console.log(`\n📊 Results:`);
  console.log(`   Created: ${successCount}`);
  console.log(`   Synced: ${syncedCount}`);

  process.exit(0);
}

importProducts();
```

**Run:**
```bash
npx tsx scripts/examples/basic-import.ts
```

---

## Example 2: Multilingual Product Import

```typescript
const multilingualProducts = [
  {
    entity_code: "TOOL-ML-001",
    sku: "SCR-ML-001",
    name: {
      it: "Cacciavite Professionale",
      en: "Professional Screwdriver",
      de: "Professioneller Schraubendreher",
      fr: "Tournevis Professionnel"
    },
    description: {
      it: "Cacciavite di alta qualità con impugnatura ergonomica. Ideale per uso professionale.",
      en: "High-quality screwdriver with ergonomic grip. Ideal for professional use.",
      de: "Hochwertiger Schraubendreher mit ergonomischem Griff. Ideal für den professionellen Einsatz.",
      fr: "Tournevis de haute qualité avec poignée ergonomique. Idéal pour un usage professionnel."
    },
    short_description: {
      it: "Cacciavite professionale",
      en: "Professional screwdriver",
      de: "Professioneller Schraubendreher",
      fr: "Tournevis professionnel"
    },
    price: 15.99,
    currency: "EUR",
    stock_quantity: 100,
    meta_title: {
      it: "Cacciavite Professionale - Alta Qualità",
      en: "Professional Screwdriver - High Quality",
      de: "Professioneller Schraubendreher - Hohe Qualität",
      fr: "Tournevis Professionnel - Haute Qualité"
    },
    url_key: {
      it: "cacciavite-professionale",
      en: "professional-screwdriver",
      de: "professioneller-schraubendreher",
      fr: "tournevis-professionnel"
    }
  }
];
```

---

## Example 3: CSV to JSON Conversion

**Input CSV:** `products.csv`
```csv
entity_code,sku,name,description,price,currency,stock_quantity
TOOL-001,SCR-001,"Cacciavite","Cacciavite professionale",15.99,EUR,100
TOOL-002,HAM-001,"Martello","Martello da carpentiere",24.50,EUR,75
TOOL-003,WRE-001,"Chiave Inglese","Set chiavi inglesi",45.00,EUR,50
```

**Conversion Script:** `scripts/csv-to-json-import.ts`

```typescript
import * as fs from 'fs';
import * as csv from 'csv-parser';

const results: any[] = [];

fs.createReadStream('products.csv')
  .pipe(csv())
  .on('data', (row) => {
    results.push({
      entity_code: row.entity_code,
      sku: row.sku,
      name: row.name,
      description: row.description,
      short_description: row.name, // Default short desc
      price: parseFloat(row.price),
      currency: row.currency,
      stock_quantity: parseInt(row.stock_quantity, 10)
    });
  })
  .on('end', () => {
    console.log('CSV data converted:');
    console.log(JSON.stringify(results, null, 2));

    // Now import using batch import logic...
  });
```

---

## Example 4: Large-Scale Import (1,000 Products)

```typescript
import { SolrAdapter } from "../src/lib/adapters/solr-adapter";

const TOTAL_PRODUCTS = 1000;
const BATCH_SIZE = 250;

function generateProducts(count: number): any[] {
  const categories = ["TOOL", "SAFE", "ELEC", "HARD"];
  const products = [];

  for (let i = 1; i <= count; i++) {
    const category = categories[i % categories.length];

    products.push({
      entity_code: `${category}-${String(i).padStart(4, "0")}`,
      sku: `SKU-${String(i).padStart(4, "0")}`,
      name: `Prodotto ${i}`,
      description: `Descrizione prodotto numero ${i}`,
      short_description: `Prodotto ${i}`,
      price: Math.round((Math.random() * 200 + 10) * 100) / 100,
      currency: "EUR",
      stock_quantity: Math.floor(Math.random() * 500) + 10
    });
  }

  return products;
}

async function importBatch(
  products: any[],
  solrAdapter: SolrAdapter,
  batchNumber: number
) {
  console.log(`\n📦 Batch ${batchNumber} - ${products.length} products`);

  const startTime = Date.now();
  let success = 0;
  let synced = 0;

  for (const productData of products) {
    try {
      applyDefaultLanguage(productData);

      const product = await PIMProductModel.create({
        ...productData,
        version: 1,
        isCurrent: true,
        status: "published",
        // ... other fields
      });

      success++;

      // Sync to Solr
      const syncResult = await solrAdapter.syncProduct(product.toObject());
      if (syncResult.success) {
        await PIMProductModel.updateOne(
          { _id: product._id },
          { $set: { "analytics.last_synced_at": new Date() } }
        );
        synced++;
      }
    } catch (error) {
      console.error(`Failed: ${productData.entity_code}`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const speed = (products.length / parseFloat(duration)).toFixed(2);

  console.log(`✅ Batch ${batchNumber} complete in ${duration}s`);
  console.log(`   Speed: ${speed} products/sec`);
  console.log(`   Created: ${success}, Synced: ${synced}`);

  return { success, synced };
}

async function largeScaleImport() {
  await connectToDatabase();

  const solrAdapter = new SolrAdapter({
    enabled: true,
    custom_config: {
      solr_url: process.env.SOLR_URL,
      solr_core: process.env.SOLR_CORE || process.env.MONGODB_DATABASE,
    },
  });
  await solrAdapter.initialize();

  console.log(`📦 Generating ${TOTAL_PRODUCTS} products...`);
  const allProducts = generateProducts(TOTAL_PRODUCTS);

  const totalBatches = Math.ceil(TOTAL_PRODUCTS / BATCH_SIZE);
  let totalSuccess = 0;
  let totalSynced = 0;

  for (let i = 0; i < totalBatches; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, TOTAL_PRODUCTS);
    const batch = allProducts.slice(start, end);

    const result = await importBatch(batch, solrAdapter, i + 1);
    totalSuccess += result.success;
    totalSynced += result.synced;
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 Final Results:`);
  console.log(`   Total created: ${totalSuccess}/${TOTAL_PRODUCTS}`);
  console.log(`   Total synced: ${totalSynced}/${totalSuccess}`);
  console.log(`${"=".repeat(60)}`);

  process.exit(0);
}

largeScaleImport();
```

**Performance:** ~6-7 products/second with Solr sync

---

## Best Practices

### 1. Data Preparation
- ✅ Validate data before import
- ✅ Use unique `entity_code` values
- ✅ Ensure SKUs are unique
- ✅ Check required fields are present
- ✅ Validate price formats
- ✅ Verify stock quantities are positive numbers

### 2. Multilingual Content
- ✅ Provide at least default language (Italian)
- ✅ Use ISO 639-1 language codes
- ✅ Keep translations synchronized
- ✅ Fallback to default language if translation missing

### 3. Performance
- ✅ Use batches of 250 products for large imports
- ✅ Monitor memory usage for very large datasets
- ✅ Run imports during off-peak hours
- ✅ Test with small batch first

### 4. Error Handling
- ✅ Log all errors with product identifiers
- ✅ Continue processing on individual failures
- ✅ Track success/failure counts
- ✅ Implement retry logic for transient failures

### 5. Solr Synchronization
- ✅ Always sync published products to Solr
- ✅ Verify sync success before marking product as synced
- ✅ Update `last_synced_at` timestamp only after successful sync
- ✅ Monitor Solr performance during large imports

---

## Verification

### Check MongoDB Count
```bash
npx tsx scripts/count-products.ts
```

### Verify Specific Products
```bash
npx tsx scripts/verify-batch-sync.ts
```

### Query Solr Directly
```bash
curl "http://localhost:8983/solr/hdr-api-it/select?q=*:*&rows=0"
```

---

## Troubleshooting

### Issue: Products Created But Not Synced

**Symptoms:**
- Products appear in MongoDB
- `last_synced_at` is undefined or old
- Products not searchable in Solr

**Solution:**
```typescript
// Ensure Solr adapter is initialized
const solrAdapter = new SolrAdapter({
  enabled: true,  // MUST be true!
  custom_config: {
    solr_url: process.env.SOLR_URL,
    solr_core: process.env.SOLR_CORE || process.env.MONGODB_DATABASE,
  },
});
await solrAdapter.initialize();

// Sync each product
const syncResult = await solrAdapter.syncProduct(product.toObject());
if (syncResult.success) {
  // Only set timestamp if sync succeeded
  await PIMProductModel.updateOne(
    { _id: product._id },
    { $set: { "analytics.last_synced_at": new Date() } }
  );
}
```

### Issue: Duplicate Products

**Symptoms:**
- Multiple versions of same product
- `entity_code` conflicts

**Solution:**
```typescript
// Delete existing products before import
await PIMProductModel.deleteMany({
  entity_code: productData.entity_code
});

// OR use upsert logic
await PIMProductModel.findOneAndUpdate(
  { entity_code: productData.entity_code },
  { $set: productData },
  { upsert: true, new: true }
);
```

### Issue: Multilingual Fields Not Working

**Symptoms:**
- Fields showing as strings instead of multilingual objects
- Missing translations in UI

**Solution:**
```typescript
// Ensure applyDefaultLanguage is called
function applyDefaultLanguage(data: any): void {
  const MULTILINGUAL_FIELDS = [
    "name", "description", "short_description",
    "features", "specifications"
  ];

  for (const field of MULTILINGUAL_FIELDS) {
    if (data[field] && typeof data[field] === "string") {
      data[field] = { [projectConfig.defaultLanguage]: data[field] };
    }
  }
}

applyDefaultLanguage(productData); // Call before creating product
```

### Issue: Slow Import Performance

**Symptoms:**
- Import taking longer than expected
- Memory usage increasing

**Solutions:**
1. **Reduce Batch Size:** Use 100 or 150 instead of 250
2. **Disable Solr Sync Temporarily:** Sync later using worker
3. **Add Delays:** `await sleep(100)` between products
4. **Check MongoDB Indexes:** Ensure indexes exist
5. **Monitor Resources:** Check CPU and memory usage

---

## Common Patterns

### Pattern 1: Import with Retry Logic

```typescript
async function importWithRetry(
  productData: any,
  maxRetries = 3
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const product = await PIMProductModel.create(productData);
      const syncResult = await solrAdapter.syncProduct(product.toObject());

      if (syncResult.success) {
        await PIMProductModel.updateOne(
          { _id: product._id },
          { $set: { "analytics.last_synced_at": new Date() } }
        );
        return true;
      }
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      if (attempt < maxRetries) {
        await sleep(1000 * attempt); // Exponential backoff
      }
    }
  }
  return false;
}
```

### Pattern 2: Progress Tracking

```typescript
async function importWithProgress(products: any[]) {
  const total = products.length;
  let processed = 0;

  for (const productData of products) {
    await importProduct(productData);
    processed++;

    const percentage = ((processed / total) * 100).toFixed(1);
    console.log(`Progress: ${processed}/${total} (${percentage}%)`);
  }
}
```

### Pattern 3: Conditional Sync

```typescript
async function importProduct(productData: any, syncToSolr = true) {
  const product = await PIMProductModel.create(productData);

  if (syncToSolr && product.status === "published") {
    const syncResult = await solrAdapter.syncProduct(product.toObject());
    if (syncResult.success) {
      await PIMProductModel.updateOne(
        { _id: product._id },
        { $set: { "analytics.last_synced_at": new Date() } }
      );
    }
  }

  return product;
}
```

---

## Environment Variables

```bash
# MongoDB
MONGODB_URI=mongodb://username:password@localhost:27017/
MONGODB_DATABASE=hdr-api-it

# Solr
SOLR_URL=http://localhost:8983/solr
SOLR_CORE=hdr-api-it  # Auto-matches MONGODB_DATABASE if not set

# Project Config
DEFAULT_LANGUAGE=it
```

---

## Performance Benchmarks

| Products | Batch Size | Total Time | Products/Sec | MongoDB | Solr |
|----------|-----------|------------|--------------|---------|------|
| 10 | N/A | 2-3s | ~4-5 | ✅ | ✅ |
| 100 | 100 | 15-20s | ~5-6 | ✅ | ✅ |
| 250 | 250 | 38-40s | ~6-7 | ✅ | ✅ |
| 1,000 | 250 | 150-160s | ~6-7 | ✅ | ✅ |

**Test Environment:**
- CPU: Standard development machine
- MongoDB: Local instance
- Solr: Local instance
- Network: Localhost (no latency)

---

## Next Steps

After batch import:
1. **Verify Data:** Run verification scripts
2. **Check Solr:** Confirm all products searchable
3. **Test UI:** Browse products in PIM interface
4. **Update Images:** Use image upload API (see image guide)
5. **Add Media:** Upload documents/PDFs (see media guide)
6. **Set Associations:** Link to brands, categories, collections

---

## Related Documentation

- [API Import Guide](API_IMPORT_GUIDE.md) - For API-based imports
- [Solr Sync Guide](SOLR_SYNC_GUIDE.md) - For search engine synchronization
- [Image Upload Guide](../IMAGE_UPLOAD_GUIDE.md) - For product images
- [Media Management Guide](../MEDIA_MANAGEMENT_GUIDE.md) - For product media files

---

## Support

For issues or questions:
- Check troubleshooting section above
- Review example scripts in `/scripts/examples/`
- See daily summaries in `/doc/` for recent changes

---

**Document Version:** 1.0
**Last Updated:** 2025-11-21
**Tested With:** vinc-pim v1.0, MongoDB 6.x, Solr 9.x
