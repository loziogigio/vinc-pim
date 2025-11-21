# Batch Operations Guide

**Comprehensive Guide for Bulk Product Updates and Language Management**

---

## Overview

This guide covers all batch operations for managing products and languages at scale:

1. **Language Management UI** - Web dashboard for enabling/disabling languages
2. **Batch API Endpoints** - RESTful APIs for bulk operations
3. **CLI Tools** - Command-line scripts for automation
4. **Automatic Solr Sync** - Real-time schema updates

---

## Table of Contents

1. [Language Management UI](#language-management-ui)
2. [Batch API Endpoints](#batch-api-endpoints)
3. [CLI Tools](#cli-tools)
4. [Common Workflows](#common-workflows)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)

---

## Language Management UI

### Accessing the Dashboard

```
http://localhost:3000/b2b/pim
```

### Features

✅ **Enable/Disable Languages** - Toggle languages with automatic Solr sync
✅ **Bulk Operations** - Enable or disable multiple languages at once
✅ **Real-time Statistics** - See language coverage and product counts
✅ **Search & Filter** - Find languages quickly
✅ **Solr Health Check** - Monitor Solr core status
✅ **Cache Management** - Refresh language cache manually

### UI Components

#### Statistics Dashboard

```
┌──────────────────────────────────────────────────────────┐
│  Total Languages: 43 │ Enabled: 6 │ Disabled: 37 │ Coverage: 14% │
└──────────────────────────────────────────────────────────┘
```

#### Language Table

| Status | Code | Language | Direction | Solr Analyzer | Actions |
|--------|------|----------|-----------|---------------|---------|
| ✅ | IT | Italian / Italiano | LTR | text_it | 🔄 |
| ✅ | DE | German / Deutsch | LTR | text_de | 🔄 |
| ✅ | EN | English / English | LTR | text_en | 🔄 |
| ⚪ | FR | French / Français | LTR | text_fr | - |

#### Toolbar Actions

```
┌────────────────────────────────────────────────────────────────┐
│ [Search...] [Status: All ▼]                                    │
│                                                                 │
│ [✓ Enable Selected (3)] [✗ Disable Selected (3)]               │
│ [🔄 Sync All Solr] [💾 Refresh Cache] [↻ Reload]               │
└────────────────────────────────────────────────────────────────┘
```

### Enabling a Language

1. **Select Language** - Click the toggle switch or checkbox
2. **Confirm** - Modal appears asking for confirmation
3. **Auto Sync** - Solr schema is automatically updated
4. **Notification** - Success message shows fields created

```
✅ Language 'fr' (French) enabled successfully
✅ Solr schema updated for fr

Fields created:
- name_text_fr
- description_text_fr
- features_text_fr
- seo_title_text_fr
- seo_description_text_fr
```

### Disabling a Language

1. **Select Language** - Click the toggle switch (cannot disable Italian)
2. **Confirm** - Warning about existing content
3. **Database Update** - Language marked as disabled
4. **Cache Refresh** - Automatic cache invalidation

**Note:** Solr fields are kept by default. To remove them, use the API with `removeSolrFields: true`.

### Bulk Operations

1. **Select Multiple** - Check multiple language checkboxes
2. **Click Bulk Action** - "Enable Selected" or "Disable Selected"
3. **Automatic Processing** - All languages processed in sequence
4. **Progress Notification** - Shows success/failure for each

```
✅ Enabled 3 language(s)

Results:
- fr (French): ✅ Success
- es (Spanish): ✅ Success
- pt (Portuguese): ✅ Success

Solr schema updated for all languages
```

---

## Batch API Endpoints

### Base URL

```
http://localhost:3000/api
```

### Language Management APIs

#### GET /api/admin/languages

Get all languages with filtering and pagination.

**Query Parameters:**
- `status` - Filter by enabled/disabled/all
- `search` - Search by code, name, or native name
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 50)
- `sortBy` - Sort field (default: order)
- `sortOrder` - asc/desc (default: asc)

**Example:**

```bash
curl "http://localhost:3000/api/admin/languages?status=enabled&limit=10"
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "673c5e4f8a2b1c3d4e5f6789",
      "code": "it",
      "name": "Italian",
      "nativeName": "Italiano",
      "isDefault": true,
      "isEnabled": true,
      "solrAnalyzer": "text_it",
      "direction": "ltr",
      "order": 1
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 43,
    "totalPages": 5
  },
  "stats": {
    "total": 43,
    "enabled": 6,
    "disabled": 37
  }
}
```

#### POST /api/admin/languages/:code/enable

Enable a language with automatic Solr sync.

**Body:**
```json
{
  "syncSolr": true
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/admin/languages/fr/enable \
  -H "Content-Type: application/json" \
  -d '{"syncSolr": true}'
```

**Response:**

```json
{
  "success": true,
  "message": "Language 'fr' (French) enabled successfully",
  "language": {
    "code": "fr",
    "name": "French",
    "nativeName": "Français",
    "isEnabled": true
  },
  "solrSync": {
    "success": true,
    "message": "Solr schema updated for fr",
    "fieldsAdded": [
      "name_text_fr",
      "description_text_fr",
      "features_text_fr",
      "seo_title_text_fr",
      "seo_description_text_fr"
    ]
  }
}
```

#### POST /api/admin/languages/:code/disable

Disable a language (cannot disable Italian).

**Body:**
```json
{
  "removeSolrFields": false
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/admin/languages/cs/disable \
  -H "Content-Type: application/json" \
  -d '{"removeSolrFields": false}'
```

#### POST /api/admin/languages/enable-multiple

Enable multiple languages at once.

**Body:**
```json
{
  "codes": ["fr", "es", "pt"],
  "syncSolr": true
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/admin/languages/enable-multiple \
  -H "Content-Type: application/json" \
  -d '{
    "codes": ["fr", "es", "pt"],
    "syncSolr": true
  }'
```

**Response:**

```json
{
  "success": true,
  "message": "Enabled 3 language(s)",
  "results": [
    {
      "code": "fr",
      "name": "French",
      "enabled": true,
      "solrSync": { "success": true }
    },
    {
      "code": "es",
      "name": "Spanish",
      "enabled": true,
      "solrSync": { "success": true }
    },
    {
      "code": "pt",
      "name": "Portuguese",
      "enabled": true,
      "solrSync": { "success": true }
    }
  ]
}
```

#### POST /api/admin/languages/:code/sync-solr

Manually sync Solr schema for a specific language.

**Example:**

```bash
curl -X POST http://localhost:3000/api/admin/languages/fr/sync-solr
```

#### POST /api/admin/languages/sync-all-solr

Sync Solr schema for all enabled languages.

**Example:**

```bash
curl -X POST http://localhost:3000/api/admin/languages/sync-all-solr
```

#### POST /api/admin/languages/refresh-cache

Manually refresh the language cache.

**Example:**

```bash
curl -X POST http://localhost:3000/api/admin/languages/refresh-cache
```

---

### Batch Product APIs

#### POST /api/products/batch-update

Update multiple products at once.

**Body:**
```json
{
  "updates": [
    {
      "sku": "BOSCH-PSB-750-RCE",
      "data": {
        "price": 79.99,
        "stock": {
          "quantity": 500
        }
      }
    }
  ],
  "reindexSolr": true
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/products/batch-update \
  -H "Content-Type: application/json" \
  -d '{
    "updates": [
      {
        "sku": "BOSCH-PSB-750-RCE",
        "data": {
          "price": 79.99
        }
      }
    ],
    "reindexSolr": true
  }'
```

#### POST /api/products/batch-add-language

Add translations for a specific language to multiple products.

**Body:**
```json
{
  "languageCode": "fr",
  "translations": [
    {
      "sku": "BOSCH-PSB-750-RCE",
      "name": "Perceuse à Percussion Bosch PSB 750 RCE 750W",
      "description": "La perceuse à percussion professionnelle...",
      "features": [
        "Revêtement Soft-Grip",
        "Contrôle électronique"
      ]
    }
  ],
  "reindexSolr": true
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/products/batch-add-language \
  -H "Content-Type: application/json" \
  -d @french-translations.json
```

#### POST /api/products/batch-remove-language

Remove translations for a specific language from multiple products.

**Body:**
```json
{
  "languageCode": "cs",
  "skus": ["BOSCH-PSB-750-RCE", "DEWALT-DCD796"],
  "removeSolrFields": false
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/products/batch-remove-language \
  -H "Content-Type: application/json" \
  -d '{
    "languageCode": "cs",
    "skus": ["BOSCH-PSB-750-RCE"],
    "removeSolrFields": false
  }'
```

#### POST /api/products/batch-import

Import multiple products from JSON array.

**Body:**
```json
{
  "products": [
    {
      "sku": "NEW-PRODUCT-001",
      "name": {
        "it": "Nuovo Prodotto",
        "en": "New Product"
      },
      "price": 99.99
    }
  ],
  "updateExisting": false,
  "reindexSolr": true
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/products/batch-import \
  -H "Content-Type: application/json" \
  -d @products.json
```

#### POST /api/products/reindex

Reindex products to Solr.

**Body:**
```json
{
  "skus": ["BOSCH-PSB-750-RCE"],
  "all": false,
  "limit": 1000
}
```

**Example:**

```bash
# Reindex specific products
curl -X POST http://localhost:3000/api/products/reindex \
  -H "Content-Type: application/json" \
  -d '{"skus": ["BOSCH-PSB-750-RCE"]}'

# Reindex all products
curl -X POST http://localhost:3000/api/products/reindex \
  -H "Content-Type: application/json" \
  -d '{"all": true, "limit": 5000}'
```

#### GET /api/products/batch-status

Get batch operation statistics.

**Example:**

```bash
curl http://localhost:3000/api/products/batch-status
```

**Response:**

```json
{
  "success": true,
  "stats": {
    "total": 1523,
    "published": 1450,
    "draft": 50,
    "archived": 23,
    "withoutTranslations": 15,
    "languageCoverage": {
      "it": { "count": 1523, "percentage": 100 },
      "de": { "count": 1450, "percentage": 95 },
      "en": { "count": 1420, "percentage": 93 },
      "fr": { "count": 250, "percentage": 16 }
    }
  }
}
```

---

## CLI Tools

### Batch Product Update Script

Location: `src/scripts/batch-product-update.ts`

#### Add Language Translations

Add translations for a new language from JSON file.

**JSON Format (translations-fr.json):**

```json
[
  {
    "sku": "BOSCH-PSB-750-RCE",
    "name": "Perceuse à Percussion Bosch PSB 750 RCE 750W",
    "description": "La perceuse à percussion professionnelle Bosch PSB 750 RCE offre 750W de puissance...",
    "features": [
      "Revêtement Soft-Grip pour poignée antidérapante",
      "Contrôle électronique intelligent de la vitesse"
    ],
    "seoTitle": "Perceuse Bosch PSB 750 RCE - 750W Professionnel",
    "seoDescription": "Achetez la perceuse à percussion Bosch PSB 750 RCE..."
  }
]
```

**Command:**

```bash
npx ts-node src/scripts/batch-product-update.ts add-language fr translations-fr.json
```

**Output:**

```
📝 Adding fr translations to products...
   File: translations-fr.json
   Translations: 125

   ✅ BOSCH-PSB-750-RCE: Updated name, description, features
   ✅ DEWALT-DCD796: Updated name, description
   ✅ MAKITA-HP333D: Updated name, description, features
   ...

✅ Complete!
   Updated: 125
   Failed: 0

🔍 Reindexing to Solr...
   ✅ Solr reindex complete
```

#### Remove Language Translations

Remove all translations for a language from all products.

**Command:**

```bash
npx ts-node src/scripts/batch-product-update.ts remove-language cs
```

**Output:**

```
⚠️  WARNING: This will remove ALL cs translations from ALL products
   Language: cs
   Products affected: 142

Type 'yes' to confirm:
yes

🗑️  Removing cs translations...
   ✅ BOSCH-PSB-750-RCE: Removed name, description, features
   ✅ DEWALT-DCD796: Removed name, description
   ...

✅ Complete!
   Removed: 142

🔍 Reindexing to Solr...
   ✅ Solr reindex complete
```

#### Import Products

Import products from JSON file.

**Command:**

```bash
# Create new products only
npx ts-node src/scripts/batch-product-update.ts import products.json

# Create or update products
npx ts-node src/scripts/batch-product-update.ts import products.json --update
```

**Output:**

```
📦 Importing products...
   File: products.json
   Products: 250
   Update existing: Yes

   ✅ BOSCH-PSB-750-RCE: Updated
   ✅ DEWALT-DCD796: Created
   ✅ MAKITA-HP333D: Updated
   ...

✅ Complete!
   Created: 50
   Updated: 200
   Failed: 0

🔍 Reindexing to Solr...
   ✅ Solr reindex complete
```

#### Export Products

Export products to JSON file.

**Command:**

```bash
# Export all products
npx ts-node src/scripts/batch-product-update.ts export products-export.json

# Export translation template for a language
npx ts-node src/scripts/batch-product-update.ts export translations-fr.json fr
```

**Output:**

```
📤 Exporting products...
   Products: 1523
   Output: products-export.json

✅ Export complete!
   File: products-export.json
```

#### Show Statistics

Display product and language statistics.

**Command:**

```bash
npx ts-node src/scripts/batch-product-update.ts stats
```

**Output:**

```
📊 Product & Language Statistics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Products:
   Total: 1523
   Published: 1450
   Draft: 50
   Archived: 23

🌍 Languages:
   Total: 43
   Enabled: 6
   Disabled: 37

📈 Translation Coverage:

   IT Italian
   ████████████████████ 100%
   Name: 1523/1523 | Description: 1523/1523

   DE German
   ███████████████████░ 95%
   Name: 1450/1523 | Description: 1420/1523

   EN English
   ██████████████████░░ 93%
   Name: 1420/1523 | Description: 1400/1523

   FR French
   ███░░░░░░░░░░░░░░░░░ 16%
   Name: 250/1523 | Description: 220/1523
```

#### Reindex to Solr

Reindex all published products to Solr.

**Command:**

```bash
npx ts-node src/scripts/batch-product-update.ts reindex
```

**Output:**

```
🔍 Reindexing products to Solr...

✅ Reindex complete!
```

---

## Common Workflows

### Workflow 1: Add a New Language

**Scenario:** Add French support to the PIM

**Steps:**

1. **Enable language via UI:**
   - Go to http://localhost:3000/b2b/pim
   - Find "French (Français)" in the table
   - Click the toggle switch
   - Confirm in the modal
   - Wait for success notification

2. **Verify Solr schema:**
   ```bash
   curl http://localhost:8983/solr/customer_a_pim/schema/fields | grep "name_text_fr"
   ```

3. **Prepare translations:**
   - Export translation template:
     ```bash
     npx ts-node src/scripts/batch-product-update.ts export translations-fr.json fr
     ```

4. **Fill in translations:**
   - Edit `translations-fr.json` with French content
   - Use translation services or human translators

5. **Import translations:**
   ```bash
   npx ts-node src/scripts/batch-product-update.ts add-language fr translations-fr.json
   ```

6. **Check coverage:**
   ```bash
   npx ts-node src/scripts/batch-product-update.ts stats
   ```

**Result:** French is now available with automatic Solr search support!

### Workflow 2: Remove a Language

**Scenario:** Remove Czech support (no longer needed)

**Steps:**

1. **Disable language via UI:**
   - Go to http://localhost:3000/b2b/pim
   - Find "Czech (Čeština)" in the table
   - Click the toggle switch
   - Confirm in the modal

2. **Remove translations (optional):**
   ```bash
   npx ts-node src/scripts/batch-product-update.ts remove-language cs
   ```

3. **Verify:**
   ```bash
   curl http://localhost:3000/api/languages/enabled
   ```

**Result:** Czech is disabled and no longer accepts new content!

### Workflow 3: Bulk Product Update

**Scenario:** Update prices for 500 products

**Steps:**

1. **Prepare update file (price-updates.json):**
   ```json
   {
     "updates": [
       {
         "sku": "BOSCH-PSB-750-RCE",
         "data": {
           "price": 79.99,
           "originalPrice": 119.99,
           "discountPercentage": 33
         }
       }
     ],
     "reindexSolr": true
   }
   ```

2. **Execute update:**
   ```bash
   curl -X POST http://localhost:3000/api/products/batch-update \
     -H "Content-Type: application/json" \
     -d @price-updates.json
   ```

3. **Verify in Solr:**
   ```bash
   curl "http://localhost:8983/solr/customer_a_pim/select?q=sku:BOSCH-PSB-750-RCE&fl=sku,price"
   ```

**Result:** 500 products updated and reindexed in Solr!

### Workflow 4: Import Products from Supplier

**Scenario:** Import 1000 new products from supplier CSV (converted to JSON)

**Steps:**

1. **Convert CSV to JSON:**
   - Use a script or tool to convert supplier CSV to our JSON format

2. **Validate JSON:**
   - Ensure all required fields are present
   - Check Italian translations are included

3. **Import:**
   ```bash
   npx ts-node src/scripts/batch-product-update.ts import supplier-products.json
   ```

4. **Check statistics:**
   ```bash
   npx ts-node src/scripts/batch-product-update.ts stats
   ```

**Result:** 1000 new products imported and searchable!

---

## Best Practices

### 1. Always Test on Sample Data First

Before running batch operations on production:

```bash
# Test with 10 products first
head -n 10 all-products.json > sample-products.json
npx ts-node src/scripts/batch-product-update.ts import sample-products.json
```

### 2. Use Transactions for Critical Updates

For price updates or inventory changes, consider using database transactions:

```typescript
const session = await mongoose.startSession();
session.startTransaction();

try {
  // Perform updates
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

### 3. Monitor Solr Performance

After large batch operations, check Solr performance:

```bash
# Check index size
curl "http://localhost:8983/solr/customer_a_pim/admin/luke?numTerms=0"

# Optimize index
curl "http://localhost:8983/solr/customer_a_pim/update?optimize=true"
```

### 4. Schedule Batch Operations Off-Peak

Run large imports/updates during low-traffic hours:

```bash
# Schedule with cron (2 AM daily)
0 2 * * * cd /app && npx ts-node src/scripts/batch-product-update.ts import daily-updates.json
```

### 5. Keep Backups

Before major operations, backup MongoDB and Solr:

```bash
# Backup MongoDB
mongodump --db=customer_a_pim --out=/backup/mongodb/$(date +%Y%m%d)

# Backup Solr
curl "http://localhost:8983/solr/customer_a_pim/replication?command=backup&location=/backup/solr&name=backup-$(date +%Y%m%d)"
```

### 6. Validate Data Quality

Check for missing translations or invalid data:

```bash
# Find products without Italian name (should be 0!)
curl http://localhost:3000/api/products/batch-status

# Check for products with missing descriptions
```

### 7. Use Pagination for Large Datasets

When processing thousands of products:

```javascript
// Process in batches of 100
const batchSize = 100;
for (let i = 0; i < products.length; i += batchSize) {
  const batch = products.slice(i, i + batchSize);
  await processBatch(batch);
}
```

---

## Troubleshooting

### Issue: Solr Schema Not Updating

**Symptoms:**
- Language enabled but search doesn't work
- Field type not found errors

**Solution:**

```bash
# 1. Check Solr core health
curl http://localhost:8983/solr/admin/cores?action=STATUS&core=customer_a_pim

# 2. Manually sync language
curl -X POST http://localhost:3000/api/admin/languages/fr/sync-solr

# 3. Check field types
curl http://localhost:8983/solr/customer_a_pim/schema/fieldtypes | grep text_fr

# 4. Restart Solr if needed
docker restart solr
```

### Issue: Language Cache Not Refreshing

**Symptoms:**
- Enabled language not appearing in API responses
- Old language list still showing

**Solution:**

```bash
# 1. Manually refresh cache
curl -X POST http://localhost:3000/api/admin/languages/refresh-cache

# 2. Restart application
npm run dev

# 3. Check cache TTL in environment
echo $LANGUAGE_CACHE_TTL  # Should be 300000 (5 minutes)
```

### Issue: Batch Import Failing

**Symptoms:**
- Products not importing
- Validation errors

**Solution:**

```bash
# 1. Check JSON format
cat products.json | jq .

# 2. Validate required fields
# Ensure each product has: sku, name.it, price

# 3. Import with detailed logging
DEBUG=* npx ts-node src/scripts/batch-product-update.ts import products.json

# 4. Check MongoDB connection
mongosh customer_a_pim --eval "db.products.countDocuments()"
```

### Issue: Solr Reindex Taking Too Long

**Symptoms:**
- Reindex doesn't complete
- Timeout errors

**Solution:**

```bash
# 1. Reindex in smaller batches
curl -X POST http://localhost:3000/api/products/reindex \
  -H "Content-Type: application/json" \
  -d '{"all": true, "limit": 500}'

# 2. Check Solr memory
docker stats solr

# 3. Increase Solr heap size (docker-compose.yml)
# -Xms2g -Xmx4g

# 4. Optimize index after reindex
curl "http://localhost:8983/solr/customer_a_pim/update?optimize=true"
```

### Issue: Translations Not Appearing

**Symptoms:**
- Added translations but not visible in search

**Solution:**

```bash
# 1. Check product in MongoDB
mongosh customer_a_pim --eval 'db.products.findOne({sku: "BOSCH-PSB-750-RCE"})'

# 2. Check Solr document
curl "http://localhost:8983/solr/customer_a_pim/select?q=id:BOSCH-PSB-750-RCE&fl=*"

# 3. Reindex specific product
curl -X POST http://localhost:3000/api/products/reindex \
  -H "Content-Type: application/json" \
  -d '{"skus": ["BOSCH-PSB-750-RCE"]}'

# 4. Clear Solr cache
curl "http://localhost:8983/solr/customer_a_pim/update?commit=true"
```

---

## Summary

**Key Points:**

✅ **Language Management UI** - Web dashboard at `/b2b/pim` for easy language control
✅ **Automatic Solr Sync** - Schema updates happen automatically when enabling languages
✅ **Batch APIs** - RESTful endpoints for all bulk operations
✅ **CLI Tools** - Command-line scripts for automation and scripting
✅ **Zero Downtime** - All operations work without restarting the application
✅ **Real-time Updates** - Changes are immediately reflected (5-minute cache)

**File References:**

- API: [languages-admin.api.ts](../vinc-pim/src/api/languages-admin.api.ts)
- Batch API: [products-batch.api.ts](../vinc-pim/src/api/products-batch.api.ts)
- CLI: [batch-product-update.ts](../vinc-pim/src/scripts/batch-product-update.ts)
- UI: [LanguageManagement.tsx](../vinc-pim/src/components/LanguageManagement.tsx)

**Related Docs:**

- [Language Management Guide](LANGUAGE-MANAGEMENT-GUIDE.md)
- [Solr Schema Setup](SOLR-SCHEMA-SETUP.md)
- [Zero-Downtime Language Management](ZERO-DOWNTIME-LANGUAGE-MANAGEMENT.md)

---

**Last Updated:** 2025-11-19
**Version:** 1.0
