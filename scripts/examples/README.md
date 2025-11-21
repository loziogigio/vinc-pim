# PIM Batch Import Examples

This directory contains example scripts demonstrating various batch import scenarios.

## Available Examples

### 1. Basic Import (`basic-import.ts`)
**Description:** Simple import of 10 products with Italian text

**Features:**
- Automatic language conversion
- Solr synchronization
- Error handling
- Progress reporting

**Usage:**
```bash
npx tsx scripts/examples/basic-import.ts
```

**Products Created:** 10 (EXAMPLE-001 to EXAMPLE-010)

---

### 2. Multilingual Import (`multilingual-import.ts`)
**Description:** Import products with multiple language translations

**Features:**
- 4 languages: Italian, English, German, French
- Complete translations for all fields
- SEO meta tags in multiple languages
- URL keys for each language

**Usage:**
```bash
npx tsx scripts/examples/multilingual-import.ts
```

**Products Created:** 5 (ML-TOOL-001, ML-TOOL-002, ML-SAFE-001, ML-ELEC-001, ML-SAFE-002)

---

### 3. CSV Import (`sample-products.csv`)
**Description:** Sample CSV file with 10 products

**Format:**
- Headers: entity_code, sku, name, description, short_description, price, currency, stock_quantity
- Delimiter: Comma (,)
- Encoding: UTF-8

**Products:** 10 (CSV-001 to CSV-010)

**Note:** CSV import script coming soon. Currently use as reference for data structure.

---

## Running Examples

### Prerequisites
1. MongoDB running locally
2. Solr running locally
3. Environment variables configured
4. Import source created (`source_id: "test-default-lang"`)

### Steps
1. Navigate to project root
2. Run example script:
   ```bash
   npx tsx scripts/examples/[example-name].ts
   ```
3. Check console output for results
4. Verify in UI or with verification scripts

---

## Verification

After running an example, verify the import:

```bash
# Count total products
npx tsx scripts/count-products.ts

# Detailed verification
npx tsx scripts/verify-batch-sync.ts

# Check specific products in MongoDB
mongosh mongodb://localhost:27017/vinc-hidros-it
> db.pimproducts.find({ entity_code: /EXAMPLE-/ }).count()

# Check Solr
curl "http://localhost:8983/solr/hdr-api-it/select?q=entity_code:EXAMPLE-*&rows=0"
```

---

## Cleanup

To remove example products:

```bash
# Create a cleanup script or use MongoDB directly
mongosh mongodb://localhost:27017/vinc-hidros-it
> db.pimproducts.deleteMany({ entity_code: /EXAMPLE-/ })
> db.pimproducts.deleteMany({ entity_code: /ML-/ })
> db.pimproducts.deleteMany({ entity_code: /CSV-/ })
```

Or clear all products:
```bash
npx tsx scripts/clear-products.ts
```

---

## Customization

### Modify Product Data
Edit the `products` array in any example script to add your own data.

### Change Default Language
Update `projectConfig.defaultLanguage` in `src/config/project.config.ts`

### Add More Languages
Add translations to the multilingual example:
```typescript
name: {
  it: "...",
  en: "...",
  de: "...",
  fr: "...",
  es: "...", // Spanish
  pt: "..."  // Portuguese
}
```

---

## Expected Performance

| Products | Time | Speed | MongoDB | Solr |
|----------|------|-------|---------|------|
| 10 | 2-3s | 4-5/s | ✅ | ✅ |
| 50 | 8-10s | 5-6/s | ✅ | ✅ |
| 100 | 15-20s | 5-6/s | ✅ | ✅ |

**Note:** Performance may vary based on system resources.

---

## Troubleshooting

### Import Source Not Found
Create import source:
```typescript
await ImportSourceModel.create({
  source_id: "test-default-lang",
  source_name: "Test Default Language Import",
  source_type: "manual",
  enabled: true
});
```

### Solr Connection Failed
Check Solr is running:
```bash
curl http://localhost:8983/solr/admin/ping
```

### MongoDB Connection Failed
Check MongoDB is running:
```bash
mongosh mongodb://localhost:27017
```

### Products Not Syncing to Solr
Verify Solr adapter configuration in example scripts:
```typescript
const solrAdapter = new SolrAdapter({
  enabled: true, // MUST be true
  custom_config: {
    solr_url: process.env.SOLR_URL,
    solr_core: process.env.SOLR_CORE || process.env.MONGODB_DATABASE,
  },
});
```

---

## Related Documentation

- [Batch Import Guide](../../doc/pim/BATCH_IMPORT_GUIDE.md) - Complete documentation
- [API Import Guide](../../doc/pim/API_IMPORT_GUIDE.md) - API-based imports
- [Solr Sync Guide](../../doc/pim/SOLR_SYNC_GUIDE.md) - Search synchronization

---

## Support

For issues or questions, check:
1. Main batch import guide
2. Daily summaries in `/doc/`
3. Project README

---

**Last Updated:** 2025-11-21
