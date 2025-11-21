# Language Management Guide

Complete guide for enabling/disabling languages in the PIM system with automatic Solr schema updates.

---

## Overview

The PIM system supports 43 languages out of the box, with 4 enabled by default (IT, DE, EN, CS). Admins can enable additional languages without code changes, and the system will automatically update both MongoDB schemas and Solr search indexes.

---

## Quick Start

### 1. List Available Languages

```bash
npx ts-node src/scripts/manage-languages.ts list
```

Output:
```
📋 Available Languages:

Code  Name                     Native Name          Status         Default
────────────────────────────────────────────────────────────────────────────
it    Italian                  Italiano             ✅ Enabled      ⭐
de    German                   Deutsch              ✅ Enabled
en    English                  English              ✅ Enabled
cs    Czech                    Čeština              ✅ Enabled
fr    French                   Français             ⭕ Disabled
es    Spanish                  Español              ⭕ Disabled
...
```

### 2. Enable Languages

```bash
# Enable French and Spanish
npx ts-node src/scripts/manage-languages.ts enable fr es
```

This will:
1. ✅ Update MongoDB to set `isEnabled: true`
2. ✅ Automatically add Solr fields for the new languages:
   - `name_text_fr`, `description_text_fr`, `features_text_fr`, etc.
   - `name_text_es`, `description_text_es`, `features_text_es`, etc.
3. ✅ Create Solr field types if they don't exist (`text_fr`, `text_es`)

**Important:** Changes are live immediately - **no restart needed**. The system uses runtime validation with a 5-minute cache.

### 3. Disable Languages

```bash
# Disable French
npx ts-node src/scripts/manage-languages.ts disable fr
```

**Note:** Disabling a language does NOT remove Solr fields (they may contain data). If you need to remove fields, see the [Removing Language Fields](#removing-language-fields-from-solr) section.

---

## CLI Commands

### List Languages
```bash
npx ts-node src/scripts/manage-languages.ts list
```

Shows all available languages with their status.

### Enable Language(s)
```bash
# Enable single language
npx ts-node src/scripts/manage-languages.ts enable fr

# Enable multiple languages
npx ts-node src/scripts/manage-languages.ts enable fr es pt nl

# Enable without updating Solr (if you want to update Solr manually later)
npx ts-node src/scripts/manage-languages.ts enable fr --skip-solr
```

### Disable Language(s)
```bash
# Disable single language
npx ts-node src/scripts/manage-languages.ts disable fr

# Disable multiple languages
npx ts-node src/scripts/manage-languages.ts disable fr es
```

**Note:** You cannot disable the default language.

### Set Default Language
```bash
npx ts-node src/scripts/manage-languages.ts set-default de
```

The default language is used as the fallback when a translation is missing.

### Sync Solr Schema
```bash
npx ts-node src/scripts/sync-solr-schema.ts
```

Ensures Solr has all fields for currently enabled languages. Use this if:
- You enabled languages with `--skip-solr`
- Solr schema update failed during enable
- You manually modified the language configuration

---

## REST API

### Get All Languages
```http
GET /api/languages
GET /api/languages?includeDisabled=true
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "code": "it",
      "name": "Italian",
      "nativeName": "Italiano",
      "isDefault": true,
      "isEnabled": true,
      "solrAnalyzer": "text_it",
      "direction": "ltr"
    }
  ],
  "count": 4
}
```

### Enable/Disable Language
```http
PATCH /api/languages/:code/enable
Content-Type: application/json

{
  "enabled": true,
  "updateSolr": true
}
```

Response:
```json
{
  "success": true,
  "message": "Language 'fr' enabled successfully",
  "note": "Restart application for schema changes to take effect"
}
```

### Set Default Language
```http
PATCH /api/languages/:code/set-default
```

### Sync Solr Schema
```http
POST /api/languages/sync-solr
```

Response:
```json
{
  "success": true,
  "message": "Solr schema synced successfully for 6 languages",
  "languages": [
    { "code": "it", "name": "Italian" },
    { "code": "de", "name": "German" },
    ...
  ]
}
```

---

## How It Works

### When You Enable a Language

1. **MongoDB Update**
   - Language document updated: `{ isEnabled: true }`

2. **Solr Field Type Creation**
   - Checks if field type exists (e.g., `text_fr`)
   - If not, creates it with appropriate analyzer:
     ```xml
     <fieldType name="text_fr" class="solr.TextField">
       <analyzer>
         <tokenizer class="solr.StandardTokenizerFactory"/>
         <filter class="solr.ElisionFilterFactory"/>
         <filter class="solr.LowerCaseFilterFactory"/>
         <filter class="solr.StopFilterFactory" words="lang/stopwords_fr.txt"/>
         <filter class="solr.FrenchLightStemFilterFactory"/>
       </analyzer>
     </fieldType>
     ```

3. **Solr Field Creation**
   - Creates fields for all product attributes:
     - `name_text_fr`
     - `description_text_fr`
     - `shortDescription_text_fr`
     - `technicalData_text_fr`
     - `features_text_fr` (multiValued)
     - `seoTitle_text_fr`
     - `seoDescription_text_fr`
     - `seoKeywords_text_fr` (multiValued)

4. **Application Restart Required**
   - Restart your app so MongoDB schemas regenerate to include the new language

5. **Reindex Products** (if you have existing products)
   - Products need to be reindexed to populate new Solr fields

### When You Disable a Language

1. **MongoDB Update**
   - Language document updated: `{ isEnabled: false }`

2. **Solr Fields Remain**
   - Fields are NOT removed (they may contain data)
   - New products won't use these fields
   - Existing data remains searchable

3. **Application Restart Required**
   - Restart your app so schemas no longer include this language

---

## Supported Languages

### Currently Enabled (4)
- 🇮🇹 Italian (it) - Default
- 🇩🇪 German (de)
- 🇬🇧 English (en)
- 🇨🇿 Czech (cs)

### Ready to Enable (39)

**Western European:** FR, ES, PT, NL, CA
**Nordic:** SV, DA, FI, NO, IS
**Central/Eastern European:** PL, HU, RO, SK, SL, HR, SR, BG, MK, SQ
**Baltic:** ET, LV, LT
**Other European:** EL, RU, UK, BE, TR
**Middle Eastern/RTL:** AR, HE, FA
**Asian:** JA, ZH, KO, TH, VI, ID, MS, HI

Each language is configured with:
- Appropriate Solr analyzer (language-specific stemming, stopwords)
- Text direction (LTR/RTL)
- Date and number formats
- Native language names

---

## Solr Analyzers

The system automatically configures language-specific analyzers:

| Language | Analyzer | Features |
|----------|----------|----------|
| Italian (it) | `text_it` | Italian stemming, stopwords |
| German (de) | `text_de` | German normalization, compound splitting |
| English (en) | `text_en` | Porter stemmer, English stopwords |
| French (fr) | `text_fr` | Elision, French stemming |
| Spanish (es) | `text_es` | Spanish stemming, stopwords |
| Russian (ru) | `text_ru` | Cyrillic support, Russian stemming |
| Arabic (ar) | `text_ar` | Arabic normalization, RTL support |
| Japanese (ja) | `text_ja` | Kuromoji tokenizer, morphological analysis |
| Chinese (zh) | `text_cjk` | CJK bigram tokenization |
| Others | `text_general` | Basic tokenization, lowercasing |

---

## Workflow Examples

### Example 1: Adding French Support

```bash
# 1. Enable French
npx ts-node src/scripts/manage-languages.ts enable fr

# 2. Verify in MongoDB
# Language 'fr' now has isEnabled: true

# 3. Verify in Solr
# Check: http://localhost:8983/solr/#/pim-products/schema
# New fields: name_text_fr, description_text_fr, etc.

# 4. Restart application
pm2 restart vinc-pim

# 5. Test with a product
# POST /api/products
{
  "name": {
    "it": "Tavolo",
    "de": "Tisch",
    "en": "Table",
    "fr": "Table"  // ✅ Now accepted
  }
}
```

### Example 2: Enabling Multiple Languages at Once

```bash
# Enable all Western European languages
npx ts-node src/scripts/manage-languages.ts enable fr es pt nl ca

# Output:
# ✅ fr (French) - enabled in database
# ✅ es (Spanish) - enabled in database
# ✅ pt (Portuguese) - enabled in database
# ✅ nl (Dutch) - enabled in database
# ✅ ca (Catalan) - enabled in database
#
# 🔧 Updating Solr schema...
# ✅ Added field type 'text_fr' to Solr schema
# ✅ Added field 'name_text_fr'
# ✅ Added field 'description_text_fr'
# ...
```

### Example 3: Enabling Asian Languages

```bash
# Enable Japanese and Chinese
npx ts-node src/scripts/manage-languages.ts enable ja zh

# Solr will configure:
# - text_ja with Kuromoji tokenizer (Japanese morphological analysis)
# - text_cjk with CJK bigram tokenizer (Chinese character-based)
```

---

## Troubleshooting

### Solr Update Failed During Enable

If Solr schema update fails:

```bash
# 1. Check if Solr is running
curl http://localhost:8983/solr/admin/info/system

# 2. Manually sync Solr schema
npx ts-node src/scripts/sync-solr-schema.ts

# Or via API:
curl -X POST http://localhost:3000/api/languages/sync-solr
```

### Language Not Showing in API

If enabled language doesn't appear in product validation:

```bash
# 1. Restart application (schemas need to regenerate)
pm2 restart vinc-pim

# 2. Clear language cache
curl -X POST http://localhost:3000/api/languages/refresh-cache
```

### Cannot Disable Default Language

```bash
# Error: Cannot disable default language

# Solution: Set a different default first
npx ts-node src/scripts/manage-languages.ts set-default en
npx ts-node src/scripts/manage-languages.ts disable it
```

### Removing Language Fields from Solr

Solr doesn't allow deleting fields that contain data. To remove language fields:

```bash
# 1. Backup your Solr data
curl "http://localhost:8983/solr/pim-products/replication?command=backup"

# 2. Delete all documents
curl "http://localhost:8983/solr/pim-products/update?commit=true" \
  -H "Content-Type: text/xml" \
  --data-binary '<delete><query>*:*</query></delete>'

# 3. Manually edit schema or recreate collection

# 4. Reindex with only enabled languages
```

---

## Environment Variables

Configure Solr connection in `.env`:

```env
SOLR_HOST=localhost
SOLR_PORT=8983
SOLR_CORE=pim-products
```

---

## Best Practices

1. **Enable languages during low traffic**
   - Schema updates require application restart

2. **Test with one language first**
   - Verify the complete workflow before enabling many languages

3. **Monitor Solr schema size**
   - Each language adds 8+ fields per product
   - 43 languages = ~350 fields

4. **Use appropriate analyzers**
   - Language-specific analyzers improve search quality
   - Generic `text_general` works but less accurate

5. **RTL languages need frontend support**
   - Arabic, Hebrew, Persian require RTL CSS and display logic

6. **Keep languages synchronized**
   - MongoDB schemas and Solr fields should match
   - Use `sync-solr-schema.ts` if they get out of sync

---

## API Integration Example

```typescript
// Admin panel: Enable language
async function enableLanguage(code: string) {
  const response = await fetch(`/api/languages/${code}/enable`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: true, updateSolr: true })
  });

  const result = await response.json();

  if (result.success) {
    alert(`${code} enabled! Restart app to complete.`);
  }
}

// Get available languages for selection
async function getAvailableLanguages() {
  const response = await fetch('/api/languages?includeDisabled=true');
  const { data } = await response.json();

  return data.filter(lang => !lang.isEnabled);
}
```

---

## Next Steps

After enabling a language:

1. ✅ **Restart Application** - `pm2 restart vinc-pim`
2. ✅ **Verify Schema** - Check Solr at `http://localhost:8983/solr/#/pim-products/schema`
3. ✅ **Test Product Creation** - Create product with new language
4. ✅ **Reindex Existing Products** - If you have existing products
5. ✅ **Update Frontend** - Add language selector for new languages
6. ✅ **Configure Translations** - Add UI translations for the language

---

**Last Updated:** 2025-11-19
**Related Docs:**
- [MULTILINGUAL-IMPLEMENTATION-SUMMARY.md](./MULTILINGUAL-IMPLEMENTATION-SUMMARY.md)
- [DYNAMIC-LANGUAGE-GUIDE.md](./DYNAMIC-LANGUAGE-GUIDE.md)
