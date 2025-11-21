# Batch Import Guide

Complete guide for importing products into the PIM system with automatic language handling.

---

## 🎯 Language Handling

**If languages are provided:** The system uses the provided multilingual data as-is.

**If languages are NOT provided:** The system automatically applies the **default language (Italian - IT)** to all text fields.

---

## 📦 Batch Processing

### How Batch Import Works

The batch import system allows you to import multiple products in a single API request. Products are processed asynchronously through a queue system (BullMQ + Redis) to ensure reliability and scalability.

**Processing Flow:**

1. **Submit Batch** → API receives array of products
2. **Validation** → Each product is validated against schema
3. **Queue Creation** → Valid products are queued for processing
4. **Async Processing** → Workers process products in parallel
5. **Database Update** → Products are saved to MongoDB
6. **Search Sync** → Products are indexed in Solr (if enabled)
7. **Job Completion** → Status updated with results

### Batch Structure

```typescript
interface BatchImportRequest {
  products: PIMProduct[];           // Array of products to import (required)
  source_id: string;                // Import source identifier (required)
  batch_id?: string;                // Unique batch identifier for tracking
  sync_to_search?: boolean;         // Auto-sync to Solr (default: true)
  update_existing?: boolean;        // Update if entity_code exists (default: true)
  validation_mode?: 'strict' | 'lenient';  // Validation level (default: 'strict')

  // For large batches split into multiple requests
  batch_metadata?: {
    batch_id: string;               // Unique ID for the entire batch
    batch_part: number;             // Current part number (1-based)
    batch_total_parts: number;      // Total number of parts
    batch_total_items: number;      // Total items across all parts
  };
}
```

**Example Batch Request (Simple):**
```json
{
  "source_id": "wholesale-import",
  "batch_id": "batch_20251121_001",
  "products": [
    {
      "entity_code": "PROD-001",
      "sku": "SKU-001",
      "name": "Product 1",
      "price": 19.99,
      "currency": "EUR",
      "stock_quantity": 100
    },
    {
      "entity_code": "PROD-002",
      "sku": "SKU-002",
      "name": "Product 2",
      "price": 29.99,
      "currency": "EUR",
      "stock_quantity": 50
    }
  ],
  "sync_to_search": true,
  "update_existing": true
}
```

**Example Batch Request (Multi-Part for Large Batches):**
```json
{
  "source_id": "wholesale-import",
  "batch_metadata": {
    "batch_id": "batch_20251121_large",
    "batch_part": 1,
    "batch_total_parts": 5,
    "batch_total_items": 2500
  },
  "products": [
    // 500 products in this part
  ]
}
```

### Batch Size Recommendations

| Batch Size | Processing Time | Use Case |
|------------|----------------|----------|
| **1-100 products** | 2-5 seconds | Quick updates, testing |
| **100-500 products** | 10-30 seconds | Regular imports (recommended) |
| **500-1000 products** | 30-60 seconds | Large imports |
| **1000+ products** | 1+ minutes | Split into multiple batches |

**Best Practices:**
- ✅ **Recommended:** 100-500 products per batch for optimal performance
- ✅ Split large datasets into multiple batch requests
- ✅ Use job tracking for batches over 100 products
- ⚠️ **Avoid:** Single requests with 5000+ products (may timeout)

### Batch Validation

Each product in the batch is validated before processing:

**Required Fields:**
- `entity_code` - Unique product identifier
- `sku` - Stock keeping unit
- `price` - Product price
- `currency` - Currency code (e.g., "EUR")
- `stock_quantity` - Available quantity

**Validation Modes:**

**Strict Mode (default):**
- All required fields must be present
- Invalid products block the entire batch
- Returns detailed validation errors

**Lenient Mode:**
- Invalid products are skipped
- Valid products continue processing
- Returns list of skipped products with reasons

### Error Handling

If validation fails, you'll receive detailed errors:

```json
{
  "success": false,
  "error": "Batch validation failed",
  "invalid_products": [
    {
      "index": 0,
      "entity_code": "PROD-001",
      "errors": [
        { "field": "price", "message": "Price is required" },
        { "field": "currency", "message": "Currency must be a valid ISO code" }
      ]
    }
  ],
  "valid_count": 8,
  "invalid_count": 2
}
```

### Update vs Create

The batch import automatically handles both creating new products and updating existing ones:

**Create New Product:**
- Product with `entity_code` doesn't exist → Creates new product

**Update Existing Product:**
- Product with `entity_code` exists → Updates existing product
- Only provided fields are updated (partial updates supported)
- Set `update_existing: false` to prevent updates

**Example - Partial Update:**
```json
{
  "products": [
    {
      "entity_code": "EXISTING-PROD-001",
      "price": 24.99,
      "stock_quantity": 200
    }
  ]
}
```
This updates only price and stock for the existing product, leaving other fields unchanged.

### Batch Tracking and Querying

Every product imported via batch is tagged with the `batch_id`, allowing you to track and manage products by batch.

**Query Products by Batch ID:**

```bash
# Get all products from a specific batch
curl -X GET "https://your-domain.com/api/b2b/pim/products?batch_id=batch_20251121_001" \
  -H "Authorization: Bearer $TOKEN"
```

**Query Parameters:**
- `batch_id` - Filter by batch identifier (supports partial matching)
- `source_id` - Filter by import source
- `date_from` - Filter by import date (from)
- `date_to` - Filter by import date (to)
- `status` - Filter by product status (draft, published, archived)
- `page` - Page number for pagination
- `limit` - Items per page (default: 50)

**Example Response:**
```json
{
  "products": [
    {
      "entity_code": "PROD-001",
      "sku": "SKU-001",
      "name": { "it": "Product 1" },
      "source": {
        "source_id": "wholesale-import",
        "source_name": "Wholesale Import",
        "batch_id": "batch_20251121_001",
        "imported_at": "2025-11-21T10:00:00Z"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 2,
    "pages": 1
  }
}
```

**Use Cases for Batch Tracking:**
- Track which products were imported in a specific batch
- Rollback or delete products from a failed import
- Audit and trace product origins
- Compare different batches from the same source
- Monitor import quality over time

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

## 📋 Complete Product Example (Multilingual)

Full product example with multiple languages:

```json
{
  "entity_code": "SCREWDRIVER-001",
  "sku": "SCR-PH2-150",
  "name": {
    "it": "Cacciavite a croce PH2 150mm",
    "en": "Phillips Screwdriver PH2 150mm",
    "de": "Kreuzschlitz-Schraubendreher PH2 150mm",
    "fr": "Tournevis cruciforme PH2 150mm"
  },
  "description": {
    "it": "Cacciavite professionale con punta magnetica PH2 e impugnatura ergonomica antiscivolo. Lunghezza totale 150mm, ideale per lavori di precisione.",
    "en": "Professional screwdriver with PH2 magnetic tip and ergonomic non-slip handle. Total length 150mm, ideal for precision work.",
    "de": "Professioneller Schraubendreher mit PH2-Magnetspitze und ergonomischem rutschfestem Griff. Gesamtlänge 150mm, ideal für Präzisionsarbeiten.",
    "fr": "Tournevis professionnel avec pointe magnétique PH2 et poignée ergonomique antidérapante. Longueur totale 150mm, idéal pour travaux de précision."
  },
  "short_description": {
    "it": "Cacciavite professionale PH2 con punta magnetica",
    "en": "Professional PH2 screwdriver with magnetic tip",
    "de": "Professioneller PH2 Schraubendreher mit Magnetspitze",
    "fr": "Tournevis professionnel PH2 avec pointe magnétique"
  },
  "price": 12.99,
  "currency": "EUR",
  "special_price": 9.99,
  "cost": 6.50,
  "stock_quantity": 150,
  "manage_stock": true,
  "stock_status": "in_stock",
  "product_type": "tool",
  "categories": ["hand-tools", "screwdrivers"],
  "brands": ["professional-tools"],
  "collections": ["workshop-essentials"],
  "tags": ["magnetic", "ergonomic", "professional"],
  "weight": 0.15,
  "weight_unit": "kg",
  "dimensions": {
    "length": 150,
    "width": 30,
    "height": 30,
    "unit": "mm"
  },
  "status": "published",
  "visibility": "visible",
  "enabled": true,
  "meta_title": {
    "it": "Cacciavite PH2 Professionale 150mm - Attrezzi di Qualità",
    "en": "PH2 Professional Screwdriver 150mm - Quality Tools",
    "de": "PH2 Profi-Schraubendreher 150mm - Qualitätswerkzeuge",
    "fr": "Tournevis Professionnel PH2 150mm - Outils de Qualité"
  },
  "meta_description": {
    "it": "Acquista il cacciavite professionale PH2 con punta magnetica. Impugnatura ergonomica, lunghezza 150mm. Ideale per professionisti.",
    "en": "Buy professional PH2 screwdriver with magnetic tip. Ergonomic handle, 150mm length. Ideal for professionals.",
    "de": "Kaufen Sie professionellen PH2 Schraubendreher mit Magnetspitze. Ergonomischer Griff, 150mm Länge. Ideal für Profis.",
    "fr": "Achetez le tournevis professionnel PH2 avec pointe magnétique. Poignée ergonomique, longueur 150mm. Idéal pour les professionnels."
  },
  "url_key": "professional-screwdriver-ph2-150mm",
  "images": [
    {
      "url": "https://cdn.example.com/screwdriver-main.jpg",
      "label": {
        "it": "Vista principale",
        "en": "Main view",
        "de": "Hauptansicht",
        "fr": "Vue principale"
      },
      "position": 1,
      "is_main": true,
      "alt_text": {
        "it": "Cacciavite professionale PH2 150mm vista frontale",
        "en": "Professional PH2 screwdriver 150mm front view",
        "de": "Professioneller PH2 Schraubendreher 150mm Frontansicht",
        "fr": "Tournevis professionnel PH2 150mm vue de face"
      }
    },
    {
      "url": "https://cdn.example.com/screwdriver-detail.jpg",
      "label": {
        "it": "Dettaglio punta",
        "en": "Tip detail",
        "de": "Spitzendetail",
        "fr": "Détail de la pointe"
      },
      "position": 2,
      "is_main": false
    }
  ],
  "media": [
    {
      "type": "pdf",
      "url": "https://cdn.example.com/screwdriver-manual.pdf",
      "name": {
        "it": "Manuale d'uso",
        "en": "User manual",
        "de": "Benutzerhandbuch",
        "fr": "Manuel d'utilisation"
      },
      "position": 1
    }
  ],
  "attributes": {
    "tip_type": "PH2",
    "magnetic": true,
    "handle_material": {
      "it": "Gomma antiscivolo",
      "en": "Non-slip rubber",
      "de": "Rutschfester Gummi",
      "fr": "Caoutchouc antidérapant"
    },
    "blade_material": "Chrome vanadium steel",
    "warranty_years": 2
  },
  "related_products": ["SCREWDRIVER-002", "SCREWDRIVER-003"],
  "manufacturer": "Professional Tools Co.",
  "country_of_origin": "Germany",
  "warranty": {
    "it": "2 anni di garanzia del produttore",
    "en": "2 years manufacturer warranty",
    "de": "2 Jahre Herstellergarantie",
    "fr": "2 ans de garantie fabricant"
  },
  "certifications": ["CE", "ISO9001"],
  "source_id": "wholesale-supplier-001",
  "external_id": "WS-SCR-PH2-150",
  "wholesaler_id": "wholesale-001"
}
```

---

## 🔤 Simple Product Example (Default Language Auto-Applied)

When you don't provide language objects, the system automatically uses **Italian (IT)** as default:

**Input (simple strings):**
```json
{
  "entity_code": "HAMMER-001",
  "sku": "HAM-500G",
  "name": "Martello carpentiere 500g",
  "description": "Martello professionale con manico in legno",
  "short_description": "Martello 500g manico legno",
  "price": 15.99,
  "currency": "EUR",
  "stock_quantity": 75,
  "status": "published"
}
```

**Stored in database (auto-converted to Italian):**
```json
{
  "entity_code": "HAMMER-001",
  "sku": "HAM-500G",
  "name": {
    "it": "Martello carpentiere 500g"
  },
  "description": {
    "it": "Martello professionale con manico in legno"
  },
  "short_description": {
    "it": "Martello 500g manico legno"
  },
  "price": 15.99,
  "currency": "EUR",
  "stock_quantity": 75,
  "status": "published"
}
```

---

## 🚀 Batch Import API

### Authentication

All API requests require B2B authentication using JWT tokens.

**Login Request:**
```bash
curl -X POST https://your-domain.com/api/b2b/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@company.com",
    "password": "your-password"
  }'
```

**Login Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-id",
    "email": "your-email@company.com",
    "tenant_id": "your-tenant-id"
  }
}
```

### Batch Import Endpoint

**Endpoint:** `POST /api/b2b/pim/import`

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "source_id": "wholesale-import",
  "batch_id": "batch_20251121_123",
  "products": [
    {
      "entity_code": "PRODUCT-001",
      "sku": "SKU-001",
      "name": "Product Name",
      "price": 99.99,
      "currency": "EUR",
      "stock_quantity": 100
    },
    {
      "entity_code": "PRODUCT-002",
      "sku": "SKU-002",
      "name": {
        "it": "Nome Prodotto",
        "en": "Product Name"
      },
      "price": 149.99,
      "currency": "EUR",
      "stock_quantity": 50
    }
  ]
}
```

**Success Response:**
```json
{
  "success": true,
  "job_id": "import-job-123456",
  "queued": 2,
  "message": "Import job created successfully"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Invalid product data",
  "details": [
    {
      "product": "PRODUCT-001",
      "field": "price",
      "message": "Price is required"
    }
  ]
}
```

### Full cURL Example

```bash
# 1. Login and get token
TOKEN=$(curl -X POST https://your-domain.com/api/b2b/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@company.com",
    "password": "password"
  }' | jq -r '.token')

# 2. Import products
curl -X POST https://your-domain.com/api/b2b/pim/import \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source_id": "wholesale-import",
    "batch_id": "batch_20251121_456",
    "products": [
      {
        "entity_code": "TOOL-001",
        "sku": "TL-001",
        "name": {
          "it": "Cacciavite",
          "en": "Screwdriver"
        },
        "description": {
          "it": "Cacciavite professionale",
          "en": "Professional screwdriver"
        },
        "price": 12.99,
        "currency": "EUR",
        "stock_quantity": 100,
        "status": "published"
      }
    ]
  }'

# 3. Track batch progress
curl -X GET "https://your-domain.com/api/b2b/pim/products?batch_id=batch_20251121_456" \
  -H "Authorization: Bearer $TOKEN"
```

---

## ⚙️ Configuration

### Default Language

The system uses **Italian (IT)** as the default language. This is configured in the system and automatically applied to all string fields when language objects are not provided.

To change the default language, update the configuration in your environment:

```env
DEFAULT_LANGUAGE=it  # Italian (default)
```

### Supported Languages

The system supports 43+ languages including:

- 🇮🇹 Italian (it) - **Default**
- 🇬🇧 English (en)
- 🇩🇪 German (de)
- 🇫🇷 French (fr)
- 🇪🇸 Spanish (es)
- 🇵🇹 Portuguese (pt)
- 🇳🇱 Dutch (nl)
- 🇵🇱 Polish (pl)
- 🇨🇿 Czech (cs)
- 🇷🇺 Russian (ru)
- And many more...

---

## 📊 Performance

**Batch Import Performance:**

- **Small batches** (1-100 products): ~2-5 seconds
- **Medium batches** (100-1000 products): ~10-30 seconds
- **Large batches** (1000+ products): Processed via queue system

**Recommendations:**

- Keep batches under 500 products for optimal performance
- Use the job tracking API to monitor large imports
- Enable compression for large payloads

---

## 🔍 Job Tracking

After importing, track your job progress:

**Endpoint:** `GET /api/b2b/pim/jobs/{job_id}`

```bash
curl -X GET https://your-domain.com/api/b2b/pim/jobs/import-job-123456 \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "job_id": "import-job-123456",
  "status": "completed",
  "progress": {
    "total": 100,
    "processed": 100,
    "successful": 98,
    "failed": 2
  },
  "errors": [
    {
      "product": "PRODUCT-050",
      "error": "Invalid category ID"
    }
  ],
  "created_at": "2025-11-21T10:00:00Z",
  "completed_at": "2025-11-21T10:02:15Z"
}
```

---

## ❓ FAQ

**Q: What happens if I provide both string and multilingual format?**

A: The system prioritizes multilingual objects. If a field has a multilingual object, it uses that. Simple strings are converted to default language.

**Q: Can I mix languages in the same import?**

A: Yes! Each product can have different language combinations.

**Q: What's the maximum batch size?**

A: There's no hard limit, but we recommend batches of 500 products for optimal performance.

**Q: How do I update existing products?**

A: Use the same endpoint with the existing `entity_code`. The system will update the product instead of creating a new one.

---

## 📞 Support

For issues or questions:
- GitHub: https://github.com/loziogigio/vinc-pim
- Create an issue with the `import` label