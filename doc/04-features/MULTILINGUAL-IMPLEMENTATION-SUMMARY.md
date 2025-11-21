# Multilingual PIM Implementation Summary

Complete multilingual support for 50,000 products across 4 languages: **Italian (IT)**, **German (DE)**, **English (EN)**, and **Czech (CS)**.

---

## 🎯 Architecture Overview

### MongoDB Storage
- **Complete multilingual documents** with all language variants in a single product document
- **Organized by language** using language codes (it, de, en, cs)
- **Flexible structure** supporting partial translations (not all languages required)

### Solr Indexing
- **Single core** with language-specific fields
- **Flattened structure** from MongoDB's nested multilingual objects
- **Language-specific analyzers** for optimal search results
- **Denormalized fields** for fast faceting and filtering

### API Layer
- **Language detection** from user session/profile
- **Dynamic field selection** based on user's language
- **Fallback logic** when translation is missing
- **Single-language responses** to reduce payload size

---

## 📁 Updated Files

### 1. PIM Product Model
**File:** `vinc-pim/src/lib/db/models/pim-product.ts`

**Key Changes:**
- Added `SupportedLanguage` type (`"it" | "de" | "en" | "cs"`)
- Added `MultilingualText` type for text fields organized by language
- Updated all translatable fields to use multilingual structure

**Multilingual Fields:**
- ✅ `name` - Product name
- ✅ `slug` - URL-friendly slug
- ✅ `description` - Full description
- ✅ `short_description` - Short description
- ✅ `long_description` - Long description
- ✅ `product_status_description` - Status description
- ✅ `features` - Marketing highlights (organized by language)
- ✅ `specifications` - Technical data with translated labels
- ✅ `attributes` - Product properties with translated labels
- ✅ `category.name` - Category name
- ✅ `category.slug` - Category slug
- ✅ `collections[].name` - Collection names
- ✅ `collections[].slug` - Collection slugs
- ✅ `tags[].name` - Tag names
- ✅ `product_type.name` - Product type name
- ✅ `product_type.slug` - Product type slug
- ✅ `packaging_options[].label` - Packaging labels
- ✅ `promotions[].label` - Promotion labels
- ✅ `media[].label` - Media file labels
- ✅ `meta_title` - SEO title
- ✅ `meta_description` - SEO description

**Language-Independent Fields:**
- sku, entity_code
- gallery (images are universal)
- quantity, sold, stock_status
- product_model, EAN
- timestamps (created_at, updated_at)
- brand.name (brand names are usually universal)

---

## 📚 Documentation Files

### 2. MongoDB Example
**File:** `product-mongodb-multilingual-example.json`

Shows complete product document structure stored in MongoDB with:
- All multilingual fields organized by language
- Nested structures (features, specifications, attributes)
- Real examples in IT/DE/EN/CS
- Usage notes and access patterns

### 3. Solr Indexing Strategy
**File:** `mongodb-to-solr-multilingual-indexing.json`

Complete indexing guide including:
- Solr schema definition
- TypeScript indexing code
- Search examples per language
- Dynamic language routing
- Performance optimization tips
- Completeness scoring per language

### 4. Full Multilingual Structure Reference
**File:** `product-full-multilingual-structure.json`

Reference document showing:
- All translatable fields with examples in 4 languages
- Proper structure for MongoDB storage
- Field organization patterns

---

## 🔄 Data Structure Patterns

### Pattern 1: Simple Multilingual Text
Used for: name, slug, description, meta_title, meta_description

```typescript
{
  name: {
    it: "Trapano Battente Professionale Bosch PSB 750 RCE 750W",
    de: "Bosch PSB 750 RCE Profi-Schlagbohrmaschine 750W",
    en: "Bosch PSB 750 RCE Professional Hammer Drill 750W",
    cs: "Bosch PSB 750 RCE Profesionální příklepová vrtačka 750W"
  }
}
```

### Pattern 2: Array of Strings (Multilingual)
Used for: features

```typescript
{
  features: {
    it: [
      "Potenza 750W per lavori intensivi",
      "Funzione percussione per muratura"
    ],
    de: [
      "750W Leistung für intensive Arbeiten",
      "Schlagfunktion für Mauerwerk"
    ],
    en: [
      "750W power for intensive work",
      "Hammer function for masonry"
    ],
    cs: [
      "Výkon 750W pro intenzivní práci",
      "Příklepová funkce pro zdivo"
    ]
  }
}
```

### Pattern 3: Array of Objects (Multilingual Labels)
Used for: specifications, attributes

```typescript
{
  specifications: {
    it: [
      { key: "power", label: "Potenza", value: 750, uom: "W" },
      { key: "weight", label: "Peso", value: 2.0, uom: "kg" }
    ],
    de: [
      { key: "power", label: "Leistung", value: 750, uom: "W" },
      { key: "weight", label: "Gewicht", value: 2.0, uom: "kg" }
    ],
    en: [
      { key: "power", label: "Power", value: 750, uom: "W" },
      { key: "weight", label: "Weight", value: 2.0, uom: "kg" }
    ],
    cs: [
      { key: "power", label: "Výkon", value: 750, uom: "W" },
      { key: "weight", label: "Hmotnost", value: 2.0, uom: "kg" }
    ]
  }
}
```

### Pattern 4: Nested Objects with Multilingual Fields
Used for: category, collections, tags

```typescript
{
  category: {
    id: "cat_hammer_drills",
    name: {
      it: "Trapani Battenti",
      de: "Schlagbohrmaschinen",
      en: "Hammer Drills",
      cs: "Příklepové vrtačky"
    },
    slug: {
      it: "trapani-battenti",
      de: "schlagbohrmaschinen",
      en: "hammer-drills",
      cs: "priklepove-vrtacky"
    }
  }
}
```

---

## 🔍 Solr Schema Fields

### Universal Fields
```
id (string)
entity_code (string)
sku (string)
quantity (pint)
stock_status (string)
```

### Language-Specific Name Fields
```
name_it_raw (string) - Exact storage
name_it (text_it)    - Analyzed search
name_de_raw (string)
name_de (text_de)
name_en_raw (string)
name_en (text_en)
name_cs_raw (string)
name_cs (text_general)
```

### Language-Specific Content Fields
```
description_it (text_it)
description_de (text_de)
description_en (text_en)
description_cs (text_general)

features_it (text_it, multiValued)
features_de (text_de, multiValued)
features_en (text_en, multiValued)
features_cs (text_general, multiValued)
```

### JSON Storage Fields
```
specifications_json (string, large=true)
attributes_json (string, large=true)
promotions_json (string, large=true)
media_json (string, large=true)
```

---

## 🔧 Implementation Code Examples

### Accessing Data in TypeScript

```typescript
import { PIMProductModel, SupportedLanguage } from './models/pim-product';

// Get product data for specific language
const getProductForLanguage = async (
  entityCode: string,
  language: SupportedLanguage
) => {
  const product = await PIMProductModel.findOne({
    entity_code: entityCode,
    isCurrent: true,
    status: 'published'
  });

  if (!product) return null;

  return {
    entity_code: product.entity_code,
    sku: product.sku,
    name: product.name?.[language] || product.name?.en,
    description: product.description?.[language] || product.description?.en,
    features: product.features?.[language] || [],
    specifications: product.specifications?.[language] || [],
    attributes: product.attributes?.[language] || [],
    category: {
      id: product.category?.id,
      name: product.category?.name?.[language] || product.category?.name?.en
    }
  };
};

// Usage
const italianProduct = await getProductForLanguage('TOOL-BOSCH-PSB-750-001', 'it');
const germanProduct = await getProductForLanguage('TOOL-BOSCH-PSB-750-001', 'de');
```

### Search in Solr (Dynamic Language)

```typescript
const searchProducts = async (
  query: string,
  userLanguage: SupportedLanguage
) => {
  const searchFields = [
    `name_${userLanguage}:${query}`,
    `description_${userLanguage}:${query}`,
    `features_${userLanguage}:${query}`
  ].join(' OR ');

  const returnFields = [
    'entity_code',
    `name_${userLanguage}_raw`,
    `description_${userLanguage}`,
    'specifications_json',
    'attributes_json'
  ].join(',');

  const results = await solrClient.search({
    q: searchFields,
    fl: returnFields,
    rows: 20
  });

  // Parse JSON fields and extract language-specific data
  return results.docs.map(doc => ({
    entity_code: doc.entity_code,
    name: doc[`name_${userLanguage}_raw`],
    description: doc[`description_${userLanguage}`],
    specifications: JSON.parse(doc.specifications_json)[userLanguage],
    attributes: JSON.parse(doc.attributes_json)[userLanguage]
  }));
};
```

---

## 📊 Data Completeness Scoring

Calculate completeness per language to determine if product should be indexed:

```typescript
const calculateCompleteness = (
  product: IPIMProduct,
  language: SupportedLanguage
): number => {
  const checks = [
    !!product.name?.[language],
    !!product.description?.[language],
    !!product.short_description?.[language],
    product.features?.[language]?.length > 0,
    product.specifications?.[language]?.length > 0,
    product.attributes?.[language]?.length > 0,
    !!product.category?.name?.[language],
    !!product.meta_title?.[language],
    !!product.meta_description?.[language]
  ];

  const completedChecks = checks.filter(Boolean).length;
  return Math.round((completedChecks / checks.length) * 100);
};

// Only index if completeness >= 80%
const italianCompleteness = calculateCompleteness(product, 'it');
if (italianCompleteness >= 80) {
  // Index Italian fields to Solr
}
```

---

## 🚀 Migration Guide

### Option 1: Gradual Migration (Recommended)
1. Keep existing single-language data as-is
2. Add multilingual structure alongside
3. Populate translations over time
4. Switch to multilingual API responses once data is complete

### Option 2: One-Time Migration
1. Export existing products
2. Transform to multilingual structure (put existing data in `it` or `en`)
3. Import transformed data
4. Add translations for other languages

### Migration Script Example

```typescript
// Migrate existing single-language products to multilingual
const migrateToMultilingual = async () => {
  const products = await PIMProductModel.find({
    // Find products without multilingual structure
    'name.it': { $exists: false }
  });

  for (const product of products) {
    // Assume existing data is Italian
    const updates = {
      name: {
        it: product.name as any, // Cast old string to object
        de: null,
        en: null,
        cs: null
      },
      description: {
        it: product.description as any,
        de: null,
        en: null,
        cs: null
      },
      // ... repeat for other fields
    };

    await PIMProductModel.updateOne(
      { _id: product._id },
      { $set: updates }
    );
  }
};
```

---

## ✅ Testing Checklist

- [ ] MongoDB schema accepts multilingual data
- [ ] All 4 languages can be stored (IT, DE, EN, CS)
- [ ] Partial translations work (not all languages required)
- [ ] Data can be accessed by language code
- [ ] Fallback logic works when translation is missing
- [ ] Solr indexing transforms MongoDB structure correctly
- [ ] Language-specific search works for each language
- [ ] API returns data in user's language only
- [ ] Special characters (accents, umlauts) are handled correctly
- [ ] Completeness scoring works per language
- [ ] Performance is acceptable (< 100ms search time)

---

## 📈 Performance Metrics

### Expected Performance (50k products)

**MongoDB:**
- Document size: ~50-100KB per product (all languages)
- Total storage: ~2.5GB - 5GB
- Query time: < 10ms (indexed fields)

**Solr:**
- Index size: ~500MB - 1GB (with all language fields)
- Indexing time: 5-10 minutes (full reindex)
- Query time: < 50ms (typical search)
- Faceting time: < 100ms

**API:**
- Response time: < 200ms (MongoDB + Solr + transformation)
- Payload size: ~5-10KB per product (single language)

---

## 🎓 Best Practices

1. **Always provide fallback languages**
   ```typescript
   const text = product.name?.[lang] || product.name?.en || product.name?.it || '';
   ```

2. **Use JSON.stringify() for Solr JSON fields**
   ```typescript
   promotions_json: JSON.stringify(product.promotions)  // Handles special chars
   ```

3. **Index only complete translations**
   ```typescript
   if (calculateCompleteness(product, 'de') >= 80) {
     doc.name_de = product.name.de;
   }
   ```

4. **Cache language-specific responses**
   ```typescript
   const cacheKey = `product:${entityCode}:${language}`;
   ```

5. **Validate language codes**
   ```typescript
   const validLanguages: SupportedLanguage[] = ['it', 'de', 'en', 'cs'];
   if (!validLanguages.includes(userLang)) {
     userLang = 'en'; // fallback
   }
   ```

---

## 📞 Support

For questions or issues with the multilingual implementation:
1. Check this documentation
2. Review example files (product-mongodb-multilingual-example.json)
3. See indexing guide (mongodb-to-solr-multilingual-indexing.json)
4. Check Solr strategy (solr-multilingual-strategy-50k.json)

---

## 🔗 Related Files

- `vinc-pim/src/lib/db/models/pim-product.ts` - Updated model with multilingual support
- `product-mongodb-multilingual-example.json` - Complete MongoDB example
- `mongodb-to-solr-multilingual-indexing.json` - Indexing guide
- `product-full-multilingual-structure.json` - Multilingual structure reference
- `solr-multilingual-strategy-50k.json` - Solr strategy for 50k items
- `product-special-chars-example.json` - Special characters handling

---

**Last Updated:** 2024-11-19
**Version:** 1.0
**Languages Supported:** IT, DE, EN, CS
