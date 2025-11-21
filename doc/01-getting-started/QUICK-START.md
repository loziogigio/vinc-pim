# Quick Start Guide

**Get Your Multilingual PIM Running in 5 Minutes**

---

## Prerequisites

- MongoDB running on `localhost:27017`
- Solr running on `localhost:8983`
- Node.js 18+ installed

---

## Step 1: Configure Project (2 min)

Create `.env` file:

```bash
cd vinc-apps/vinc-pim

cat > .env <<EOF
# Project
PROJECT_ID=my_project

# MongoDB
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=my_project_pim

# Solr (auto-configured to match MongoDB database)
SOLR_HOST=localhost
SOLR_PORT=8983

# Languages
DEFAULT_LANGUAGE=it
ENABLED_LANGUAGES=it,de,en,cs
EOF
```

**Important:** Solr core name will automatically match `MONGODB_DATABASE`.

---

## Step 2: Install Dependencies (1 min)

```bash
npm install
```

---

## Step 3: Seed Languages (1 min)

```bash
npx ts-node src/scripts/seed-languages.ts
```

**Output:**
```
🌍 Language Seeding Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Summary:
   Total languages: 43
   Enabled by default: 4 (it, de, en, cs)
   Ready to enable: 39

🚀 Next Steps:
   1. Create Solr core: docker exec -it solr solr create -c my_project_pim
   2. Setup Solr schema: npx ts-node src/scripts/setup-solr-schema.ts
```

---

## Step 4: Create Solr Core (30 sec)

```bash
# Using Docker
docker exec -it solr solr create -c my_project_pim

# Or natively
cd /opt/solr && bin/solr create -c my_project_pim
```

**Verify:**
```bash
curl http://localhost:8983/solr/admin/cores?action=STATUS&core=my_project_pim
```

---

## Step 5: Setup Solr Schema (1 min)

```bash
npx ts-node src/scripts/setup-solr-schema.ts
```

**Output:**
```
✅ Schema setup completed successfully!

📊 Schema Statistics:
   Field Types: 43
   Core Fields: 22
   Language Fields: 28
   Dynamic Fields: 6
   Copy Rules: 3
```

---

## Step 6: Start Application (30 sec)

```bash
npm run dev
```

**Output:**
```
📋 Project Configuration:
   Project ID: my_project
   MongoDB Database: my_project_pim
   Solr Core: my_project_pim (matches database)
   Default Language: it
   Enabled Languages: it, de, en, cs

🚀 Server running on http://localhost:3000
```

---

## Verify Installation

### Test 1: Create a Product

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "TEST-001",
    "name": {
      "it": "Trapano di Test",
      "de": "Test-Bohrmaschine",
      "en": "Test Drill"
    },
    "description": {
      "it": "Descrizione del prodotto di test",
      "de": "Testproduktbeschreibung",
      "en": "Test product description"
    },
    "price": 99.99,
    "stock": 100
  }'
```

### Test 2: Search in Italian

```bash
curl "http://localhost:8983/solr/my_project_pim/select?q=name_text_it:trapano"
```

### Test 3: Search in German

```bash
curl "http://localhost:8983/solr/my_project_pim/select?q=name_text_de:bohrmaschine"
```

### Test 4: Universal Search

```bash
curl "http://localhost:8983/solr/my_project_pim/select?q=_text_:test"
```

---

## Common Tasks

### Enable More Languages

```bash
# Enable French and Spanish
npx ts-node src/scripts/manage-languages.ts enable fr es

# Verify
npx ts-node src/scripts/manage-languages.ts list
```

**No restart needed!** Changes are live immediately.

### Disable a Language

```bash
npx ts-node src/scripts/manage-languages.ts disable cs

# Note: Cannot disable Italian (it) - it's the default language
```

### List All Languages

```bash
npx ts-node src/scripts/manage-languages.ts list
```

**Output:**
```
🌍 Available Languages
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ ENABLED (4):
   🇮🇹 it  Italian (Italiano) [DEFAULT]
   🇩🇪 de  German (Deutsch)
   🇬🇧 en  English (English)
   🇨🇿 cs  Czech (Čeština)

⚪ DISABLED (39):
   🇫🇷 fr  French (Français)
   🇪🇸 es  Spanish (Español)
   🇯🇵 ja  Japanese (日本語)
   🇨🇳 zh  Chinese (简体中文)
   ... and 35 more
```

### Refresh Language Cache

```bash
curl -X POST http://localhost:3000/api/admin/languages/refresh-cache
```

### Sync Solr Schema

After enabling languages directly in the database (not via CLI):

```bash
npx ts-node src/scripts/sync-solr-schema.ts
```

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│  Application Layer                                     │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Express API (Port 3000)                        │  │
│  │  ├─ Products API                                │  │
│  │  ├─ Languages API                               │  │
│  │  └─ Search API                                  │  │
│  └─────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
                    ↓                    ↓
┌────────────────────────────┐  ┌────────────────────────┐
│  MongoDB (Port 27017)      │  │  Solr (Port 8983)      │
│  ┌──────────────────────┐  │  │  ┌──────────────────┐  │
│  │ my_project_pim       │  │  │  │ my_project_pim   │  │
│  │ ├─ products          │  │  │  │ ├─ name_text_it  │  │
│  │ ├─ languages         │  │  │  │ ├─ name_text_de  │  │
│  │ ├─ categories        │  │  │  │ ├─ desc_text_it  │  │
│  │ └─ brands            │  │  │  │ └─ ...           │  │
│  └──────────────────────┘  │  │  └──────────────────┘  │
└────────────────────────────┘  └────────────────────────┘
```

---

## File Structure

```
vinc-pim/
├── src/
│   ├── config/
│   │   └── project.config.ts           # Project configuration
│   ├── lib/db/
│   │   ├── models/
│   │   │   ├── language.ts             # Language model
│   │   │   └── product.ts              # Product model
│   │   └── schema-generator.ts         # Dynamic schema generation
│   ├── services/
│   │   ├── language.service.ts         # Language service (with cache)
│   │   └── solr-schema.service.ts      # Solr integration
│   ├── middleware/
│   │   └── validate-languages.middleware.ts  # Runtime validation
│   ├── api/
│   │   ├── languages.api.ts            # Languages endpoints
│   │   └── products.api.ts             # Products endpoints
│   └── scripts/
│       ├── seed-languages.ts           # Seed 43 languages
│       ├── setup-solr-schema.ts        # Create Solr schema via API
│       ├── manage-languages.ts         # Enable/disable languages
│       └── sync-solr-schema.ts         # Sync Solr with enabled languages
└── .env                                # Configuration
```

---

## Environment Variables Reference

```bash
# Required
PROJECT_ID=my_project                   # Unique project identifier
MONGODB_DATABASE=my_project_pim         # MongoDB database name
MONGODB_URI=mongodb://localhost:27017   # MongoDB connection string

# Solr (auto-configured)
SOLR_HOST=localhost                     # Solr host
SOLR_PORT=8983                          # Solr port
# SOLR_CORE is automatically set to match MONGODB_DATABASE

# Language Configuration
DEFAULT_LANGUAGE=it                     # Default language (always Italian)
ENABLED_LANGUAGES=it,de,en,cs           # Initially enabled languages

# Optional
LANGUAGE_CACHE_TTL=300000               # Cache TTL (5 minutes)
AUTO_PUBLISH_ENABLED=true               # Auto-publish products
MIN_COMPLETENESS_SCORE=80               # Minimum completeness for publish
```

---

## API Endpoints

### Languages

```bash
# List all languages
GET /api/languages

# List enabled languages only
GET /api/languages/enabled

# Get language by code
GET /api/languages/:code

# Enable language (admin)
POST /api/admin/languages/:code/enable

# Disable language (admin)
POST /api/admin/languages/:code/disable

# Refresh cache (admin)
POST /api/admin/languages/refresh-cache
```

### Products

```bash
# List products
GET /api/products?lang=it

# Get product by ID
GET /api/products/:id?lang=it

# Create product
POST /api/products

# Update product
PUT /api/products/:id

# Delete product
DELETE /api/products/:id

# Search products
GET /api/products/search?q=trapano&lang=it
```

---

## Troubleshooting

### Port Already in Use

```bash
# Check what's using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### MongoDB Connection Failed

```bash
# Check MongoDB is running
mongosh --eval "db.adminCommand('ping')"

# Or with Docker
docker ps | grep mongo
```

### Solr Connection Failed

```bash
# Check Solr is running
curl http://localhost:8983/solr/admin/info/system

# Or with Docker
docker ps | grep solr
```

### Solr Core Not Found

```bash
# List cores
curl http://localhost:8983/solr/admin/cores?action=STATUS

# Create core
docker exec -it solr solr create -c my_project_pim
```

### Language Not Appearing in API

```bash
# Check database
mongosh my_project_pim --eval "db.languages.find({code: 'fr'}).pretty()"

# Refresh cache
curl -X POST http://localhost:3000/api/admin/languages/refresh-cache

# Check logs
npm run dev  # Look for cache refresh messages
```

### Search Not Working

```bash
# Check Solr schema
curl "http://localhost:8983/solr/my_project_pim/schema/fields"

# Re-index products
curl -X POST http://localhost:3000/api/admin/reindex

# Test analyzer
curl "http://localhost:8983/solr/my_project_pim/analysis/field?analysis.fieldtype=text_it&analysis.fieldvalue=trapano"
```

---

## Next Steps

1. **Read Full Documentation:**
   - [Zero-Downtime Language Management](ZERO-DOWNTIME-LANGUAGE-MANAGEMENT.md)
   - [Language Management Guide](LANGUAGE-MANAGEMENT-GUIDE.md)
   - [Solr Schema Setup](SOLR-SCHEMA-SETUP.md)
   - [Project Configuration](PROJECT-CONFIGURATION.md)

2. **Import Real Products:**
   ```bash
   npx ts-node src/scripts/import-products.ts /path/to/products.json
   ```

3. **Enable More Languages:**
   ```bash
   npx ts-node src/scripts/manage-languages.ts enable fr es pt
   ```

4. **Configure Production:**
   - Set up MongoDB replica set
   - Configure SolrCloud
   - Set up reverse proxy (nginx)
   - Enable HTTPS
   - Configure monitoring

5. **Customize:**
   - Add custom product fields
   - Implement custom search logic
   - Add product variants
   - Integrate with external systems

---

## Getting Help

- **Documentation:** [README.md](../vinc-pim/README.md)
- **Issues:** Check application logs
- **MongoDB:** `mongosh my_project_pim`
- **Solr Admin:** http://localhost:8983/solr/#/my_project_pim

---

**Last Updated:** 2025-11-19
**Version:** 1.0
