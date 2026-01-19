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

  // Channel-specific metadata (placeholder for future implementation)
  channel_metadata?: {
    b2b?: {
      tenant_id?: string | string[];           // B2B tenant identifier(s)
    };
    b2c?: {
      store_id?: string | string[];            // B2C store identifier(s) - supports arrays
    };
    amazon?: {
      marketplace_id?: string | string[];      // Amazon marketplace ID(s)
      seller_id?: string | string[];           // Amazon seller ID(s)
    };
    ebay?: {
      marketplace_id?: string | string[];      // eBay marketplace ID(s)
      account_id?: string | string[];          // eBay account ID(s)
    };
    [key: string]: any;             // Custom metadata for other channels
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

**Example with Channel Metadata (Single Store):**
```json
{
  "source_id": "wholesale-import",
  "batch_id": "batch_tenant_001",
  "products": [
    {
      "entity_code": "PROD-001",
      "name": "Product 1",
      "price": 19.99,
      "wholesale_price": 14.99
    }
  ],
  "channel_metadata": {
    "b2b": {
      "tenant_id": "tenant_wholesale_electronics"
    },
    "b2c": {
      "store_id": "store_italy_001"  // Single store (string)
    },
    "amazon": {
      "marketplace_id": "A11IL2PNWYJU7H",
      "seller_id": "A1234567890123"
    }
  }
}
```

**Example with Channel Metadata (Multiple Stores):**
```json
{
  "source_id": "wholesale-import",
  "batch_id": "batch_multstore_001",
  "products": [
    {
      "entity_code": "PROD-002",
      "name": "Universal Product",
      "price": 29.99,
      "wholesale_price": 19.99
    }
  ],
  "channel_metadata": {
    "b2b": {
      "tenant_id": ["tenant_001", "tenant_002"]  // Multiple tenants (array)
    },
    "b2c": {
      "store_id": ["store_italy", "store_spain", "store_france"]  // Multiple stores (array)
    },
    "amazon": {
      "marketplace_id": ["A11IL2PNWYJU7H", "A1PA6795UKMFR9"],  // Italy & Germany
      "seller_id": "A1234567890123"
    },
    "ebay": {
      "marketplace_id": ["EBAY-IT", "EBAY-DE", "EBAY-FR"]  // Multiple marketplaces (array)
    }
  }
}
```

> **Note:** The `channel_metadata` field is a **placeholder** for future implementation. The API accepts and logs this metadata, but it is not yet passed to marketplace adapters during sync operations. This will be implemented in a future release to support multi-tenant B2B, multi-store B2C, and marketplace-specific routing.
>
> **Array Support:** All channel metadata fields support both single values (string) and multiple values (string array) for flexible routing to multiple tenants, stores, or marketplaces.

### Batch Size Limits and Recommendations

**Hard Limits:**
- **Maximum batch size:** 10,000 products per request (hard limit)
- **Warning threshold:** 5,000 products (triggers warning, still processes)
- Batches exceeding 10,000 products will be rejected with an error

**Performance Recommendations:**

| Batch Size | Processing Time | Status | Use Case |
|------------|----------------|--------|----------|
| **1-100** | 2-5 seconds | ✅ Optimal | Quick updates, testing |
| **100-500** | 10-30 seconds | ✅ Recommended | Regular imports |
| **500-1,000** | 30-60 seconds | ✅ Good | Large imports |
| **1,000-5,000** | 1-5 minutes | ⚠️ Acceptable | Very large imports |
| **5,000-10,000** | 5-10 minutes | ⚠️ Warning | Maximum size batches |
| **10,000+** | N/A | ❌ Rejected | Split into multiple batches |

**Best Practices:**
- ✅ **Recommended:** 100-500 products per batch for optimal performance
- ✅ **Large datasets:** Split into multiple batches under 5,000 products each
- ✅ Use `batch_metadata` for multi-part imports over 5,000 products
- ✅ Use job tracking API to monitor progress
- ⚠️ **Warning zone:** 5,000-10,000 products (slower, but allowed)
- ❌ **Hard limit:** Maximum 10,000 products per single request

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

**Batch Size Exceeded Error:**

If your batch exceeds the 10,000 product limit:

```json
{
  "success": false,
  "error": "Batch size limit exceeded",
  "message": "Batch size 15,000 exceeds maximum allowed 10,000. Please split into smaller batches or contact support to increase the limit for this source.",
  "batch_size": 15000,
  "max_allowed": 10000,
  "suggestion": "Split into 2 batches of 7,500 products each"
}
```

**Validation Errors:**

If validation fails for products in the batch:

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

**Warning (5,000+ products):**

Batches between 5,000-10,000 products will log a warning but still process:

```
⚠️ Large batch detected: 7,500 items (threshold: 5,000)
Processing may take longer than usual. Consider splitting into smaller batches.
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

  // Packaging & Pricing (see Pricing & Packaging API for full details)
  packaging_options?: PackagingOption[];  // Multiple packaging options with pricing

  // Inventory
  stock_quantity: number;           // Available quantity
  manage_stock?: boolean;           // Enable stock management
  stock_status?: 'in_stock' | 'out_of_stock' | 'on_backorder';

  // Classification (Embedded entities - see Entity Schemas section below)
  brand?: BrandEmbedded;            // Brand object with brand_id, label, slug, etc.
  category?: CategoryEmbedded;      // Category object with category_id, name, slug, etc.
  collections?: CollectionEmbedded[]; // Array of collection objects
  product_type?: ProductTypeEmbedded; // Product type with product_type_id, name, features, etc.
  tags?: TagEmbedded[];             // Array of tag objects

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
  type: 'document' | 'video' | '3d-model';  // Media type
  url: string;                               // Media URL or CDN URL
  cdn_key?: string;                          // CDN key for uploaded files
  file_name?: string;                        // Original file name
  file_type?: string;                        // File extension (pdf, mp4, glb, etc.)
  size_bytes?: number;                       // File size in bytes
  name?: string | MultilingualString;        // Display name
  label?: string | MultilingualString;       // Label/description
  position?: number;                         // Display order
  is_external_link?: boolean;                // True if URL is external link
}

// Supported media formats
// - document: pdf, txt, csv, xls, xlsx (max 10MB)
// - video: mp4, webm, mov (max 100MB)
// - 3d-model: glb, gltf, obj, fbx (max 50MB)

// Attribute value type
type AttributeValue = string | number | boolean | string[] | MultilingualString;

// Packaging option with reference-based pricing
interface PackagingOption {
  code: string;                       // Packaging code (e.g., "PZ", "BOX", "CF")
  label?: MultilingualString;         // Multilingual label
  qty: number;                        // Quantity per packaging unit
  uom: string;                        // Unit of measure (e.g., "PZ")
  is_default: boolean;                // Is this the default packaging?
  is_smallest: boolean;               // Is this the smallest unit?
  ean?: string;                       // EAN barcode
  position?: number;                  // Display order
  pricing?: {
    list?: number;                    // List price (B2B cost)
    retail?: number;                  // Retail price (MSRP)
    sale?: number;                    // Sale/discounted price
    price_ref?: string;               // Reference packaging code (e.g., "PZ")
    list_discount_pct?: number;       // % discount from retail to list
    list_discount_amt?: number;       // Fixed discount from retail to list
    sale_discount_pct?: number;       // % discount from list to sale
    sale_discount_amt?: number;       // Fixed discount from list to sale
  };
  promotions?: PackagingPromotion[];  // Packaging-level promotions
}

// Promotion tied to packaging option
interface PackagingPromotion {
  promo_code: string;                 // Promotion code identifier
  promo_row?: number;                 // Row number from ERP
  is_active: boolean;                 // Is promotion currently active?
  promo_type?: string;                // Business category (STD, XXX, OMG, EOL)
  label?: MultilingualString;         // Promotion label
  discount_percentage?: number;       // Percentage discount
  discount_amount?: number;           // Fixed amount discount
  promo_price?: number;               // Final promotional price
  min_quantity?: number;              // Minimum quantity required
  start_date?: string;                // Promotion start date (ISO 8601)
  end_date?: string;                  // Promotion end date (ISO 8601)
  is_stackable?: boolean;             // Can stack with same promo_code?
  priority?: number;                  // Priority (lower = higher)
}
```

> **For complete Pricing & Packaging documentation, see: [Pricing & Packaging API](../02-api/pricing-packaging-api.md)**

### Entity Schemas

#### Brand Entity

**Supports two embedding modes:**
- **Minimal:** Only essential fields (brand_id, label, slug)
- **Self-contained:** Full object with all metadata

```typescript
interface BrandEmbedded {
  // Required fields
  brand_id: string;              // Unique brand identifier (required)
  label: string;                 // Brand name/label (required)
  slug: string;                  // URL-friendly slug (required)

  // Optional fields (for self-contained mode)
  description?: string;          // Brand description
  logo_url?: string;             // Logo image URL
  website_url?: string;          // Brand website URL
  is_active?: boolean;           // Active status
  product_count?: number;        // Number of products (cached)
  display_order?: number;        // Display order
}
```

**Example - Minimal:**
```json
{
  "brand_id": "bosch-professional",
  "label": "Bosch Professional",
  "slug": "bosch-professional"
}
```

**Example - Self-contained with Brand Family (Recommended for Brand Hierarchies):**
```json
{
  "brand_id": "bosch-professional",
  "label": "Bosch Professional",
  "slug": "bosch-professional",
  "parent_brand_id": "bosch",
  "brand_family": "Bosch",
  "level": 1,
  "hierarchy": [
    {
      "brand_id": "bosch",
      "label": "Bosch",
      "slug": "bosch",
      "level": 0
    }
  ],
  "description": "Professional power tools and accessories",
  "logo_url": "https://cdn.example.com/brands/bosch-professional-logo.png",
  "website_url": "https://www.bosch-professional.com",
  "is_active": true,
  "product_count": 1250,
  "display_order": 1
}
```

> **Note:** All entity types (Brand, Category, Collection, Product Type, Tag) support the self-contained hierarchy pattern. See type definitions in `src/lib/db/models/types/` for complete schemas.

#### Category Entity

**Supports two embedding modes:**
- **Minimal:** Only essential fields (category_id, name, slug) - for simple references
- **Self-contained:** Full object with hierarchy data - **CRITICAL for faceting, breadcrumbs, and external imports**

> **Why Self-Contained?** When data comes from external systems (not PIM), products must be self-sustainable. Faceting and listing views cannot perform database lookups. The `hierarchy` field embeds full ancestor data, enabling breadcrumb navigation and hierarchical faceting without any database queries.

```typescript
interface CategoryEmbedded {
  // Required fields
  category_id: string;           // Unique category identifier
  name: MultilingualText;        // Multilingual: { "it": "Trapani", "de": "Bohrer", ... }
  slug: MultilingualText;        // Multilingual: { "it": "trapani", "de": "bohrer", ... }

  // Optional fields (for self-contained mode)
  details?: MultilingualText;    // Multilingual details/description
  description?: string;          // Description
  parent_id?: string;            // Parent category ID (for hierarchy reference)
  level?: number;                // Hierarchy level (0 = root, 1 = child, etc.)
  path?: string[];               // Ancestor IDs (e.g., ["1245", "1244"])

  /**
   * SELF-CONTAINED: Full hierarchy with ancestor data
   * Critical for faceting and breadcrumbs without database lookups
   */
  hierarchy?: CategoryHierarchyItem[];  // Full ancestor data (see example below)

  image?: {
    id: string;
    thumbnail: string;
    original: string;
  };
  icon?: string;                 // Icon class or SVG
  is_active?: boolean;           // Active status
  product_count?: number;        // Number of products (cached)
  display_order?: number;        // Display order
}

interface CategoryHierarchyItem {
  category_id: string;
  name: MultilingualText;
  slug: MultilingualText;
  level: number;
  description?: string;
  image?: {
    id: string;
    thumbnail: string;
    original: string;
  };
  icon?: string;
}
```

**Example - Minimal (Simple Reference):**
```json
{
  "category_id": "644",
  "name": {
    "it": "Trapani",
    "en": "Drills"
  },
  "slug": {
    "it": "trapani",
    "en": "drills"
  }
}
```

**Example - Self-contained with Full Hierarchy (Recommended for External Systems):**
```json
{
  "category_id": "644",
  "name": {
    "it": "Ferramenta",
    "en": "Hardware"
  },
  "slug": {
    "it": "ferramenta",
    "en": "hardware"
  },
  "parent_id": "1244",
  "level": 2,
  "path": ["1245", "1244"],
  "hierarchy": [
    {
      "category_id": "1245",
      "name": {
        "it": "Utensili",
        "en": "Tools"
      },
      "slug": {
        "it": "utensili",
        "en": "tools"
      },
      "level": 0,
      "description": "All types of tools"
    },
    {
      "category_id": "1244",
      "name": {
        "it": "Elettroutensili",
        "en": "Power Tools"
      },
      "slug": {
        "it": "elettroutensili",
        "en": "power-tools"
      },
      "level": 1,
      "description": "Electric and battery powered tools"
    }
  ],
  "description": "General hardware and metal fittings",
  "is_active": true,
  "product_count": 850,
  "display_order": 1
}
```

**Benefits of Self-Contained Categories:**
- ✅ **Faceting:** Solr can build hierarchical facets without MongoDB lookups
- ✅ **Breadcrumbs:** Full category path available for display (Utensili > Elettroutensili > Ferramenta)
- ✅ **External Imports:** Products from external systems don't need PIM category references
- ✅ **Performance:** No database queries needed for listing/faceting views
- ✅ **Consistency:** Data remains consistent regardless of source (PIM, wholesaler, manual import)

**When to Use Each Mode:**
- **Minimal:** When importing from PIM where category data is managed centrally
- **Self-contained:** When importing from external systems, for faceting-heavy views, or when category data updates infrequently

#### Collection Entity

**Supports two embedding modes:**
- **Minimal:** Only essential fields (collection_id, name, slug)
- **Self-contained:** Full object with metadata

```typescript
interface CollectionEmbedded {
  // Required fields
  collection_id: string;         // Unique collection identifier
  name: MultilingualText;        // Multilingual: { "it": "Novità", "en": "New Arrivals", ... }
  slug: MultilingualText;        // Multilingual: { "it": "novita", "en": "new-arrivals", ... }

  // Optional fields (for self-contained mode)
  description?: string;          // Description
  is_active?: boolean;           // Active status
  product_count?: number;        // Number of products (cached)
  display_order?: number;        // Display order
}
```

**Example - Minimal:**
```json
{
  "collection_id": "summer-2024",
  "name": {
    "it": "Estate 2024",
    "en": "Summer 2024"
  },
  "slug": {
    "it": "estate-2024",
    "en": "summer-2024"
  }
}
```

**Example - Self-contained (Full):**
```json
{
  "collection_id": "summer-2024",
  "name": {
    "it": "Collezione Estate 2024",
    "en": "Summer Collection 2024"
  },
  "slug": {
    "it": "estate-2024",
    "en": "summer-2024"
  },
  "description": "Summer seasonal collection",
  "is_active": true,
  "product_count": 320,
  "display_order": 1
}
```

#### Product Type Entity

**Supports two embedding modes:**
- **Minimal:** Only essential fields (product_type_id, name, slug)
- **Self-contained:** Full object with features and metadata

```typescript
interface ProductTypeEmbedded {
  // Required fields
  product_type_id: string;       // Unique product type identifier
  name: MultilingualText;        // Multilingual: { "it": "Trapano", "de": "Bohrmaschine", ... }
  slug: MultilingualText;        // Multilingual: { "it": "trapano", "de": "bohrmaschine", ... }

  // Optional fields (for self-contained mode)
  features?: {
    key: string;                 // Feature key (e.g., "power")
    label: MultilingualText;     // Multilingual label
    value: string | number | boolean | string[];
    unit?: string;               // Unit of measure (e.g., "W", "mm")
  }[];
  description?: string;          // Description
  is_active?: boolean;           // Active status
  product_count?: number;        // Number of products (cached)
  display_order?: number;        // Display order
}
```

**Example - Minimal:**
```json
{
  "product_type_id": "cordless-drill",
  "name": {
    "it": "Trapano a Batteria",
    "en": "Cordless Drill"
  },
  "slug": {
    "it": "trapano-batteria",
    "en": "cordless-drill"
  }
}
```

**Example - Self-contained with Features:**
```json
{
  "product_type_id": "cordless-drill",
  "name": {
    "it": "Trapano a Batteria",
    "en": "Cordless Drill"
  },
  "slug": {
    "it": "trapano-batteria",
    "en": "cordless-drill"
  },
  "features": [
    {
      "key": "power",
      "label": { "it": "Potenza", "en": "Power" },
      "value": 750,
      "unit": "W"
    },
    {
      "key": "battery_voltage",
      "label": { "it": "Voltaggio Batteria", "en": "Battery Voltage" },
      "value": 18,
      "unit": "V"
    }
  ],
  "description": "Cordless drills for professional use",
  "is_active": true,
  "product_count": 85,
  "display_order": 1
}
```

#### Tag Entity

**Supports two embedding modes:**
- **Minimal:** Only essential fields (tag_id, name, slug)
- **Self-contained:** Full object with metadata

```typescript
interface TagEmbedded {
  // Required fields
  tag_id: string;                // Unique tag identifier
  name: MultilingualText;        // Multilingual: { "it": "Più venduto", "en": "Bestseller", ... }
  slug: string;                  // Universal slug (e.g., "bestseller")

  // Optional fields (for self-contained mode)
  description?: string;          // Description
  color?: string;                // Tag color (for UI)
  is_active?: boolean;           // Active status
  product_count?: number;        // Number of products (cached)
  display_order?: number;        // Display order
}
```

**Example - Minimal:**
```json
{
  "tag_id": "bestseller",
  "name": {
    "it": "Più venduto",
    "en": "Bestseller",
    "de": "Bestseller"
  },
  "slug": "bestseller"
}
```

**Example - Self-contained (Full):**
```json
{
  "tag_id": "bestseller",
  "name": {
    "it": "Più venduto",
    "en": "Bestseller",
    "de": "Bestseller"
  },
  "slug": "bestseller",
  "description": "Top selling products",
  "color": "#FFD700",
  "is_active": true,
  "product_count": 150,
  "display_order": 1
}
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
  "brand": {
    "brand_id": "professional-tools",
    "label": "Professional Tools",
    "slug": "professional-tools",
    "logo_url": "https://cdn.example.com/brands/professional-tools.png",
    "is_active": true
  },
  "category": {
    "category_id": "hand-tools",
    "name": {
      "it": "Utensili Manuali",
      "en": "Hand Tools",
      "de": "Handwerkzeuge"
    },
    "slug": {
      "it": "utensili-manuali",
      "en": "hand-tools",
      "de": "handwerkzeuge"
    }
  },
  "collections": [
    {
      "collection_id": "workshop-essentials",
      "name": {
        "it": "Essenziali per Officina",
        "en": "Workshop Essentials"
      },
      "slug": {
        "it": "essenziali-officina",
        "en": "workshop-essentials"
      }
    }
  ],
  "product_type": {
    "product_type_id": "screwdriver",
    "name": {
      "it": "Cacciavite",
      "en": "Screwdriver",
      "de": "Schraubendreher"
    },
    "slug": {
      "it": "cacciavite",
      "en": "screwdriver",
      "de": "schraubendreher"
    },
    "features": [
      {
        "key": "tip_type",
        "label": { "it": "Tipo Punta", "en": "Tip Type" },
        "value": "PH2"
      },
      {
        "key": "length",
        "label": { "it": "Lunghezza", "en": "Length" },
        "value": 150,
        "unit": "mm"
      }
    ]
  },
  "tags": [
    {
      "tag_id": "magnetic",
      "name": {
        "it": "Magnetico",
        "en": "Magnetic",
        "de": "Magnetisch"
      },
      "slug": "magnetic"
    },
    {
      "tag_id": "ergonomic",
      "name": {
        "it": "Ergonomico",
        "en": "Ergonomic",
        "de": "Ergonomisch"
      },
      "slug": "ergonomic"
    },
    {
      "tag_id": "professional",
      "name": {
        "it": "Professionale",
        "en": "Professional",
        "de": "Professionell"
      },
      "slug": "professional"
    }
  ],
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
      "type": "document",
      "url": "https://cdn.example.com/screwdriver-manual.pdf",
      "file_type": "pdf",
      "name": {
        "it": "Manuale d'uso",
        "en": "User manual",
        "de": "Benutzerhandbuch",
        "fr": "Manuel d'utilisation"
      },
      "position": 1
    },
    {
      "type": "video",
      "url": "https://cdn.example.com/screwdriver-demo.mp4",
      "file_type": "mp4",
      "name": {
        "it": "Video dimostrativo",
        "en": "Demo video",
        "de": "Demovideo",
        "fr": "Vidéo de démonstration"
      },
      "position": 2
    },
    {
      "type": "3d-model",
      "url": "https://cdn.example.com/screwdriver-model.glb",
      "file_type": "glb",
      "name": {
        "it": "Modello 3D",
        "en": "3D Model",
        "de": "3D-Modell",
        "fr": "Modèle 3D"
      },
      "position": 3
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

## 🔍 Solr Faceting with Category Hierarchy

When products are indexed to Solr, the self-contained category hierarchy enables powerful faceting without database lookups.

### Solr Document Structure

When a product with a self-contained category is indexed, Solr receives:

```json
{
  "id": "PROD-001",
  "sku": "SKU-001",
  "name_text_it": "Trapano Professionale",

  // Category faceting fields (language-independent)
  "category_id": "644",
  "category_path": [
    "1245",
    "1245/1244",
    "1245/1244/644"
  ],
  "category_ancestors": ["1245", "1244", "644"],
  "category_level": 2,

  // Category breadcrumb (language-specific)
  "category_breadcrumb_it": ["Utensili", "Elettroutensili", "Ferramenta"],
  "category_breadcrumb_en": ["Tools", "Power Tools", "Hardware"],

  // Category display fields
  "category_name_text_it": "Ferramenta",
  "category_name_text_en": "Hardware",
  "category_slug_text_it": "ferramenta",
  "category_slug_text_en": "hardware",

  // Full category object for display
  "category_json": "{...}"
}
```

### Faceting Examples

#### 1. Hierarchical Faceting (Drill-down Navigation)

**Query all products and get category hierarchy facets:**
```http
GET /solr/mycore/select?
  q=*:*&
  facet=true&
  facet.field=category_path&
  facet.limit=50
```

**Response:**
```json
{
  "facets": {
    "category_path": {
      "1245": 5000,                    // All products under "Utensili"
      "1245/1244": 3500,               // All products under "Elettroutensili"
      "1245/1244/644": 850,            // All products under "Ferramenta"
      "1245/1244/645": 1200,           // All products under another subcategory
      "1246": 2000                     // Different root category
    }
  }
}
```

#### 2. Breadcrumb Faceting (Named Categories)

**Italian breadcrumb faceting:**
```http
GET /solr/mycore/select?
  q=*:*&
  facet=true&
  facet.field=category_breadcrumb_it&
  rows=20
```

**Response:**
```json
{
  "facets": {
    "category_breadcrumb_it": [
      ["Utensili"],                                      // Root level
      ["Utensili", "Elettroutensili"],                  // Second level
      ["Utensili", "Elettroutensili", "Ferramenta"]    // Third level
    ]
  }
}
```

#### 3. Filter by Ancestor Category

**Show all products under "Utensili" (category 1245) and subcategories:**
```http
GET /solr/mycore/select?
  q=*:*&
  fq=category_ancestors:1245&
  facet=true&
  facet.field=category_path&
  facet.prefix=1245/
```

This returns all products in "Utensili" and any of its descendants.

#### 4. Filter by Specific Category Level

**Get only root categories (level 0):**
```http
GET /solr/mycore/select?
  q=*:*&
  facet=true&
  facet.query=category_level:0&
  facet.query=category_level:1&
  facet.query=category_level:2
```

### Frontend Integration Example

**Building breadcrumb navigation from Solr results:**

```javascript
// From Solr response
const product = {
  category_breadcrumb_it: ["Utensili", "Elettroutensili", "Ferramenta"],
  category_ancestors: ["1245", "1244", "644"],
  category_json: JSON.parse(categoryJsonString)
};

// Build breadcrumb links
const breadcrumbs = product.category_breadcrumb_it.map((name, index) => ({
  name: name,
  category_id: product.category_ancestors[index],
  url: `/categories/${product.category_ancestors[index]}`
}));

// Render: Utensili > Elettroutensili > Ferramenta
```

**Building faceted navigation:**

```javascript
// From Solr facet response
const facets = {
  category_path: {
    "1245": 5000,
    "1245/1244": 3500,
    "1245/1244/644": 850
  }
};

// Parse hierarchy
const hierarchyTree = buildTreeFromPaths(facets.category_path);
// Result:
// - Utensili (5000)
//   - Elettroutensili (3500)
//     - Ferramenta (850)
```

### Benefits of Self-Contained Faceting

✅ **No Database Lookups:** All category data is in Solr, enabling fast faceting
✅ **Multilingual Support:** Breadcrumbs available in all languages
✅ **Hierarchical Navigation:** Users can drill down or up the category tree
✅ **Consistent Data:** External imports work identically to PIM imports
✅ **Performance:** Faceting is instant, even with millions of products

### Solr Schema Requirements

Add these fields to your `managed-schema`:

```xml
<!-- Category hierarchy for faceting -->
<field name="category_id" type="string" indexed="true" stored="true"/>
<field name="category_path" type="strings" indexed="true" stored="true" multiValued="true"/>
<field name="category_ancestors" type="strings" indexed="true" stored="true" multiValued="true"/>
<field name="category_level" type="pint" indexed="true" stored="true"/>

<!-- Dynamic fields for language-specific breadcrumbs -->
<dynamicField name="category_breadcrumb_*" type="strings" indexed="true" stored="true" multiValued="true"/>
<dynamicField name="category_name_text_*" type="text_general" indexed="true" stored="true"/>
<dynamicField name="category_slug_text_*" type="text_general" indexed="true" stored="true"/>

<!-- Full category object for display -->
<field name="category_json" type="string" indexed="false" stored="true"/>
```

---

## ❓ FAQ

**Q: What happens if I provide both string and multilingual format?**

A: The system prioritizes multilingual objects. If a field has a multilingual object, it uses that. Simple strings are converted to default language.

**Q: Can I mix languages in the same import?**

A: Yes! Each product can have different language combinations.

**Q: What's the maximum batch size?**

A: The **hard limit is 10,000 products per request**. Batches over 5,000 products trigger a warning. For optimal performance, we recommend **100-500 products per batch**. For larger datasets, split into multiple batches using `batch_metadata`.

**Q: How do I update existing products?**

A: Use the same endpoint with the existing `entity_code`. The system will update the product instead of creating a new one.

---

## 📚 See Also

- **[Pricing & Packaging API](../02-api/pricing-packaging-api.md)** - Reference-based pricing, packaging options, and packaging-level promotions
- **[Multichannel Sync Guide](../05-integrations/MULTICHANNEL_SYNC.md)** - Complete guide to syncing products to marketplaces (eBay, Amazon, B2B, B2C, etc.)
- **[Channel Metadata](../05-integrations/MULTICHANNEL_SYNC.md#5-channel-specific-metadata-tenant-id-store-id)** - How to specify tenant IDs and store IDs for multi-tenant/multi-store setups

---

## 📞 Support

For issues or questions:
- GitHub: https://github.com/loziogigio/vinc-pim
- Create an issue with the `import` label