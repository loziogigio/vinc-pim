# Dynamic Language Support Guide

Complete guide for the dynamic multilingual system - add/remove languages without changing code!

---

## 🎯 Overview

The system now supports **dynamic language configuration**. Simply update the language config file to add new languages - no need to modify the database schema or TypeScript types!

### Key Benefits

✅ **Zero code changes** to add/remove languages
✅ **Configuration-driven** - update one file
✅ **Backward compatible** - existing products work seamlessly
✅ **Type-safe** - TypeScript types automatically update
✅ **Automatic schema generation** - Mongoose schemas adapt dynamically

---

## 📁 Architecture

### Configuration File
**[vinc-pim/src/config/languages.ts](vinc-pim/src/config/languages.ts)**

Central configuration for all supported languages. Simply add/remove entries here.

### Model Updates
**[vinc-pim/src/lib/db/models/pim-product.ts](vinc-pim/src/lib/db/models/pim-product.ts)**

- Uses `Record<string, string>` instead of hardcoded language unions
- Dynamically generates Mongoose schemas from config
- Automatically includes all enabled languages

---

## 🔧 Adding a New Language

### Step 1: Add to Configuration

Edit `vinc-pim/src/config/languages.ts`:

```typescript
export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  // ... existing languages ...

  // ✅ Add French
  {
    code: "fr",
    name: "French",
    nativeName: "Français",
    isDefault: false,
    isEnabled: true,
    solrAnalyzer: "text_fr",
    direction: "ltr",
    dateFormat: "DD/MM/YYYY",
    numberFormat: "fr-FR"
  },
];
```

**That's it for MongoDB!** The schema automatically updates on next restart.

### Step 2: Update Solr Schema (Manual)

Add French fields to your Solr schema:

```xml
<!-- French fields -->
<field name="name_fr_raw" type="string" indexed="false" stored="true"/>
<field name="name_fr" type="text_fr" indexed="true" stored="false"/>
<field name="description_fr" type="text_fr" indexed="true" stored="false"/>
<field name="features_fr" type="text_fr" indexed="true" stored="false" multiValued="true"/>
<field name="category_name_fr" type="text_fr" indexed="true" stored="true"/>

<!-- French analyzer -->
<fieldType name="text_fr" class="solr.TextField">
  <analyzer>
    <tokenizer class="solr.StandardTokenizerFactory"/>
    <filter class="solr.ElisionFilterFactory" articles="lang/contractions_fr.txt"/>
    <filter class="solr.LowerCaseFilterFactory"/>
    <filter class="solr.StopFilterFactory" words="lang/stopwords_fr.txt"/>
    <filter class="solr.FrenchLightStemFilterFactory"/>
    <filter class="solr.ASCIIFoldingFilterFactory"/>
  </analyzer>
</fieldType>
```

### Step 3: Update Indexing Code

The indexing code automatically adapts:

```typescript
import { getLanguageCodes } from '../config/languages';

const indexProduct = (product: IPIMProduct) => {
  const doc: any = {
    id: product.entity_code,
    sku: product.sku,
  };

  // ✅ Automatically loops through all configured languages
  getLanguageCodes().forEach(lang => {
    if (product.name?.[lang]) {
      doc[`name_${lang}_raw`] = product.name[lang];
      doc[`name_${lang}`] = product.name[lang];
    }
    if (product.description?.[lang]) {
      doc[`description_${lang}`] = product.description[lang];
    }
    if (product.features?.[lang]) {
      doc[`features_${lang}`] = product.features[lang];
    }
  });

  return doc;
};
```

---

## 🚀 Using the Dynamic System

### Access Language Configuration

```typescript
import {
  getEnabledLanguages,
  getLanguageCodes,
  getDefaultLanguage,
  getLanguageByCode,
  isValidLanguageCode
} from './config/languages';

// Get all enabled language codes
const codes = getLanguageCodes();
// Returns: ["it", "de", "en", "cs", "fr"]

// Get full config for a language
const french = getLanguageByCode("fr");
// Returns: { code: "fr", name: "French", ... }

// Get default language
const defaultLang = getDefaultLanguage();
// Returns: { code: "it", name: "Italian", isDefault: true, ... }

// Validate language code
if (isValidLanguageCode(userLang)) {
  // Use it safely
}
```

### Store Multilingual Data

```typescript
import { PIMProductModel } from './models/pim-product';

// ✅ Works with any configured language
const product = new PIMProductModel({
  sku: "PRODUCT-001",
  name: {
    it: "Prodotto esempio",
    de: "Beispielprodukt",
    en: "Example product",
    cs: "Příkladový produkt",
    fr: "Produit d'exemple"  // ✅ Automatically supported
  },
  description: {
    it: "Descrizione in italiano",
    de: "Beschreibung auf Deutsch",
    en: "Description in English",
    cs: "Popis v češtině",
    fr: "Description en français"  // ✅ Automatically supported
  }
});

await product.save();
```

### Retrieve Data by Language

```typescript
const getProductInLanguage = async (
  entityCode: string,
  languageCode: string
) => {
  const product = await PIMProductModel.findOne({
    entity_code: entityCode
  });

  if (!product) return null;

  // ✅ Access any configured language dynamically
  return {
    name: product.name?.[languageCode],
    description: product.description?.[languageCode],
    features: product.features?.[languageCode],
    specifications: product.specifications?.[languageCode],
    attributes: product.attributes?.[languageCode]
  };
};

// Usage
const frenchProduct = await getProductInLanguage('PRODUCT-001', 'fr');
const italianProduct = await getProductInLanguage('PRODUCT-001', 'it');
```

### Fallback Logic

```typescript
import { getDefaultLanguage } from './config/languages';

const getTextWithFallback = (
  multilingualText: Record<string, string> | undefined,
  preferredLanguage: string
): string => {
  if (!multilingualText) return '';

  // Try preferred language
  if (multilingualText[preferredLanguage]) {
    return multilingualText[preferredLanguage];
  }

  // Fall back to default language
  const defaultLang = getDefaultLanguage();
  if (multilingualText[defaultLang.code]) {
    return multilingualText[defaultLang.code];
  }

  // Fall back to any available language
  const availableLanguages = Object.keys(multilingualText);
  if (availableLanguages.length > 0) {
    return multilingualText[availableLanguages[0]];
  }

  return '';
};

// Usage
const productName = getTextWithFallback(product.name, 'fr');
```

---

## 🔄 Disabling a Language

To temporarily disable a language without removing data:

```typescript
{
  code: "cs",
  name: "Czech",
  nativeName: "Čeština",
  isDefault: false,
  isEnabled: false,  // ✅ Set to false
  solrAnalyzer: "text_general",
  direction: "ltr"
}
```

**Effect:**
- MongoDB data remains intact
- `getLanguageCodes()` excludes this language
- APIs won't return this language
- Easy to re-enable later

---

## 📊 Data Completeness Per Language

Check which languages are complete:

```typescript
import { getLanguageCodes } from './config/languages';

const calculateCompleteness = (
  product: IPIMProduct,
  languageCode: string
): number => {
  const checks = [
    !!product.name?.[languageCode],
    !!product.description?.[languageCode],
    !!product.short_description?.[languageCode],
    product.features?.[languageCode]?.length > 0,
    product.specifications?.[languageCode]?.length > 0,
    product.attributes?.[languageCode]?.length > 0,
    !!product.category?.name?.[languageCode],
    !!product.meta_title?.[languageCode],
    !!product.meta_description?.[languageCode]
  ];

  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
};

const getProductCompleteness = (product: IPIMProduct) => {
  const completeness: Record<string, number> = {};

  getLanguageCodes().forEach(lang => {
    completeness[lang] = calculateCompleteness(product, lang);
  });

  return completeness;
};

// Usage
const completeness = getProductCompleteness(product);
// Returns: { it: 100, de: 95, en: 90, cs: 85, fr: 45 }
```

---

## 🌍 Frontend Integration

### API Endpoint Example

```typescript
import { getLanguageCodes, isValidLanguageCode } from '../config/languages';

app.get('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const { lang = 'it' } = req.query;

  // Validate language
  if (!isValidLanguageCode(lang as string)) {
    return res.status(400).json({
      error: 'Invalid language code',
      supported: getLanguageCodes()
    });
  }

  const product = await PIMProductModel.findOne({ entity_code: id });

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Return data in requested language only
  res.json({
    entity_code: product.entity_code,
    sku: product.sku,
    name: product.name?.[lang as string],
    description: product.description?.[lang as string],
    features: product.features?.[lang as string],
    specifications: product.specifications?.[lang as string],
    attributes: product.attributes?.[lang as string],
    category: {
      id: product.category?.id,
      name: product.category?.name?.[lang as string]
    }
  });
});
```

### Language Selector

```typescript
import { getEnabledLanguages } from '../config/languages';

app.get('/api/languages', (req, res) => {
  const languages = getEnabledLanguages().map(lang => ({
    code: lang.code,
    name: lang.name,
    nativeName: lang.nativeName,
    isDefault: lang.isDefault
  }));

  res.json({ languages });
});

// Response:
// {
//   "languages": [
//     { "code": "it", "name": "Italian", "nativeName": "Italiano", "isDefault": true },
//     { "code": "de", "name": "German", "nativeName": "Deutsch", "isDefault": false },
//     { "code": "en", "name": "English", "nativeName": "English", "isDefault": false },
//     { "code": "fr", "name": "French", "nativeName": "Français", "isDefault": false }
//   ]
// }
```

---

## 🔍 Search with Dynamic Languages

```typescript
import { getLanguageCodes } from '../config/languages';

const searchProducts = async (query: string, userLanguage: string) => {
  // Build dynamic Solr query
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

  return results.docs;
};
```

---

## 🛠️ Migration Tools

### Add New Language to Existing Products

```typescript
import { getLanguageCodes } from './config/languages';

const addLanguageToProducts = async (newLangCode: string, sourceLangCode: string) => {
  const products = await PIMProductModel.find({
    [`name.${newLangCode}`]: { $exists: false }
  });

  for (const product of products) {
    const updates: any = {};

    // Copy from source language with "[NEW LANG]" marker
    if (product.name?.[sourceLangCode]) {
      updates[`name.${newLangCode}`] =
        `${product.name[sourceLangCode]} [${newLangCode.toUpperCase()} - TO TRANSLATE]`;
    }

    if (product.description?.[sourceLangCode]) {
      updates[`description.${newLangCode}`] =
        `${product.description[sourceLangCode]} [TO TRANSLATE]`;
    }

    await PIMProductModel.updateOne({ _id: product._id }, { $set: updates });
  }

  console.log(`Added ${newLangCode} placeholders to ${products.length} products`);
};

// Usage: Add French from English
await addLanguageToProducts('fr', 'en');
```

### Bulk Language Completeness Report

```typescript
const generateLanguageReport = async () => {
  const products = await PIMProductModel.find({ status: 'published' });
  const languages = getLanguageCodes();

  const report: Record<string, { total: number; complete: number; percentage: number }> = {};

  languages.forEach(lang => {
    report[lang] = { total: products.length, complete: 0, percentage: 0 };
  });

  products.forEach(product => {
    languages.forEach(lang => {
      const completeness = calculateCompleteness(product, lang);
      if (completeness >= 80) {
        report[lang].complete++;
      }
    });
  });

  languages.forEach(lang => {
    report[lang].percentage = Math.round(
      (report[lang].complete / report[lang].total) * 100
    );
  });

  return report;
};

// Usage
const report = await generateLanguageReport();
// Returns: {
//   it: { total: 1000, complete: 1000, percentage: 100 },
//   de: { total: 1000, complete: 950, percentage: 95 },
//   en: { total: 1000, complete: 900, percentage: 90 },
//   fr: { total: 1000, complete: 200, percentage: 20 }
// }
```

---

## ✅ Advantages of Dynamic System

| Feature | Hardcoded | Dynamic |
|---------|-----------|---------|
| Add new language | Edit 10+ files | Edit 1 config file |
| Type safety | ✅ Strong | ✅ Flexible |
| Schema updates | Manual | Automatic |
| Language validation | Compile-time | Runtime |
| Config management | Spread across code | Centralized |
| Deployment | Code changes + restart | Config update + restart |
| Solr schema | Manual | Manual (but templated) |

---

## 🎓 Best Practices

1. **Always validate language codes at runtime**
   ```typescript
   if (!isValidLanguageCode(userLang)) {
     throw new Error('Unsupported language');
   }
   ```

2. **Use default language as fallback**
   ```typescript
   const text = product.name?.[lang] || product.name?.[getDefaultLanguage().code];
   ```

3. **Check language availability before indexing**
   ```typescript
   getLanguageCodes().forEach(lang => {
     if (product.name?.[lang]) {
       // Index this language
     }
   });
   ```

4. **Document your language config**
   - Add comments for analyzer choices
   - Note any special requirements per language
   - Track Solr schema version compatibility

5. **Test with new languages**
   - Add test data in new language
   - Verify search works correctly
   - Check completeness calculations

---

## 📞 Support

When adding a new language:
1. Update `vinc-pim/src/config/languages.ts`
2. Restart application (schema auto-updates)
3. Update Solr schema manually
4. Restart Solr
5. Reindex products with new language fields
6. Test search and display

---

**Last Updated:** 2024-11-19
**System Version:** Dynamic Language Support v2.0
