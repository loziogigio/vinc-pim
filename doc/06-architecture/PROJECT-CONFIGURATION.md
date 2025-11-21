# Project Configuration Guide

**Multitenant PIM Architecture - Project-Specific Configuration**

---

## Architecture Overview

```
┌────────────────────────────────────────────────┐
│  Project: Customer A                           │
├────────────────────────────────────────────────┤
│  MongoDB Database: customer_a_pim              │
│  Solr Core:        customer_a_pim  ← MUST MATCH│
│  Default Language: it (Italian)                │
│  Enabled Languages: it, de, en, cs             │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│  Project: Customer B                           │
├────────────────────────────────────────────────┤
│  MongoDB Database: customer_b_pim              │
│  Solr Core:        customer_b_pim  ← MUST MATCH│
│  Default Language: it (Italian)                │
│  Enabled Languages: it, de, fr, es             │
└────────────────────────────────────────────────┘
```

---

## Key Principles

### 1. Solr Core = MongoDB Database Name

**ALWAYS**: Solr core name must be identical to MongoDB database name

```env
# ✅ CORRECT
MONGODB_DATABASE=customer_a_pim
SOLR_CORE=customer_a_pim

# ❌ WRONG
MONGODB_DATABASE=customer_a_pim
SOLR_CORE=pim-products  # Different name!
```

**Why?**
- Simplifies multi-project management
- Makes it obvious which Solr core serves which database
- Prevents data leakage between projects
- Easier backup/restore operations

### 2. Default Language = Italian (it)

**Business Requirement**: Italian is always the default and fallback language

```typescript
// Product MUST have Italian translations
{
  "name": {
    "it": "Trapano Bosch 750W",  // ✅ Required
    "de": "Bosch Bohrmaschine 750W",  // Optional
    "en": "Bosch Drill 750W"  // Optional
  }
}
```

**Fallback Logic**:
```typescript
function getProductName(product, requestedLang) {
  return product.name[requestedLang]
      || product.name.it  // Always fall back to Italian
      || product.name[Object.keys(product.name)[0]];  // Last resort
}
```

### 3. Italian Always Enabled

Italian cannot be disabled - it's enforced at the configuration level:

```typescript
// Validation in project.config.ts
if (!config.enabledLanguages.includes("it")) {
  throw new Error("Italian (it) must always be enabled");
}
```

---

## Environment Variables

### Required Variables

```env
# Project Identification
PROJECT_ID=customer_a

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=customer_a_pim

# Solr Configuration
SOLR_HOST=localhost
SOLR_PORT=8983
# Solr core is automatically set to match MONGODB_DATABASE

# Language Configuration
DEFAULT_LANGUAGE=it
ENABLED_LANGUAGES=it,de,en,cs
```

### Optional Variables

```env
# Cache settings
LANGUAGE_CACHE_TTL=300000  # 5 minutes in milliseconds

# Feature flags
AUTO_PUBLISH_ENABLED=true
MIN_COMPLETENESS_SCORE=80
```

---

## MongoDB Multilingual Structure

### Product Name (Multilingual)

```json
{
  "name": {
    "it": "Trapano Battente Professionale Bosch PSB 750 RCE 750W",
    "de": "Bosch PSB 750 RCE Profi-Schlagbohrmaschine 750W",
    "en": "Bosch PSB 750 RCE Professional Hammer Drill 750W",
    "cs": "Bosch PSB 750 RCE Profesionální příklepová vrtačka 750W"
  }
}
```

### Product Description (Multilingual)

```json
{
  "description": {
    "it": "Il trapano a percussione professionale Bosch PSB 750 RCE...",
    "de": "Die Bosch PSB 750 RCE Profi-Schlagbohrmaschine...",
    "en": "The Bosch PSB 750 RCE professional hammer drill...",
    "cs": "Profesionální příklepová vrtačka Bosch PSB 750 RCE..."
  }
}
```

### Features (Multilingual Array)

```json
{
  "features": {
    "it": [
      "Rivestimento Soft-Grip per impugnatura antiscivolo",
      "Cambio elettronico intelligente della velocità",
      "Mandrino autoserrante 13mm"
    ],
    "de": [
      "Soft-Grip-Beschichtung für rutschfesten Griff",
      "Intelligente elektronische Drehzahlregelung",
      "Selbstspannfutter 13mm"
    ],
    "en": [
      "Soft-Grip coating for non-slip handle",
      "Intelligent electronic speed control",
      "Self-tightening chuck 13mm"
    ],
    "cs": [
      "Soft-Grip povlak pro protiskluzovou rukojeť",
      "Inteligentní elektronická regulace otáček",
      "Samosvorné sklíčidlo 13mm"
    ]
  }
}
```

### Specifications (Multilingual Labels)

```json
{
  "specifications": {
    "it": [
      {
        "key": "power",
        "label": "Potenza nominale",
        "value": 750,
        "uom": "W",
        "category": "Electrical"
      },
      {
        "key": "weight",
        "label": "Peso",
        "value": 2.0,
        "uom": "kg",
        "category": "Physical"
      }
    ],
    "de": [
      {
        "key": "power",
        "label": "Nennleistung",
        "value": 750,
        "uom": "W",
        "category": "Electrical"
      },
      {
        "key": "weight",
        "label": "Gewicht",
        "value": 2.0,
        "uom": "kg",
        "category": "Physical"
      }
    ],
    "en": [
      {
        "key": "power",
        "label": "Rated power",
        "value": 750,
        "uom": "W",
        "category": "Electrical"
      },
      {
        "key": "weight",
        "label": "Weight",
        "value": 2.0,
        "uom": "kg",
        "category": "Physical"
      }
    ],
    "cs": [
      {
        "key": "power",
        "label": "Jmenovitý výkon",
        "value": 750,
        "uom": "W",
        "category": "Electrical"
      },
      {
        "key": "weight",
        "label": "Hmotnost",
        "value": 2.0,
        "uom": "kg",
        "category": "Physical"
      }
    ]
  }
}
```

---

## Solr Indexing Structure

### Field Naming Convention

For each multilingual field, create language-specific Solr fields:

```
name_text_it    ← Italian name with Italian analyzer
name_text_de    ← German name with German analyzer
name_text_en    ← English name with English analyzer
name_text_cs    ← Czech name with Czech analyzer
```

### Solr Document Example

```json
{
  "id": "BOSCH-PSB-750-RCE",
  "sku": "BOSCH-PSB-750-RCE",

  "name_text_it": "Trapano Battente Professionale Bosch PSB 750 RCE 750W",
  "name_text_de": "Bosch PSB 750 RCE Profi-Schlagbohrmaschine 750W",
  "name_text_en": "Bosch PSB 750 RCE Professional Hammer Drill 750W",
  "name_text_cs": "Bosch PSB 750 RCE Profesionální příklepová vrtačka 750W",

  "description_text_it": "Il trapano a percussione professionale...",
  "description_text_de": "Die Bosch PSB 750 RCE Profi-Schlagbohrmaschine...",
  "description_text_en": "The Bosch PSB 750 RCE professional hammer drill...",
  "description_text_cs": "Profesionální příklepová vrtačka Bosch PSB 750 RCE...",

  "features_text_it": [
    "Rivestimento Soft-Grip per impugnatura antiscivolo",
    "Cambio elettronico intelligente della velocità"
  ],
  "features_text_de": [
    "Soft-Grip-Beschichtung für rutschfesten Griff",
    "Intelligente elektronische Drehzahlregelung"
  ],

  "category_name": "Trapani",
  "brand_name": "Bosch Professional",

  "price": 89.99,
  "stock_status": "in_stock",
  "quantity": 450
}
```

---

## Project Setup Workflow

### 1. Create New Project

```bash
# Set project environment variables
export PROJECT_ID=customer_a
export MONGODB_DATABASE=customer_a_pim
export SOLR_HOST=localhost
export SOLR_PORT=8983
export DEFAULT_LANGUAGE=it
export ENABLED_LANGUAGES=it,de,en,cs
```

### 2. Create MongoDB Database

```bash
# MongoDB will automatically create database on first write
mongosh
use customer_a_pim

# Seed languages
npx ts-node src/scripts/seed-languages.ts
```

### 3. Create Solr Core

```bash
# Core name MUST match MongoDB database name
cd /opt/solr
bin/solr create -c customer_a_pim

# Verify
curl http://localhost:8983/solr/admin/cores?action=STATUS&core=customer_a_pim
```

### 4. Setup Solr Schema

```bash
# Sync Solr schema with enabled languages
npx ts-node src/scripts/sync-solr-schema.ts

# This creates fields for all enabled languages:
# - name_text_it, name_text_de, name_text_en, name_text_cs
# - description_text_it, description_text_de, ...
# - features_text_it, features_text_de, ...
```

### 5. Start Application

```bash
# Application automatically uses configuration from environment
npm run dev

# Check configuration on startup:
# 📋 Project Configuration:
#    Project ID: customer_a
#    MongoDB Database: customer_a_pim
#    Solr Core: customer_a_pim (matches database)
#    Default Language: it
#    Enabled Languages: it, de, en, cs
```

---

## Validation & Testing

### Verify Configuration

```typescript
import { projectConfig, validateProjectConfig } from "./config/project.config";

// Runs automatically on startup
validateProjectConfig(projectConfig);

// ✅ Validates:
// - Solr core matches MongoDB database
// - Default language is enabled
// - Italian is always enabled
```

### Test Product Creation

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "TEST-001",
    "name": {
      "it": "Prodotto di Test",
      "de": "Testprodukt",
      "en": "Test Product"
    },
    "description": {
      "it": "Descrizione del prodotto",
      "de": "Produktbeschreibung",
      "en": "Product description"
    }
  }'
```

### Test Solr Search (Italian)

```bash
curl "http://localhost:8983/solr/customer_a_pim/select?q=name_text_it:trapano"
```

### Test Solr Search (German)

```bash
curl "http://localhost:8983/solr/customer_a_pim/select?q=name_text_de:bohrmaschine"
```

---

## Multi-Project Deployment

### Docker Compose Example

```yaml
version: '3.8'

services:
  # Customer A - PIM
  pim-customer-a:
    image: vinc-pim:latest
    environment:
      PROJECT_ID: customer_a
      MONGODB_DATABASE: customer_a_pim
      MONGODB_URI: mongodb://mongo:27017
      SOLR_HOST: solr
      SOLR_PORT: 8983
      DEFAULT_LANGUAGE: it
      ENABLED_LANGUAGES: it,de,en,cs
    ports:
      - "3001:3000"

  # Customer B - PIM
  pim-customer-b:
    image: vinc-pim:latest
    environment:
      PROJECT_ID: customer_b
      MONGODB_DATABASE: customer_b_pim
      MONGODB_URI: mongodb://mongo:27017
      SOLR_HOST: solr
      SOLR_PORT: 8983
      DEFAULT_LANGUAGE: it
      ENABLED_LANGUAGES: it,de,fr,es
    ports:
      - "3002:3000"

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

  solr:
    image: solr:9
    ports:
      - "8983:8983"
    volumes:
      - solr-data:/var/solr

volumes:
  mongo-data:
  solr-data:
```

---

## Troubleshooting

### Solr Core Name Mismatch

```
❌ Error: Solr core name (pim-products) must match MongoDB database name (customer_a_pim)
```

**Solution**: Update `.env`:
```env
MONGODB_DATABASE=customer_a_pim
# Solr core is automatically set to match
```

### Italian Not in Enabled Languages

```
❌ Error: Italian (it) must always be enabled as it's the default language
```

**Solution**: Update `.env`:
```env
ENABLED_LANGUAGES=it,de,en,cs  # Italian must be included
```

### Default Language Not Enabled

```
❌ Error: Default language (fr) must be in enabled languages list
```

**Solution**: Either enable French or change default to Italian:
```env
DEFAULT_LANGUAGE=it  # Back to Italian
ENABLED_LANGUAGES=it,de,en,cs
```

---

## Best Practices

### 1. Always Use Italian as Default
- Italian is the primary business language
- All products must have Italian translations
- Other languages are optional enhancements

### 2. Match Core and Database Names
- Makes infrastructure management easier
- Prevents confusion in multi-project setups
- Simplifies backup/restore operations

### 3. Document Project-Specific Languages
Keep a record of which languages each project uses:

```markdown
# Project Language Matrix

| Project    | Database        | Languages          |
|------------|-----------------|-------------------|
| Customer A | customer_a_pim  | IT, DE, EN, CS    |
| Customer B | customer_b_pim  | IT, DE, FR, ES    |
| Customer C | customer_c_pim  | IT, EN, ZH, JA    |
```

### 4. Test Language Fallback
Always test that Italian fallback works:

```typescript
// Request product in unavailable language
GET /api/products/123?lang=ru

// Should return Italian if Russian not available
{
  "name": "Trapano Bosch 750W"  // Falls back to Italian
}
```

---

## Summary

**Configuration Checklist:**
- ✅ Solr core name = MongoDB database name
- ✅ Default language = Italian (it)
- ✅ Italian always in enabled languages
- ✅ All text fields use multilingual structure
- ✅ Solr fields created for each enabled language
- ✅ Validation enforced at startup

**Key Files:**
- [project.config.ts](../vinc-pim/src/config/project.config.ts) - Project configuration
- [solr-schema.service.ts](../vinc-pim/src/services/solr-schema.service.ts) - Solr integration
- [seed-languages.ts](../vinc-pim/src/scripts/seed-languages.ts) - Language initialization

---

**Last Updated:** 2025-11-19
**Version:** 1.0
