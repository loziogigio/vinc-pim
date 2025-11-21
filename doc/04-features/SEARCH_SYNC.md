# Solr Schema Setup Guide

**Multitenant PIM - Dynamic Multilingual Solr Schema via API**

---

## Overview

This guide explains how to set up the Solr schema for the multilingual PIM system using the **Solr Schema API**. The schema is created programmatically (not via XML files) and supports all 43 languages with proper language-specific analyzers.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Project: customer_a                                        │
├─────────────────────────────────────────────────────────────┤
│  MongoDB: customer_a_pim                                    │
│  Solr Core: customer_a_pim  ← MUST MATCH                   │
│  Enabled Languages: IT, DE, EN, CS                          │
├─────────────────────────────────────────────────────────────┤
│  Solr Schema (via API):                                     │
│  ├─ Field Types: text_it, text_de, text_en, text_cs, ...   │
│  ├─ Core Fields: id, sku, brand, price, stock, ...         │
│  ├─ Language Fields: name_text_it, name_text_de, ...       │
│  └─ Dynamic Fields: *_text_fr, *_text_ja, ...              │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Ensure Solr is Running

```bash
# Check Solr status
curl http://localhost:8983/solr/admin/cores?action=STATUS

# Or via docker-compose
docker-compose ps solr
```

### 2. Create Solr Core

The core name **MUST** match the MongoDB database name:

```bash
# Get database name from environment
echo $MONGODB_DATABASE
# Output: customer_a_pim

# Create matching Solr core
docker exec -it solr solr create -c customer_a_pim

# Or if running Solr natively:
cd /opt/solr
bin/solr create -c customer_a_pim
```

### 3. Run Schema Setup Script

```bash
cd vinc-apps/vinc-pim

# Run the schema setup (uses Solr Schema API)
npx ts-node src/scripts/setup-solr-schema.ts
```

**Expected Output:**

```
🔧 Solr Schema Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Configuration:
   Solr URL: http://localhost:8983
   Core: customer_a_pim
   MongoDB: customer_a_pim ✓ (names match)

🔍 Step 1: Checking Solr core exists...
   ✅ Core 'customer_a_pim' is active

🌍 Step 2: Adding language-specific field types...
   ✅ text_it (Italian - stemming + stopwords)
   ✅ text_de (German - stemming + stopwords)
   ✅ text_en (English - stemming + stopwords)
   ✅ text_general (Czech, Slovak, etc.)
   ✅ text_fr (French - stemming + stopwords)
   ✅ text_es (Spanish - stemming + stopwords)
   ✅ text_ja (Japanese - Kuromoji tokenizer)
   ✅ text_cjk (Chinese, Korean - bigrams)
   ✅ text_ar (Arabic - normalization)
   ... and 34 more languages

📝 Step 3: Adding core product fields...
   ✅ id (string, unique identifier)
   ✅ sku (string, searchable)
   ✅ category_name (string)
   ✅ brand_name (string)
   ✅ price (pfloat)
   ✅ stock_status (string)
   ✅ quantity (pint)
   ... and 15 more fields

🌐 Step 4: Adding multilingual text fields...
   ✅ name_text_it (Italian product names)
   ✅ name_text_de (German product names)
   ✅ name_text_en (English product names)
   ✅ name_text_cs (Czech product names)
   ✅ description_text_it (Italian descriptions)
   ... and 20 more fields

⚡ Step 5: Adding dynamic fields...
   ✅ *_text_* (any language text field)
   ✅ *_s (string field)
   ✅ *_i (integer field)
   ✅ *_f (float field)
   ✅ *_b (boolean field)
   ✅ *_dt (date field)

🔗 Step 6: Adding copy field rules...
   ✅ name_text_* → _text_ (universal search)
   ✅ description_text_* → _text_
   ✅ features_text_* → _text_

✅ Schema setup completed successfully!

📊 Schema Statistics:
   Field Types: 43
   Core Fields: 22
   Language Fields: 28
   Dynamic Fields: 6
   Copy Rules: 3

🎯 Next Steps:
   1. Test indexing: npx ts-node src/scripts/test-solr-indexing.ts
   2. Enable more languages: npx ts-node src/scripts/manage-languages.ts enable fr es
   3. Sync schema: npx ts-node src/scripts/sync-solr-schema.ts
```

---

## Schema Structure

### Language-Specific Field Types

The schema includes optimized analyzers for each language family:

#### Western European Languages (Stemming + Stopwords)

```json
{
  "name": "text_it",
  "class": "solr.TextField",
  "analyzer": {
    "tokenizer": { "class": "solr.StandardTokenizerFactory" },
    "filters": [
      { "class": "solr.LowerCaseFilterFactory" },
      { "class": "solr.StopFilterFactory", "words": "lang/stopwords_it.txt" },
      { "class": "solr.ItalianLightStemFilterFactory" }
    ]
  }
}
```

**Languages**: IT, DE, EN, FR, ES, PT, NL, SV, DA, FI, NO

#### Slavic Languages (Light Stemming)

```json
{
  "name": "text_general",
  "class": "solr.TextField",
  "analyzer": {
    "tokenizer": { "class": "solr.StandardTokenizerFactory" },
    "filters": [
      { "class": "solr.LowerCaseFilterFactory" },
      { "class": "solr.ASCIIFoldingFilterFactory" }
    ]
  }
}
```

**Languages**: CS, SK, PL, HR, SR, SL, BG, MK, etc.

#### Asian Languages (Special Tokenization)

**Japanese (Kuromoji)**:
```json
{
  "name": "text_ja",
  "class": "solr.TextField",
  "analyzer": {
    "tokenizer": { "class": "solr.JapaneseTokenizerFactory", "mode": "search" },
    "filters": [
      { "class": "solr.JapaneseBaseFormFilterFactory" },
      { "class": "solr.JapanesePartOfSpeechStopFilterFactory" },
      { "class": "solr.CJKWidthFilterFactory" },
      { "class": "solr.StopFilterFactory", "words": "lang/stopwords_ja.txt" },
      { "class": "solr.JapaneseKatakanaStemFilterFactory", "minimumLength": 4 },
      { "class": "solr.LowerCaseFilterFactory" }
    ]
  }
}
```

**Chinese/Korean (CJK Bigrams)**:
```json
{
  "name": "text_cjk",
  "class": "solr.TextField",
  "analyzer": {
    "tokenizer": { "class": "solr.StandardTokenizerFactory" },
    "filters": [
      { "class": "solr.CJKWidthFilterFactory" },
      { "class": "solr.LowerCaseFilterFactory" },
      { "class": "solr.CJKBigramFilterFactory" }
    ]
  }
}
```

#### RTL Languages (Arabic, Hebrew)

```json
{
  "name": "text_ar",
  "class": "solr.TextField",
  "analyzer": {
    "tokenizer": { "class": "solr.StandardTokenizerFactory" },
    "filters": [
      { "class": "solr.LowerCaseFilterFactory" },
      { "class": "solr.StopFilterFactory", "words": "lang/stopwords_ar.txt" },
      { "class": "solr.ArabicNormalizationFilterFactory" },
      { "class": "solr.ArabicStemFilterFactory" }
    ]
  }
}
```

---

## Core Product Fields

### Identifiers

```json
{
  "id": "string",           // Unique document ID
  "sku": "string",          // Product SKU (searchable)
  "_version_": "long"       // Solr internal versioning
}
```

### Categorization

```json
{
  "category_id": "string",
  "category_name": "string",
  "category_path": "string",
  "brand_id": "string",
  "brand_name": "string"
}
```

### Pricing & Inventory

```json
{
  "price": "pfloat",              // Current price
  "original_price": "pfloat",     // Before discount
  "cost": "pfloat",               // Cost price
  "stock_status": "string",       // in_stock, out_of_stock, low_stock
  "quantity": "pint",             // Available quantity
  "min_order_quantity": "pint",
  "max_order_quantity": "pint"
}
```

### Status & Visibility

```json
{
  "status": "string",            // draft, active, archived
  "is_published": "boolean",
  "visibility": "string",        // public, private, restricted
  "is_featured": "boolean",
  "is_bestseller": "boolean",
  "is_new": "boolean"
}
```

### Dates

```json
{
  "created_at": "pdate",
  "updated_at": "pdate",
  "published_at": "pdate"
}
```

### Analytics

```json
{
  "view_count": "pint",
  "order_count": "pint",
  "rating_average": "pfloat",
  "rating_count": "pint"
}
```

### Promotions

```json
{
  "is_on_sale": "boolean",
  "sale_start_date": "pdate",
  "sale_end_date": "pdate",
  "discount_percentage": "pfloat"
}
```

---

## Multilingual Text Fields

For each enabled language, the following fields are created:

### Product Name

```
name_text_it    ← Italian analyzer
name_text_de    ← German analyzer
name_text_en    ← English analyzer
name_text_cs    ← Czech/General analyzer
```

### Description

```
description_text_it
description_text_de
description_text_en
description_text_cs
```

### Features (Multi-valued)

```
features_text_it     ← Array of strings
features_text_de
features_text_en
features_text_cs
```

### SEO Fields

```
seo_title_text_it
seo_description_text_it
seo_keywords_text_it
```

---

## Dynamic Fields

Dynamic fields automatically handle new language additions:

```xml
*_text_*     → Any language text field (uses text_general)
*_s          → String field
*_i          → Integer field
*_f          → Float field
*_b          → Boolean field
*_dt         → Date field
*_txt        → Generic text (no language-specific analysis)
```

### Example Usage

When you enable French (`fr`), you can immediately use:

```json
{
  "name_text_fr": "Perceuse Bosch 750W",
  "description_text_fr": "Une perceuse professionnelle...",
  "features_text_fr": ["Poignée Soft-Grip", "Contrôle électronique"]
}
```

The dynamic field `*_text_fr` matches automatically.

---

## Copy Fields

Universal search across all languages:

```
name_text_it         ┐
name_text_de         │
name_text_en         ├──→  _text_  (universal search field)
name_text_cs         │
description_text_it  │
description_text_de  ┘
... etc
```

### Usage

```bash
# Search across ALL languages
curl "http://localhost:8983/solr/customer_a_pim/select?q=_text_:bosch"

# Search specific language
curl "http://localhost:8983/solr/customer_a_pim/select?q=name_text_it:trapano"
```

---

## Indexing Products

### Example Product Document

```json
{
  "id": "BOSCH-PSB-750-RCE",
  "sku": "BOSCH-PSB-750-RCE",

  "category_name": "Trapani",
  "brand_name": "Bosch Professional",

  "name_text_it": "Trapano Battente Professionale Bosch PSB 750 RCE 750W",
  "name_text_de": "Bosch PSB 750 RCE Profi-Schlagbohrmaschine 750W",
  "name_text_en": "Bosch PSB 750 RCE Professional Hammer Drill 750W",
  "name_text_cs": "Bosch PSB 750 RCE Profesionální příklepová vrtačka 750W",

  "description_text_it": "Il trapano a percussione professionale Bosch PSB 750 RCE offre 750W di potenza...",
  "description_text_de": "Die Bosch PSB 750 RCE Profi-Schlagbohrmaschine bietet 750W Leistung...",
  "description_text_en": "The Bosch PSB 750 RCE professional hammer drill offers 750W of power...",
  "description_text_cs": "Profesionální příklepová vrtačka Bosch PSB 750 RCE nabízí výkon 750 W...",

  "features_text_it": [
    "Rivestimento Soft-Grip per impugnatura antiscivolo",
    "Cambio elettronico intelligente della velocità",
    "Mandrino autoserrante 13mm"
  ],
  "features_text_de": [
    "Soft-Grip-Beschichtung für rutschfesten Griff",
    "Intelligente elektronische Drehzahlregelung",
    "Selbstspannfutter 13mm"
  ],

  "price": 89.99,
  "stock_status": "in_stock",
  "quantity": 450,
  "is_published": true,
  "is_featured": true,
  "rating_average": 4.7,
  "rating_count": 128
}
```

### Index via API

```bash
curl -X POST http://localhost:8983/solr/customer_a_pim/update?commit=true \
  -H "Content-Type: application/json" \
  -d '[
    {
      "id": "BOSCH-PSB-750-RCE",
      "sku": "BOSCH-PSB-750-RCE",
      "name_text_it": "Trapano Battente Professionale Bosch",
      "name_text_de": "Bosch Profi-Schlagbohrmaschine",
      "price": 89.99,
      "stock_status": "in_stock"
    }
  ]'
```

---

## Adding New Languages

### 1. Enable Language in Database

```bash
npx ts-node src/scripts/manage-languages.ts enable fr
```

**Output:**
```
🔓 Enabling languages: fr

✅ fr (French) - enabled in database

🔧 Updating Solr schema...
   ✅ Added field type: text_fr
   ✅ Added field: name_text_fr
   ✅ Added field: description_text_fr
   ✅ Added field: features_text_fr

✅ Languages enabled! No restart needed - changes are live immediately.
```

### 2. Index Products with New Language

```bash
curl -X POST http://localhost:8983/solr/customer_a_pim/update?commit=true \
  -H "Content-Type: application/json" \
  -d '[
    {
      "id": "BOSCH-PSB-750-RCE",
      "name_text_fr": {
        "set": "Perceuse à Percussion Bosch PSB 750 RCE 750W"
      },
      "description_text_fr": {
        "set": "La perceuse à percussion professionnelle Bosch..."
      }
    }
  ]'
```

### 3. Search in New Language

```bash
curl "http://localhost:8983/solr/customer_a_pim/select?q=name_text_fr:perceuse"
```

---

## Syncing Schema with Enabled Languages

### Manual Sync

If you enable languages directly in the database (bypassing `manage-languages.ts`), sync the Solr schema:

```bash
npx ts-node src/scripts/sync-solr-schema.ts
```

**What it does:**
1. Queries database for all enabled languages
2. Checks which field types exist in Solr
3. Adds missing field types and fields
4. Removes fields for disabled languages (optional)

### Auto-Sync

The schema setup script creates dynamic fields (`*_text_*`), so new languages work immediately. However, for optimal performance, it's recommended to create explicit fields.

---

## Verification

### Check Field Types

```bash
curl "http://localhost:8983/solr/customer_a_pim/schema/fieldtypes"
```

### Check Fields

```bash
curl "http://localhost:8983/solr/customer_a_pim/schema/fields"
```

### Check Dynamic Fields

```bash
curl "http://localhost:8983/solr/customer_a_pim/schema/dynamicfields"
```

### Check Copy Fields

```bash
curl "http://localhost:8983/solr/customer_a_pim/schema/copyfields"
```

### Test Search

```bash
# Search Italian products
curl "http://localhost:8983/solr/customer_a_pim/select?q=name_text_it:trapano&rows=10"

# Search German products
curl "http://localhost:8983/solr/customer_a_pim/select?q=name_text_de:bohrmaschine&rows=10"

# Universal search (all languages)
curl "http://localhost:8983/solr/customer_a_pim/select?q=_text_:bosch&rows=10"

# Faceted search
curl "http://localhost:8983/solr/customer_a_pim/select?q=*:*&facet=true&facet.field=brand_name&facet.field=category_name"
```

---

## Troubleshooting

### Error: "Core not found"

```
❌ Error: Core 'customer_a_pim' does not exist
```

**Solution:**
```bash
docker exec -it solr solr create -c customer_a_pim
```

### Error: "Field type already exists"

```
❌ Error: Field Type 'text_it' already exists
```

**Solution:** This is usually safe to ignore. The script should handle this gracefully. If not, you can:

```bash
# Delete field type
curl -X POST http://localhost:8983/solr/customer_a_pim/schema \
  -H "Content-Type: application/json" \
  -d '{"delete-field-type": {"name": "text_it"}}'
```

### Error: "Solr core name mismatch"

```
❌ Error: Solr core name (pim-products) must match MongoDB database name (customer_a_pim)
```

**Solution:** Update environment variables:

```bash
export MONGODB_DATABASE=customer_a_pim
# Solr core is automatically set to match
```

### Slow Search Performance

**Check:**

1. **Index size**: `curl "http://localhost:8983/solr/customer_a_pim/admin/luke?numTerms=0"`
2. **Query time**: Add `debugQuery=true` to see breakdown
3. **Cache hit rate**: Check Solr admin dashboard

**Optimize:**

```bash
# Commit and optimize index
curl "http://localhost:8983/solr/customer_a_pim/update?optimize=true"
```

### Analyzer Not Working

**Test analyzer:**

```bash
curl "http://localhost:8983/solr/customer_a_pim/analysis/field?analysis.fieldtype=text_it&analysis.fieldvalue=trapano%20battente"
```

---

## Production Checklist

Before deploying to production:

- [ ] Solr core name matches MongoDB database name
- [ ] All required field types created (`text_it`, `text_de`, `text_en`, etc.)
- [ ] Core product fields added (id, sku, price, stock, etc.)
- [ ] Multilingual fields added for enabled languages
- [ ] Dynamic fields configured for future language additions
- [ ] Copy fields set up for universal search
- [ ] Test indexing a sample product
- [ ] Test search in each enabled language
- [ ] Test universal search across all languages
- [ ] Verify faceted search works
- [ ] Check Solr admin dashboard for errors
- [ ] Set up Solr backups/snapshots
- [ ] Configure Solr replication (if using SolrCloud)
- [ ] Monitor Solr performance metrics

---

## Multi-Project Setup

### Example: Two Projects

**Project A:**
```bash
export PROJECT_ID=customer_a
export MONGODB_DATABASE=customer_a_pim
export ENABLED_LANGUAGES=it,de,en,cs

docker exec -it solr solr create -c customer_a_pim
npx ts-node src/scripts/setup-solr-schema.ts
```

**Project B:**
```bash
export PROJECT_ID=customer_b
export MONGODB_DATABASE=customer_b_pim
export ENABLED_LANGUAGES=it,de,fr,es

docker exec -it solr solr create -c customer_b_pim
npx ts-node src/scripts/setup-solr-schema.ts
```

**Result:**
```
Solr Cores:
  customer_a_pim → IT, DE, EN, CS languages
  customer_b_pim → IT, DE, FR, ES languages

MongoDB Databases:
  customer_a_pim → Products for Customer A
  customer_b_pim → Products for Customer B
```

---

## Best Practices

### 1. Always Use API for Schema Changes

❌ **Don't** manually edit `managed-schema.xml`:
```xml
<!-- Don't do this -->
<field name="name_text_it" type="text_it" indexed="true" stored="true"/>
```

✅ **Do** use the Schema API:
```bash
curl -X POST http://localhost:8983/solr/customer_a_pim/schema \
  -H "Content-Type: application/json" \
  -d '{
    "add-field": {
      "name": "name_text_it",
      "type": "text_it",
      "indexed": true,
      "stored": true
    }
  }'
```

### 2. Use Language-Specific Analyzers

Each language has different linguistic rules. Always use the correct analyzer:

- **Italian**: `text_it` (stemming, stopwords)
- **German**: `text_de` (compound words, stemming)
- **English**: `text_en` (stemming, stopwords)
- **Japanese**: `text_ja` (Kuromoji tokenizer)
- **Chinese**: `text_cjk` (bigrams)
- **Arabic**: `text_ar` (normalization, RTL)

### 3. Test Analyzers Before Indexing

```bash
# Test Italian analyzer
curl "http://localhost:8983/solr/customer_a_pim/analysis/field?analysis.fieldtype=text_it&analysis.fieldvalue=trapano%20battente%20professionale"

# Expected output should show:
# - Tokenization: ["trapano", "battente", "professionale"]
# - Lowercasing: ["trapano", "battente", "professionale"]
# - Stopwords: ["trapano", "battente", "professionale"] (no stopwords removed)
# - Stemming: ["trapan", "battent", "profession"]
```

### 4. Monitor Index Size

```bash
# Check index size
curl "http://localhost:8983/solr/customer_a_pim/admin/luke?numTerms=0" | jq '.index.numDocs'

# Optimize if needed
curl "http://localhost:8983/solr/customer_a_pim/update?optimize=true"
```

### 5. Use Atomic Updates

When updating existing documents, use atomic updates to avoid re-indexing the entire document:

```bash
curl -X POST http://localhost:8983/solr/customer_a_pim/update?commit=true \
  -H "Content-Type: application/json" \
  -d '[
    {
      "id": "BOSCH-PSB-750-RCE",
      "name_text_fr": {"set": "Perceuse Bosch 750W"},
      "price": {"set": 79.99}
    }
  ]'
```

---

## Summary

**Key Points:**

✅ Schema created via Solr Schema API (not XML)
✅ Supports 43 languages with proper analyzers
✅ Zero-downtime language additions
✅ Dynamic fields for future languages
✅ Universal search across all languages
✅ Solr core name matches MongoDB database

**File Reference:**

- Schema Setup: [setup-solr-schema.ts](../vinc-pim/src/scripts/setup-solr-schema.ts)
- Schema Sync: [sync-solr-schema.ts](../vinc-pim/src/scripts/sync-solr-schema.ts)
- Solr Service: [solr-schema.service.ts](../vinc-pim/src/services/solr-schema.service.ts)
- Project Config: [project.config.ts](../vinc-pim/src/config/project.config.ts)

**Related Docs:**

- [Zero-Downtime Language Management](ZERO-DOWNTIME-LANGUAGE-MANAGEMENT.md)
- [Language Management Guide](LANGUAGE-MANAGEMENT-GUIDE.md)
- [Project Configuration](PROJECT-CONFIGURATION.md)

---

**Last Updated:** 2025-11-19
**Version:** 1.0
