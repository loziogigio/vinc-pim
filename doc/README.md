# PIM - Product Information Management

Multilingual Product Information Management system for multi-tenant B2B e-commerce.

---

## 📦 Batch Import System

The PIM supports batch import of products via REST API with automatic language handling and search synchronization.

### Language Handling

**If languages are provided:** The system uses the provided multilingual data as-is.

**If languages are NOT provided:** The system automatically applies the **default language (Italian - IT)** to all text fields.

---

## 🔧 Product Data Structure

### Complete Product Schema

```typescript
interface PIMProduct {
  // Core identification
  entity_code: string;              // Unique identifier (required)
  sku: string;                      // Stock keeping unit (required)

  // Basic information
  name: string | MultilingualString;          // Product name
  description: string | MultilingualString;   // Full description
  short_description?: string | MultilingualString;

  // Pricing
  price: number;                    // Base price (required)
  currency: string;                 // ISO currency code (e.g., "EUR")
  special_price?: number;           // Sale price
  cost?: number;                    // Cost price

  // Inventory
  stock_quantity: number;           // Available quantity
  manage_stock?: boolean;           // Enable stock management
  stock_status?: 'in_stock' | 'out_of_stock' | 'on_backorder';

  // Classification
  product_type?: string;            // Product type ID
  categories?: string[];            // Array of category IDs
  brands?: string[];                // Array of brand IDs
  collections?: string[];           // Array of collection IDs
  tags?: string[];                  // Array of tag IDs

  // Physical attributes
  weight?: number;                  // Product weight
  weight_unit?: string;             // Weight unit (e.g., "kg")
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    unit?: string;                  // Dimension unit (e.g., "cm")
  };

  // Status & visibility
  status?: 'draft' | 'published' | 'archived';
  visibility?: 'visible' | 'hidden' | 'search_only';
  enabled?: boolean;                // Product enabled/disabled

  // SEO
  meta_title?: string | MultilingualString;
  meta_description?: string | MultilingualString;
  meta_keywords?: string | MultilingualString;
  url_key?: string;                 // SEO-friendly URL

  // Media
  images?: ProductImage[];          // Product images
  media?: ProductMedia[];           // Documents, videos, PDFs

  // Attributes (custom fields)
  attributes?: Record<string, AttributeValue>;

  // Relationships
  related_products?: string[];      // Related product codes
  upsell_products?: string[];       // Upsell product codes
  cross_sell_products?: string[];   // Cross-sell product codes

  // Additional data
  manufacturer?: string;
  country_of_origin?: string;
  warranty?: string | MultilingualString;
  certifications?: string[];

  // Metadata
  source_id?: string;               // Import source reference
  external_id?: string;             // External system ID
  wholesaler_id?: string;           // Wholesaler reference

  // Timestamps (auto-generated)
  created_at?: Date;
  updated_at?: Date;
  indexed_at?: Date;                // Last Solr sync
}

// Multilingual string type
type MultilingualString = Record<string, string>;
// Example: { it: "Cacciavite", en: "Screwdriver", de: "Schraubendreher" }

// Image structure
interface ProductImage {
  url: string;                      // Image URL
  label?: string | MultilingualString;
  position?: number;                // Display order
  is_main?: boolean;                // Main product image
  alt_text?: string | MultilingualString;
}

// Media structure
interface ProductMedia {
  type: 'document' | 'video' | 'pdf' | 'other';
  url: string;
  name?: string | MultilingualString;
  label?: string | MultilingualString;
  position?: number;
}

// Attribute value type
type AttributeValue = string | number | boolean | string[] | MultilingualString;
```

---

## 📝 Full Product Example

### Example 1: Multilingual Product (Languages Provided)

```json
{
  "entity_code": "TOOL-PRO-001",
  "sku": "SCREW-PRO-PH2",
  "name": {
    "it": "Cacciavite Professionale Phillips PH2",
    "en": "Professional Phillips Screwdriver PH2",
    "de": "Professioneller Kreuzschlitz-Schraubendreher PH2",
    "fr": "Tournevis Cruciforme Professionnel PH2"
  },
  "description": {
    "it": "Cacciavite professionale con punta magnetica Phillips PH2. Impugnatura ergonomica antiscivolo. Ideale per uso professionale e hobbistico.",
    "en": "Professional screwdriver with magnetic Phillips PH2 tip. Ergonomic non-slip handle. Ideal for professional and DIY use.",
    "de": "Professioneller Schraubendreher mit magnetischer Kreuzschlitz-Spitze PH2. Ergonomischer rutschfester Griff. Ideal für professionelle und Heimwerker-Anwendungen.",
    "fr": "Tournevis professionnel avec pointe magnétique cruciforme PH2. Poignée ergonomique antidérapante. Idéal pour usage professionnel et bricolage."
  },
  "short_description": {
    "it": "Cacciavite professionale PH2 con punta magnetica",
    "en": "Professional PH2 screwdriver with magnetic tip",
    "de": "Professioneller PH2 Schraubendreher mit magnetischer Spitze",
    "fr": "Tournevis professionnel PH2 avec pointe magnétique"
  },
  "price": 15.99,
  "currency": "EUR",
  "special_price": 12.99,
  "cost": 8.50,
  "stock_quantity": 150,
  "manage_stock": true,
  "stock_status": "in_stock",
  "product_type": "simple",
  "categories": ["cat_hand_tools", "cat_screwdrivers"],
  "brands": ["brand_stanley"],
  "tags": ["professional", "magnetic", "phillips"],
  "weight": 0.25,
  "weight_unit": "kg",
  "dimensions": {
    "length": 25,
    "width": 3,
    "height": 3,
    "unit": "cm"
  },
  "status": "published",
  "visibility": "visible",
  "enabled": true,
  "meta_title": {
    "it": "Cacciavite Professionale Phillips PH2 - Punta Magnetica",
    "en": "Professional Phillips Screwdriver PH2 - Magnetic Tip",
    "de": "Professioneller Kreuzschlitz-Schraubendreher PH2 - Magnetische Spitze",
    "fr": "Tournevis Cruciforme Professionnel PH2 - Pointe Magnétique"
  },
  "meta_description": {
    "it": "Cacciavite professionale con punta magnetica Phillips PH2. Qualità superiore per uso professionale.",
    "en": "Professional screwdriver with magnetic Phillips PH2 tip. Superior quality for professional use.",
    "de": "Professioneller Schraubendreher mit magnetischer Kreuzschlitz-Spitze PH2. Überlegene Qualität für den professionellen Einsatz.",
    "fr": "Tournevis professionnel avec pointe magnétique cruciforme PH2. Qualité supérieure pour usage professionnel."
  },
  "url_key": "cacciavite-professionale-phillips-ph2",
  "images": [
    {
      "url": "https://cdn.example.com/images/screw-pro-001-main.jpg",
      "label": {
        "it": "Immagine principale",
        "en": "Main image",
        "de": "Hauptbild",
        "fr": "Image principale"
      },
      "position": 1,
      "is_main": true,
      "alt_text": {
        "it": "Cacciavite professionale Phillips PH2",
        "en": "Professional Phillips screwdriver PH2",
        "de": "Professioneller Kreuzschlitz-Schraubendreher PH2",
        "fr": "Tournevis cruciforme professionnel PH2"
      }
    },
    {
      "url": "https://cdn.example.com/images/screw-pro-001-detail.jpg",
      "label": {
        "it": "Dettaglio punta magnetica",
        "en": "Magnetic tip detail",
        "de": "Magnetspitze Detail",
        "fr": "Détail pointe magnétique"
      },
      "position": 2,
      "is_main": false
    }
  ],
  "media": [
    {
      "type": "pdf",
      "url": "https://cdn.example.com/docs/screw-pro-001-manual.pdf",
      "name": {
        "it": "Manuale d'uso",
        "en": "User manual",
        "de": "Benutzerhandbuch",
        "fr": "Manuel d'utilisation"
      }
    }
  ],
  "attributes": {
    "material": {
      "it": "Acciaio cromato vanadio",
      "en": "Chrome vanadium steel",
      "de": "Chrom-Vanadium-Stahl",
      "fr": "Acier chrome-vanadium"
    },
    "handle_material": {
      "it": "Gomma antiscivolo",
      "en": "Non-slip rubber",
      "de": "Rutschfestes Gummi",
      "fr": "Caoutchouc antidérapant"
    },
    "tip_type": "PH2",
    "magnetic": true,
    "warranty_years": 5
  },
  "manufacturer": "Stanley Tools",
  "country_of_origin": "Germany",
  "warranty": {
    "it": "Garanzia 5 anni contro difetti di fabbricazione",
    "en": "5-year warranty against manufacturing defects",
    "de": "5 Jahre Garantie gegen Herstellungsfehler",
    "fr": "Garantie 5 ans contre les défauts de fabrication"
  },
  "certifications": ["ISO 9001", "CE"],
  "related_products": ["TOOL-PRO-002", "TOOL-PRO-003"],
  "source_id": "import_batch_20251121",
  "external_id": "EXT-SCREW-001"
}
```

---

### Example 2: Simple Product (Default Language Applied)

When you provide product data WITHOUT multilingual fields, the system automatically applies the default language (Italian):

**Input:**
```json
{
  "entity_code": "TOOL-BASIC-001",
  "sku": "HAMMER-001",
  "name": "Martello da carpentiere",
  "description": "Martello professionale con manico in fibra di vetro",
  "price": 25.90,
  "currency": "EUR",
  "stock_quantity": 80
}
```

**What gets stored in MongoDB:**
```json
{
  "entity_code": "TOOL-BASIC-001",
  "sku": "HAMMER-001",
  "name": {
    "it": "Martello da carpentiere"
  },
  "description": {
    "it": "Martello professionale con manico in fibra di vetro"
  },
  "price": 25.90,
  "currency": "EUR",
  "stock_quantity": 80,
  "status": "draft",
  "visibility": "visible",
  "enabled": true,
  "created_at": "2025-11-21T10:00:00Z",
  "updated_at": "2025-11-21T10:00:00Z"
}
```

**Note:** The system automatically:
- Converts string fields to `{ it: "value" }` format
- Sets default status to `draft`
- Sets default visibility to `visible`
- Sets `enabled` to `true`
- Adds timestamps

---

## 🚀 Batch Import API

### Endpoint

```
POST /api/b2b/pim/import
```

### Authentication

```bash
# Get JWT token first
curl -X POST http://localhost:3000/api/b2b/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-password"}'

# Returns: { "token": "eyJhbGc..." }
```

### Batch Import Request

```bash
curl -X POST http://localhost:3000/api/b2b/pim/import \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "products": [
      {
        "entity_code": "PROD-001",
        "sku": "SKU-001",
        "name": "Product Name",
        "price": 19.99,
        "currency": "EUR",
        "stock_quantity": 100
      },
      {
        "entity_code": "PROD-002",
        "sku": "SKU-002",
        "name": {
          "it": "Nome Prodotto",
          "en": "Product Name",
          "de": "Produktname"
        },
        "price": 29.99,
        "currency": "EUR",
        "stock_quantity": 50
      }
    ],
    "sync_to_search": true
  }'
```

### Response

```json
{
  "success": true,
  "job_id": "import_job_abc123",
  "message": "Import job started",
  "total_products": 2,
  "estimated_time_seconds": 5
}
```

---

## ⚙️ Configuration

### Default Language

The system uses **Italian (IT)** as the default language. This is configured in:

```typescript
// src/config/project.config.ts
export const PROJECT_CONFIG = {
  defaultLanguage: 'it',
  enabledLanguages: ['it', 'en', 'de', 'fr', 'es', 'cs'],
  // ... other config
};
```

### Supported Languages

The system supports 43+ languages with proper analyzers. See [Architecture documentation](06-architecture/) for details.

---

## 📊 Performance

- **Batch Import:** ~6-7 products/second (with Solr sync)
- **Search Sync:** Automatic after each product create/update
- **API Response:** ~100-200ms per product

---

## 🔗 Related Documentation

- [Architecture](06-architecture/) - System architecture and configuration
- API Endpoints - Coming soon
- Search Integration - Coming soon

---

**Version:** 2.0
**Last Updated:** 2025-11-21
**GitHub:** https://github.com/loziogigio/vinc-pim
