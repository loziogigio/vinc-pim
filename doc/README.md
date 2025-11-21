# PIM Documentation

Complete documentation for the **Multilingual Product Information Management** system.

---

## 🚀 Quick Navigation

**New User?** → [5-Minute Quick Start](01-getting-started/QUICK-START.md)

**API Developer?** → [API Import Guide](02-api/API_IMPORT_GUIDE.md) ⭐

**Large Dataset?** → [Batch Import Guide](03-import/BATCH_IMPORT_GUIDE.md) ⭐

**Multilingual Products?** → [Multilingual System](04-features/MULTILINGUAL-IMPLEMENTATION-SUMMARY.md)

---

## 📚 Documentation Sections

### 1. Getting Started

- [Quick Start (5 min)](01-getting-started/QUICK-START.md) ⚡
- [End-to-End Example](01-getting-started/END-TO-END-EXAMPLE.md) - Real-world scenario

### 2. API Documentation ⭐

- **[API Import Guide](02-api/API_IMPORT_GUIDE.md)** - Complete REST API reference
- [B2B Product Import](02-api/B2B_PRODUCT_IMPORT.md) - B2B-specific endpoints

### 3. Import Methods ⭐

- **[Batch Import Guide](03-import/BATCH_IMPORT_GUIDE.md)** - Large-scale imports
- [Batch Operations Guide](03-import/BATCH-OPERATIONS-GUIDE.md) - Bulk operations

### 4. Features

- [Multilingual System](04-features/MULTILINGUAL-IMPLEMENTATION-SUMMARY.md) - 43+ languages
- [Language Management](04-features/LANGUAGE-MANAGEMENT-GUIDE.md) - Enable/disable languages
- [Zero-Downtime Language Management](04-features/ZERO-DOWNTIME-LANGUAGE-MANAGEMENT.md) - SaaS-ready
- [Search & Sync](04-features/SEARCH_SYNC.md) - Solr integration (formerly SOLR-SCHEMA-SETUP.md)
- [Multilingual UI Components](04-features/MULTILINGUAL_UI_COMPONENTS.md)
- [Dynamic Language Guide](04-features/DYNAMIC-LANGUAGE-GUIDE.md)
- [Language Quick Reference](04-features/LANGUAGE-QUICK-REFERENCE.md) - Cheat sheet
- [Features & Specifications](04-features/FEATURES_SPECIFICATIONS_ATTRIBUTES.md)
- [Brands Management](04-features/BRANDS_MANAGEMENT.md)
- [Brand Associations](04-features/BRAND_ASSOCIATIONS.md)

### 5. Integrations

- [Marketplace Sync](05-integrations/MARKETPLACE_SYNC.md) - eBay, Amazon, ManoMano, Trovaprezzi
- [ERP Integration](05-integrations/ERP_INTEGRATION.md) - Connect BMS-ERP systems

### 6. Architecture

- [Project Configuration](06-architecture/PROJECT-CONFIGURATION.md) - Multi-tenant setup
- [Language System Comparison](06-architecture/language-system-comparison.md)
- [Structure Standards](06-architecture/STRUCTURE_STANDARD.md)

### 7. Operations

- [Worker Setup](07-operations/WORKER_SETUP.md) - Background workers
- [CDN Setup](07-operations/CDN_SETUP.md) - Content delivery
- [MongoDB Auth Fix](07-operations/MONGODB_AUTH_FIX.md)
- [Import Bottleneck Analysis](07-operations/IMPORT_BOTTLENECK_ANALYSIS.md)

### 8. Assets

- [Code Examples](assets/examples/) - Working code samples
- [Data Examples](assets/examples/) - Sample JSON/CSV files

---

## 🎯 Use Cases

**Case 1: E-commerce Startup**
1. [Quick Start](01-getting-started/QUICK-START.md) → Setup
2. [Batch Import](03-import/BATCH_IMPORT_GUIDE.md) → Initial products
3. [API Guide](02-api/API_IMPORT_GUIDE.md) → Ongoing updates

**Case 2: Enterprise Integration**
1. [API Guide](02-api/API_IMPORT_GUIDE.md) → API setup
2. [ERP Integration](05-integrations/ERP_INTEGRATION.md) → Connect ERP
3. [Marketplace Sync](05-integrations/MARKETPLACE_SYNC.md) → Multi-channel

**Case 3: International Business**
1. [Multilingual System](04-features/MULTILINGUAL-IMPLEMENTATION-SUMMARY.md) → Languages
2. [Batch Import](03-import/BATCH_IMPORT_GUIDE.md) → Translated products
3. [Search & Sync](04-features/SEARCH_SYNC.md) → Multi-language search

---

## 🏗️ Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│  Multitenant PIM System                                    │
├────────────────────────────────────────────────────────────┤
│  Project A: customer_a_pim                                 │
│  ├─ MongoDB: customer_a_pim                                │
│  ├─ Solr Core: customer_a_pim (matches database)           │
│  ├─ Default Language: IT (Italian)                         │
│  └─ Enabled Languages: IT, DE, EN, CS                      │
├────────────────────────────────────────────────────────────┤
│  Project B: customer_b_pim                                 │
│  ├─ MongoDB: customer_b_pim                                │
│  ├─ Solr Core: customer_b_pim (matches database)           │
│  ├─ Default Language: IT (Italian)                         │
│  └─ Enabled Languages: IT, DE, FR, ES                      │
└────────────────────────────────────────────────────────────┘
```

### Key Principles

✅ **Solr core name = MongoDB database name** (enforced)
✅ **Italian (IT) is always the default language** (cannot be disabled)
✅ **Zero-downtime language changes** (no restarts)
✅ **Database-driven configuration** (not config files)
✅ **43 languages ready to use** (with proper analyzers)
✅ **Embedded multilingual structure** (single document per product)

---

## 🔧 Tech Stack

- **Next.js 15.5.4** + TypeScript
- **MongoDB 6.x** - Document database
- **Apache Solr 9.x** - Search engine
- **BullMQ** - Job queue system
- **JWT Authentication** - Secure B2B access

---

## 📊 Performance

- **API Import:** ~100ms per product
- **Batch Import:** 6-7 products/sec with Solr sync
- **Search:** ~30-50ms response time
- **Marketplace Sync:** ~500ms-2s per product

---

## 🌍 Supported Languages (43)

### Western European (11)
IT (Italian - default), DE (German), EN (English), FR (French), ES (Spanish), PT (Portuguese), NL (Dutch), CA (Catalan), SV (Swedish), DA (Danish), FI (Finnish)

### Central/Eastern European (9)
CS (Czech), SK (Slovak), PL (Polish), HU (Hungarian), RO (Romanian), HR (Croatian), SR (Serbian), SL (Slovenian), BG (Bulgarian)

### Middle Eastern/RTL (3)
AR (Arabic), HE (Hebrew), FA (Persian)

### Asian (8)
JA (Japanese), ZH (Chinese), KO (Korean), TH (Thai), VI (Vietnamese), ID (Indonesian), MS (Malay), HI (Hindi)

**And more!** See [Language Management Guide](04-features/LANGUAGE-MANAGEMENT-GUIDE.md) for the complete list.

---

## 🤝 Contributing

See [CONTRIBUTING.md](08-development/CONTRIBUTING.md) *(coming soon)*

---

## 📞 Getting Help

- **Quick Start Issues:** See [Quick Start Troubleshooting](01-getting-started/QUICK-START.md#troubleshooting)
- **Language Operations:** See [Language Management Guide](04-features/LANGUAGE-MANAGEMENT-GUIDE.md)
- **Solr Problems:** See [Search Sync Guide](04-features/SEARCH_SYNC.md)
- **Architecture Questions:** See [Project Configuration](06-architecture/PROJECT-CONFIGURATION.md)

---

**Version:** 2.0
**Last Updated:** 2025-11-21
**Status:** Production Ready

**GitHub:** https://github.com/loziogigio/vinc-pim
