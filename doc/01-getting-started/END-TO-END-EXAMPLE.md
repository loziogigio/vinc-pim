# End-to-End Example

**Complete Workflow: From Project Setup to Product Search**

This guide walks through a real-world scenario: setting up a new PIM project for an Italian hardware store that needs to support Italian, German, English, and Czech languages.

---

## Scenario

**Company:** Ferramenta Milano (Italian hardware store)
**Requirements:**
- Product catalog with 10,000+ items
- Primary language: Italian
- Also serve: German, English, Czech markets
- Must support: Special characters, accents, umlauts
- Future: May add French, Spanish

---

## Part 1: Initial Setup (5 minutes)

### Step 1: Create Project Environment

```bash
cd vinc-apps/vinc-pim

# Create .env file
cat > .env <<EOF
# Project
PROJECT_ID=ferramenta_milano

# MongoDB
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=ferramenta_milano_pim

# Solr (automatically matches MongoDB database)
SOLR_HOST=localhost
SOLR_PORT=8983

# Languages
DEFAULT_LANGUAGE=it
ENABLED_LANGUAGES=it,de,en,cs

# Optional
LANGUAGE_CACHE_TTL=300000
PORT=3000
EOF
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Seed Languages

```bash
npx ts-node src/scripts/seed-languages.ts
```

**Output:**
```
🌍 Seeding Languages
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Seeded 43 languages
✅ Enabled by default: it, de, en, cs
✅ Default language: it (Italian)

📊 Language Statistics:
   Western European: 11
   Nordic: 2
   Central/Eastern European: 9
   Middle Eastern/RTL: 3
   Asian (CJK): 8
   Other: 10

🎯 Next: Create Solr core matching database name
     docker exec -it solr solr create -c ferramenta_milano_pim
```

### Step 4: Create Solr Core

```bash
# Using Docker
docker exec -it solr solr create -c ferramenta_milano_pim

# Verify
curl http://localhost:8983/solr/admin/cores?action=STATUS&core=ferramenta_milano_pim
```

**Output:**
```json
{
  "responseHeader": {
    "status": 0,
    "QTime": 1
  },
  "status": {
    "ferramenta_milano_pim": {
      "name": "ferramenta_milano_pim",
      "instanceDir": "/var/solr/data/ferramenta_milano_pim",
      "dataDir": "/var/solr/data/ferramenta_milano_pim/data/",
      "config": "solrconfig.xml",
      "schema": "managed-schema.xml",
      "startTime": "2025-11-19T10:30:00.000Z",
      "uptime": 1234
    }
  }
}
```

### Step 5: Setup Solr Schema

```bash
npx ts-node src/scripts/setup-solr-schema.ts
```

**Output:**
```
🔧 Solr Schema Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Configuration:
   Solr URL: http://localhost:8983
   Core: ferramenta_milano_pim
   MongoDB: ferramenta_milano_pim ✓ (names match)

🔍 Step 1: Checking Solr core exists...
   ✅ Core 'ferramenta_milano_pim' is active

🌍 Step 2: Adding language-specific field types...
   ✅ text_it (Italian - stemming + stopwords)
   ✅ text_de (German - stemming + stopwords)
   ✅ text_en (English - stemming + stopwords)
   ✅ text_general (Czech, Slovak, etc.)
   ... and 39 more languages

📝 Step 3: Adding core product fields...
   ✅ id, sku, category_name, brand_name
   ✅ price, stock_status, quantity
   ✅ is_published, is_featured, rating_average
   ... and 15 more fields

🌐 Step 4: Adding multilingual text fields...
   ✅ name_text_it, name_text_de, name_text_en, name_text_cs
   ✅ description_text_it, description_text_de, ...
   ✅ features_text_it, features_text_de, ...

⚡ Step 5: Adding dynamic fields...
   ✅ *_text_* (future languages)

🔗 Step 6: Adding copy field rules...
   ✅ name_text_* → _text_ (universal search)

✅ Schema setup completed successfully!
```

### Step 6: Start Application

```bash
npm run dev
```

**Output:**
```
📋 Project Configuration:
   Project ID: ferramenta_milano
   MongoDB Database: ferramenta_milano_pim
   Solr Core: ferramenta_milano_pim (matches database)
   Default Language: it
   Enabled Languages: it, de, en, cs

🌍 Language Cache: Loaded 4 enabled languages
   🇮🇹 it (Italian) - DEFAULT
   🇩🇪 de (German)
   🇬🇧 en (English)
   🇨🇿 cs (Czech)

🚀 Server running on http://localhost:3000
```

---

## Part 2: Import Products (10 minutes)

### Sample Product: Bosch Hammer Drill

Create `sample-products.json`:

```json
[
  {
    "sku": "BOSCH-PSB-750-RCE",
    "name": {
      "it": "Trapano Battente Professionale Bosch PSB 750 RCE 750W",
      "de": "Bosch PSB 750 RCE Profi-Schlagbohrmaschine 750W",
      "en": "Bosch PSB 750 RCE Professional Hammer Drill 750W",
      "cs": "Bosch PSB 750 RCE Profesionální příklepová vrtačka 750W"
    },
    "description": {
      "it": "Il trapano a percussione professionale Bosch PSB 750 RCE offre 750W di potenza per foratura efficiente in muratura, legno e metallo. Dotato di mandrino autoserrante da 13mm, cambio elettronico della velocità e impugnatura Soft-Grip antiscivolo.",
      "de": "Die Bosch PSB 750 RCE Profi-Schlagbohrmaschine bietet 750W Leistung für effizientes Bohren in Mauerwerk, Holz und Metall. Ausgestattet mit 13mm Schnellspannfutter, elektronischer Drehzahlregelung und rutschfestem Soft-Grip-Griff.",
      "en": "The Bosch PSB 750 RCE professional hammer drill offers 750W of power for efficient drilling in masonry, wood and metal. Equipped with 13mm keyless chuck, electronic speed control and non-slip Soft-Grip handle.",
      "cs": "Profesionální příklepová vrtačka Bosch PSB 750 RCE nabízí výkon 750 W pro efektivní vrtání do zdiva, dřeva a kovu. Vybavena 13mm rychloupínacím sklíčidlem, elektronickou regulací otáček a protiskluzovou rukojetí Soft-Grip."
    },
    "features": {
      "it": [
        "Rivestimento Soft-Grip per impugnatura antiscivolo e comfort ottimale",
        "Cambio elettronico intelligente della velocità per controllo preciso",
        "Mandrino autoserrante Bosch da 13mm per cambio utensile rapido",
        "Funzione di percussione per foratura efficiente in muratura",
        "Arresto di profondità regolabile per foratura precisa"
      ],
      "de": [
        "Soft-Grip-Beschichtung für rutschfesten Griff und optimalen Komfort",
        "Intelligente elektronische Drehzahlregelung für präzise Kontrolle",
        "Bosch 13mm Schnellspannfutter für schnellen Werkzeugwechsel",
        "Schlagbohrfunktion für effizientes Bohren in Mauerwerk",
        "Einstellbarer Tiefenanschlag für präzises Bohren"
      ],
      "en": [
        "Soft-Grip coating for non-slip handle and optimal comfort",
        "Intelligent electronic speed control for precise control",
        "Bosch 13mm keyless chuck for quick tool changes",
        "Hammer function for efficient drilling in masonry",
        "Adjustable depth stop for precise drilling"
      ],
      "cs": [
        "Soft-Grip povlak pro protiskluzovou rukojeť a optimální pohodlí",
        "Inteligentní elektronická regulace otáček pro přesné ovládání",
        "Bosch 13mm rychloupínací sklíčidlo pro rychlou výměnu nástrojů",
        "Příklepová funkce pro efektivní vrtání do zdiva",
        "Nastavitelný hloubkový doraz pro přesné vrtání"
      ]
    },
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
          "key": "voltage",
          "label": "Tensione",
          "value": 230,
          "uom": "V",
          "category": "Electrical"
        },
        {
          "key": "chuck_capacity",
          "label": "Capacità mandrino",
          "value": 13,
          "uom": "mm",
          "category": "Technical"
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
          "key": "voltage",
          "label": "Spannung",
          "value": 230,
          "uom": "V",
          "category": "Electrical"
        },
        {
          "key": "chuck_capacity",
          "label": "Spannfutterkapazität",
          "value": 13,
          "uom": "mm",
          "category": "Technical"
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
          "key": "voltage",
          "label": "Voltage",
          "value": 230,
          "uom": "V",
          "category": "Electrical"
        },
        {
          "key": "chuck_capacity",
          "label": "Chuck capacity",
          "value": 13,
          "uom": "mm",
          "category": "Technical"
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
          "key": "voltage",
          "label": "Napětí",
          "value": 230,
          "uom": "V",
          "category": "Electrical"
        },
        {
          "key": "chuck_capacity",
          "label": "Kapacita sklíčidla",
          "value": 13,
          "uom": "mm",
          "category": "Technical"
        },
        {
          "key": "weight",
          "label": "Hmotnost",
          "value": 2.0,
          "uom": "kg",
          "category": "Physical"
        }
      ]
    },
    "category": {
      "id": "cat-drills",
      "name": "Trapani"
    },
    "brand": {
      "id": "brand-bosch",
      "name": "Bosch Professional"
    },
    "price": 89.99,
    "originalPrice": 119.99,
    "cost": 65.00,
    "stock": {
      "status": "in_stock",
      "quantity": 450,
      "minOrderQuantity": 1,
      "maxOrderQuantity": 50
    },
    "status": "active",
    "isPublished": true,
    "visibility": "public",
    "isFeatured": true,
    "isBestseller": true,
    "isNew": false,
    "isOnSale": true,
    "saleStartDate": "2025-11-01T00:00:00Z",
    "saleEndDate": "2025-11-30T23:59:59Z",
    "discountPercentage": 25,
    "rating": {
      "average": 4.7,
      "count": 128
    },
    "analytics": {
      "viewCount": 3542,
      "orderCount": 287
    }
  }
]
```

### Import via API

```bash
curl -X POST http://localhost:3000/api/products/import \
  -H "Content-Type: application/json" \
  -d @sample-products.json
```

**Response:**
```json
{
  "success": true,
  "imported": 1,
  "failed": 0,
  "products": [
    {
      "_id": "673c5e4f8a2b1c3d4e5f6789",
      "sku": "BOSCH-PSB-750-RCE",
      "createdAt": "2025-11-19T10:45:00.000Z"
    }
  ]
}
```

---

## Part 3: Solr Indexing (2 minutes)

### Index Product to Solr

The product is automatically indexed when created/updated, but you can also manually index:

```bash
curl -X POST http://localhost:8983/solr/ferramenta_milano_pim/update?commit=true \
  -H "Content-Type: application/json" \
  -d '[
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
        "Mandrino autoserrante Bosch da 13mm"
      ],
      "features_text_de": [
        "Soft-Grip-Beschichtung für rutschfesten Griff",
        "Intelligente elektronische Drehzahlregelung",
        "Bosch 13mm Schnellspannfutter"
      ],

      "price": 89.99,
      "original_price": 119.99,
      "stock_status": "in_stock",
      "quantity": 450,

      "status": "active",
      "is_published": true,
      "visibility": "public",
      "is_featured": true,
      "is_bestseller": true,
      "is_new": false,
      "is_on_sale": true,

      "rating_average": 4.7,
      "rating_count": 128,
      "view_count": 3542,
      "order_count": 287,

      "discount_percentage": 25.0
    }
  ]'
```

**Response:**
```json
{
  "responseHeader": {
    "status": 0,
    "QTime": 123
  }
}
```

---

## Part 4: Search & Query (10 minutes)

### Test 1: Search in Italian

```bash
curl "http://localhost:8983/solr/ferramenta_milano_pim/select?q=name_text_it:trapano&wt=json&indent=true"
```

**Response:**
```json
{
  "responseHeader": {
    "status": 0,
    "QTime": 5,
    "params": {
      "q": "name_text_it:trapano"
    }
  },
  "response": {
    "numFound": 1,
    "start": 0,
    "docs": [
      {
        "id": "BOSCH-PSB-750-RCE",
        "sku": "BOSCH-PSB-750-RCE",
        "name_text_it": "Trapano Battente Professionale Bosch PSB 750 RCE 750W",
        "brand_name": "Bosch Professional",
        "price": 89.99,
        "rating_average": 4.7
      }
    ]
  }
}
```

### Test 2: Search in German

```bash
curl "http://localhost:8983/solr/ferramenta_milano_pim/select?q=name_text_de:bohrmaschine&wt=json"
```

**Found:** ✅ Bosch PSB 750 RCE (German stemming works: "bohrmaschine" → "bohrma schin")

### Test 3: Search in English

```bash
curl "http://localhost:8983/solr/ferramenta_milano_pim/select?q=name_text_en:drill&wt=json"
```

**Found:** ✅ Bosch PSB 750 RCE (English stemming works: "drill" → "drill")

### Test 4: Universal Search (All Languages)

```bash
curl "http://localhost:8983/solr/ferramenta_milano_pim/select?q=_text_:bosch&wt=json"
```

**Found:** ✅ Bosch PSB 750 RCE (Copy fields work - searches across ALL language fields)

### Test 5: Faceted Search

```bash
curl "http://localhost:8983/solr/ferramenta_milano_pim/select?q=*:*&facet=true&facet.field=brand_name&facet.field=category_name&facet.field=stock_status&wt=json&indent=true"
```

**Response:**
```json
{
  "response": {
    "numFound": 1,
    "docs": [...]
  },
  "facet_counts": {
    "facet_fields": {
      "brand_name": [
        "Bosch Professional", 1
      ],
      "category_name": [
        "Trapani", 1
      ],
      "stock_status": [
        "in_stock", 1
      ]
    }
  }
}
```

### Test 6: Filter by Price Range

```bash
curl "http://localhost:8983/solr/ferramenta_milano_pim/select?q=*:*&fq=price:[80+TO+100]&wt=json"
```

**Found:** ✅ Bosch PSB 750 RCE (price: 89.99)

### Test 7: Filter by Stock Status

```bash
curl "http://localhost:8983/solr/ferramenta_milano_pim/select?q=*:*&fq=stock_status:in_stock&fq=quantity:[100+TO+*]&wt=json"
```

**Found:** ✅ Bosch PSB 750 RCE (quantity: 450)

### Test 8: Featured & On Sale Products

```bash
curl "http://localhost:8983/solr/ferramenta_milano_pim/select?q=*:*&fq=is_featured:true&fq=is_on_sale:true&sort=rating_average+desc&wt=json"
```

**Found:** ✅ Bosch PSB 750 RCE (featured, on sale, rating: 4.7)

---

## Part 5: Adding More Languages (5 minutes)

### Scenario: Expand to French and Spanish Markets

```bash
# Enable French and Spanish
npx ts-node src/scripts/manage-languages.ts enable fr es
```

**Output:**
```
🔓 Enabling languages: fr, es

✅ fr (French) - enabled in database
✅ es (Spanish) - enabled in database

🔧 Updating Solr schema...
   ✅ Added field type: text_fr
   ✅ Added fields: name_text_fr, description_text_fr, features_text_fr
   ✅ Added field type: text_es
   ✅ Added fields: name_text_es, description_text_es, features_text_es

✅ Languages enabled! No restart needed - changes are live immediately.
```

### Verify Languages

```bash
curl http://localhost:3000/api/languages/enabled
```

**Response:**
```json
{
  "languages": [
    { "code": "it", "name": "Italian", "isDefault": true },
    { "code": "de", "name": "German" },
    { "code": "en", "name": "English" },
    { "code": "cs", "name": "Czech" },
    { "code": "fr", "name": "French" },
    { "code": "es", "name": "Spanish" }
  ]
}
```

### Update Product with French Translation

```bash
curl -X PUT http://localhost:3000/api/products/BOSCH-PSB-750-RCE \
  -H "Content-Type: application/json" \
  -d '{
    "name": {
      "fr": "Perceuse à Percussion Professionnelle Bosch PSB 750 RCE 750W"
    },
    "description": {
      "fr": "La perceuse à percussion professionnelle Bosch PSB 750 RCE offre 750W de puissance pour un perçage efficace dans la maçonnerie, le bois et le métal."
    },
    "features": {
      "fr": [
        "Revêtement Soft-Grip pour poignée antidérapante",
        "Contrôle électronique intelligent de la vitesse",
        "Mandrin auto-serrant Bosch 13mm"
      ]
    }
  }'
```

### Search in French

```bash
curl "http://localhost:8983/solr/ferramenta_milano_pim/select?q=name_text_fr:perceuse&wt=json"
```

**Found:** ✅ Bosch PSB 750 RCE (French fields working immediately, no restart needed!)

---

## Part 6: Production Scenarios

### Scenario 1: Bulk Import from Supplier

```bash
# Import 1000 products from CSV
npx ts-node src/scripts/import-from-csv.ts /path/to/supplier-catalog.csv

# Output:
# ✅ Imported 1000 products
# ✅ Indexed to Solr: 1000 documents
# ⏱️  Time: 45 seconds
```

### Scenario 2: Daily Price Update

```bash
# Update prices from external system
curl -X POST http://localhost:3000/api/products/bulk-update-prices \
  -H "Content-Type: application/json" \
  -d @price-updates.json

# Solr automatically re-indexed via atomic updates
```

### Scenario 3: Analytics Query

```bash
# Top 10 bestsellers
curl "http://localhost:8983/solr/ferramenta_milano_pim/select?q=*:*&fq=is_published:true&sort=order_count+desc&rows=10&wt=json"

# Most viewed this month
curl "http://localhost:8983/solr/ferramenta_milano_pim/select?q=*:*&fq=created_at:[NOW-30DAY+TO+NOW]&sort=view_count+desc&rows=20&wt=json"

# Products needing restock
curl "http://localhost:8983/solr/ferramenta_milano_pim/select?q=*:*&fq=quantity:[0+TO+10]&sort=order_count+desc&wt=json"
```

### Scenario 4: Autocomplete

```bash
# Suggest products as user types "bos"
curl "http://localhost:8983/solr/ferramenta_milano_pim/suggest?suggest=true&suggest.dictionary=productSuggest&suggest.q=bos&wt=json"

# Returns: "Bosch", "Bosch Professional", "Bosch PSB 750"
```

### Scenario 5: Similar Products

```bash
# Find similar products (More Like This)
curl "http://localhost:8983/solr/ferramenta_milano_pim/mlt?q=id:BOSCH-PSB-750-RCE&mlt.fl=name_text_it,description_text_it,category_name&mlt.mindf=1&mlt.mintf=1&rows=5&wt=json"

# Returns: Other Bosch drills, similar power tools
```

---

## Part 7: Monitoring & Maintenance

### Check Solr Health

```bash
# Core status
curl "http://localhost:8983/solr/admin/cores?action=STATUS&core=ferramenta_milano_pim&wt=json"

# Index statistics
curl "http://localhost:8983/solr/ferramenta_milano_pim/admin/luke?numTerms=0&wt=json"
```

### Optimize Index

```bash
# After bulk imports
curl "http://localhost:8983/solr/ferramenta_milano_pim/update?optimize=true"
```

### Clear Cache

```bash
# Refresh language cache
curl -X POST http://localhost:3000/api/admin/languages/refresh-cache

# Response: {"success": true, "languages": 6, "cacheRefreshed": true}
```

### Backup

```bash
# Backup MongoDB
mongodump --db=ferramenta_milano_pim --out=/backup/mongodb/

# Backup Solr
curl "http://localhost:8983/solr/ferramenta_milano_pim/replication?command=backup&location=/backup/solr&name=daily-backup"
```

---

## Summary

**What We Built:**
- ✅ Multitenant PIM project for Ferramenta Milano
- ✅ Support for 6 languages (IT, DE, EN, CS, FR, ES)
- ✅ Full-text search with language-specific analyzers
- ✅ Faceted search and filtering
- ✅ Zero-downtime language additions
- ✅ Production-ready indexing and search

**Time Investment:**
- Initial setup: 5 minutes
- Product import: 10 minutes
- Search testing: 10 minutes
- Adding languages: 5 minutes
- **Total: ~30 minutes** to full working system

**Scalability:**
- ✅ Ready for 10,000+ products
- ✅ Sub-100ms search response times
- ✅ Can add 37 more languages without code changes
- ✅ Multitenant - can create unlimited projects

**Key Takeaways:**
1. Solr core name MUST match MongoDB database name
2. Italian is always the default language
3. Zero-downtime language changes (no restarts)
4. Language-specific analyzers ensure proper search
5. Dynamic fields support future languages
6. Copy fields enable universal search

---

## Next Steps

1. **Import Your Real Data:**
   ```bash
   npx ts-node src/scripts/import-products.ts /path/to/your-products.json
   ```

2. **Customize Product Schema:**
   - Add custom fields to product model
   - Update Solr schema with new fields
   - Implement validation rules

3. **Build Frontend:**
   - Product listing page
   - Search interface
   - Filters and facets
   - Language selector

4. **Deploy to Production:**
   - Set up MongoDB replica set
   - Configure SolrCloud
   - Enable HTTPS
   - Set up monitoring (Grafana, Prometheus)
   - Configure backups

5. **Integrate External Systems:**
   - ERP integration for inventory
   - E-commerce platform for orders
   - Translation service for new languages
   - Image CDN for product photos

---

**Last Updated:** 2025-11-19
**Version:** 1.0
