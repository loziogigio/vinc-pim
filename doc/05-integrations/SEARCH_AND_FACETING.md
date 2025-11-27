# Search & Faceting API

This document describes the search and faceting API endpoints for the PIM system.

---

## Overview

The PIM search system provides:
- **Full-text search** across multilingual product fields
- **Faceted filtering** with hierarchical support (categories, brands, product types)
- **Variant handling** with `include_faceting` control
- **Response enrichment** from MongoDB (source of truth)

---

## API Endpoints

### POST `/api/search/search`

Search products with filters, pagination, and sorting.

**Request:**

```typescript
{
  // Full-text search
  text?: string;                    // Search query
  lang: string;                     // Language code (it, en, de...)

  // Pagination
  start?: number;                   // Offset (default: 0)
  rows?: number;                    // Limit (default: 20, max: 100)

  // Filters
  filters?: {
    category_id?: string | string[];
    category_ancestors?: string | string[];
    brand_id?: string | string[];
    product_type_id?: string | string[];
    collection_ids?: string | string[];
    tag_groups?: string | string[];
    stock_status?: string | string[];
    has_active_promo?: boolean;
    price_min?: number;
    price_max?: number;
    sku?: string | string[];
    entity_code?: string | string[];
  };

  // Sorting
  sort?: {
    field: 'price' | 'relevance' | 'newest' | 'popularity' | 'name';
    order: 'asc' | 'desc';
  };

  // Facets (optional, include with search)
  facet_fields?: string[];
}
```

**Response:**

```typescript
{
  success: true,
  data: {
    results: Product[];           // Array of products
    numFound: number;             // Total matching products
    start: number;                // Offset
    facet_results?: {             // If facet_fields requested
      [field: string]: FacetValue[];
    };
  }
}
```

### POST `/api/search/facet`

Get facet values with counts based on current filters.

**Request:**

```typescript
{
  lang: string;                     // Language for labels
  filters?: Record<string, any>;    // Current filters
  text?: string;                    // Search context
  facet_fields: string[];           // Which facets to return
  facet_limit?: number;             // Max values per facet (default: 100)
}
```

**Response:**

```typescript
{
  success: true,
  data: {
    facet_results: {
      [field: string]: FacetValue[];
    }
  }
}
```

### GET `/api/search/facet/fields`

Discover available facet fields including dynamic attribute fields. Use this endpoint to find all facetable fields in your index.

**Response:**

```typescript
{
  success: true,
  data: {
    static_fields: FieldInfo[];      // Configured facet fields (brand_id, category_id, etc.)
    attribute_fields: FieldInfo[];   // Dynamic attribute fields (attribute_color_s, etc.)
    dynamic_fields: FieldInfo[];     // Other dynamic fields
    total_attribute_fields: number;  // Count of attribute fields
  }
}
```

**FieldInfo Structure:**

```typescript
interface FieldInfo {
  name: string;                      // Solr field name
  type: 'static' | 'attribute' | 'dynamic';
  label: string;                     // Display label
  facet_type?: string;               // 'flat', 'range', 'hierarchical'
  value_type?: 'string' | 'float' | 'boolean';
  docs_count?: number;               // Number of documents with this field
}
```

**Example:**

```bash
curl http://localhost:3001/api/search/facet/fields
```

**Response Example:**

```json
{
  "success": true,
  "data": {
    "static_fields": [
      { "name": "brand_id", "type": "static", "label": "Brand", "facet_type": "flat", "docs_count": 1500 },
      { "name": "category_ancestors", "type": "static", "label": "Categories", "facet_type": "hierarchical", "docs_count": 1500 }
    ],
    "attribute_fields": [
      { "name": "attribute_color_s", "type": "attribute", "label": "Color", "facet_type": "flat", "value_type": "string", "docs_count": 1200 },
      { "name": "attribute_is_new_b", "type": "attribute", "label": "Is New", "facet_type": "flat", "value_type": "boolean", "docs_count": 300 }
    ],
    "dynamic_fields": [],
    "total_attribute_fields": 2
  }
}
```

---

## Product Response

Each product in search results includes:

```typescript
interface Product {
  // Identifiers
  id: string;
  sku: string;
  entity_code: string;

  // Localized text (for requested lang)
  name: string;
  slug: string;
  description?: string;
  short_description?: string;

  // Pricing & inventory
  price?: number;
  quantity?: number;
  stock_status?: string;         // "in_stock", "out_of_stock", "pre_order"

  // Media (from MongoDB)
  images?: ProductImage[];
  media?: MediaFile[];
  cover_image_url?: string;
  image_count?: number;

  // Entities (enriched from MongoDB)
  brand?: Brand;
  category?: Category;
  collections?: Collection[];
  product_type?: ProductType;
  tags?: Tag[];

  // Attributes (localized from MongoDB)
  attributes?: ProductAttributes;

  // Variants
  is_parent?: boolean;
  parent_entity_code?: string;

  // Quality
  completeness_score?: number;
}
```

---

## Entity Types

### Brand

```typescript
interface Brand {
  brand_id: string;
  label: string;
  slug: string;
  description?: string;
  logo_url?: string;
  website_url?: string;
  is_active?: boolean;
  product_count?: number;
  display_order?: number;

  // Hierarchy (for brand families)
  parent_brand_id?: string;
  brand_family?: string;
  level?: number;                    // 0 = parent, 1 = child
  path?: string[];                   // Ancestor brand IDs
  hierarchy?: BrandHierarchyItem[];
}

interface BrandHierarchyItem {
  brand_id: string;
  label: string;
  slug: string;
  logo_url?: string;
  level: number;
}
```

### Category

```typescript
interface Category {
  category_id: string;
  name: MultilingualText;            // { it: "Utensili", en: "Tools" }
  slug: MultilingualText;            // { it: "utensili", en: "tools" }
  details?: MultilingualText;
  description?: string;
  parent_id?: string;
  level?: number;                    // 0 = root, 1 = child, etc.
  path?: string[];                   // Ancestor IDs
  hierarchy?: CategoryHierarchyItem[];
  image?: {
    id: string;
    thumbnail: string;
    original: string;
  };
  icon?: string;
  is_active?: boolean;
  product_count?: number;
  display_order?: number;
}

interface CategoryHierarchyItem {
  category_id: string;
  name: MultilingualText;
  slug: MultilingualText;
  level: number;
  description?: string;
  image?: { id: string; thumbnail: string; original: string };
  icon?: string;
}
```

### Collection

```typescript
interface Collection {
  collection_id: string;
  name: MultilingualText;
  slug: MultilingualText;
  description?: string;
  is_active?: boolean;
  product_count?: number;
  display_order?: number;

  // Hierarchy (for nested collections)
  parent_collection_id?: string;
  level?: number;
  path?: string[];
  hierarchy?: CollectionHierarchyItem[];
}

interface CollectionHierarchyItem {
  collection_id: string;
  name: MultilingualText;
  slug: MultilingualText;
  level: number;
  description?: string;
}
```

### ProductType

```typescript
interface ProductType {
  product_type_id: string;
  name: MultilingualText;
  slug: MultilingualText;
  features?: ProductTypeFeature[];
  description?: string;
  is_active?: boolean;
  product_count?: number;
  display_order?: number;

  // Hierarchy
  parent_type_id?: string;
  level?: number;
  path?: string[];
  hierarchy?: ProductTypeHierarchyItem[];
  inherited_features?: ProductTypeFeature[];
}

interface ProductTypeFeature {
  key: string;
  label: MultilingualText;
  value?: string | number | boolean | string[];
  unit?: string;
}

interface ProductTypeHierarchyItem {
  product_type_id: string;
  name: MultilingualText;
  slug: MultilingualText;
  level: number;
  description?: string;
  features?: ProductTypeFeature[];
}
```

### Tag

```typescript
interface Tag {
  tag_id: string;
  name: MultilingualText;
  slug: string;
  description?: string;
  color?: string;                    // Hex color code
  is_active?: boolean;
  product_count?: number;
  display_order?: number;

  // Categorization
  tag_category?: string;             // "promotion", "feature", "seo"
  tag_group?: string;                // Group identifier
  tag_group_data?: TagGroupData;
}

interface TagGroupData {
  group_id: string;
  group_name: MultilingualText;
  group_slug: string;
  group_type?: string;               // "promotion", "feature", "seo", "custom"
  display_order?: number;
}
```

---

## Product Attributes

Attributes are localized based on the `lang` parameter. The response returns attributes for the requested language only.

### Attribute Structure

```typescript
type ProductAttributes = {
  [slug: string]: {
    key: string;                     // Attribute key/slug
    label: string;                   // Display label (localized)
    value: any;                      // Attribute value
    uom?: string;                    // Unit of measurement
  };
};
```

### Storage Format (MongoDB)

Attributes are stored in multilingual format:

```typescript
// MongoDB storage format
{
  attributes: {
    it: {
      colore: { key: "colore", label: "Colore", value: "Rosso" },
      peso: { key: "peso", label: "Peso", value: 2.5, uom: "kg" }
    },
    en: {
      colore: { key: "colore", label: "Color", value: "Red" },
      peso: { key: "peso", label: "Weight", value: 2.5, uom: "kg" }
    }
  }
}
```

### Response Format (API)

The API returns only the requested language:

```json
// Request: { "lang": "it" }
{
  "attributes": {
    "colore": { "key": "colore", "label": "Colore", "value": "Rosso" },
    "peso": { "key": "peso", "label": "Peso", "value": 2.5, "uom": "kg" }
  }
}
```

---

## Common Types

### MultilingualText

```typescript
type MultilingualText = {
  [lang: string]: string;            // { it: "Italiano", en: "English", de: "Deutsch" }
};
```

### Localization Fallback

Localization is configured in the `languages` collection in MongoDB. The fallback chain is:

1. Requested language (`lang` parameter)
2. Default language (from DB: `isDefault: true`)
3. First enabled language (sorted by `order`)
4. First available value

### Language Configuration (MongoDB)

```typescript
interface Language {
  code: string;              // ISO 639-1 code (e.g., "it", "de", "en")
  name: string;              // Display name (e.g., "Italian", "German")
  nativeName: string;        // Native name (e.g., "Italiano", "Deutsch")
  flag?: string;             // Flag emoji (e.g., "🇮🇹", "🇩🇪")
  isDefault: boolean;        // Default/fallback language
  isEnabled: boolean;        // Active for data entry
  searchEnabled: boolean;    // Solr indexing enabled
  solrAnalyzer: string;      // Solr field type (e.g., "text_it")
  direction: "ltr" | "rtl";  // Text direction
  order: number;             // Display order
}
```

**Note:** Only one language can have `isDefault: true`. This is the primary fallback when the requested language is not available

---

## Facet Value Response

```typescript
interface FacetValue {
  value: string;                  // Facet value (ID)
  count: number;                  // Matching products count
  label: string;                  // Display label (localized)
  key_label: string;              // Facet field display name

  // For hierarchical facets
  level?: number;
  parent_id?: string;

  // Full entity data (for brand, category, etc.)
  entity?: object;
}
```

---

## Available Facet Fields

### Hierarchical Facets

Support drill-down navigation with ancestor paths:

| Field | Description |
|-------|-------------|
| `category_ancestors` | Category hierarchy |
| `brand_ancestors` | Brand hierarchy |
| `product_type_ancestors` | Product type hierarchy |
| `collection_ancestors` | Collection hierarchy |

### Flat Facets

| Field | Description |
|-------|-------------|
| `brand_id` | Direct brand selection |
| `category_id` | Direct category selection |
| `product_type_id` | Direct product type selection |
| `stock_status` | Availability filter |
| `tag_groups` | Tag groups |
| `has_active_promo` | Has promotion (boolean) |

### Range Facets

| Field | Description |
|-------|-------------|
| `price` | Price ranges |
| `completeness_score` | Quality score ranges |

### Dynamic Attribute Facets

Product attributes are indexed as dynamic Solr fields and can be used for faceting. Use the `/api/search/facet/fields` endpoint to discover available attribute fields.

**Naming Convention:**

| Suffix | Type | Example |
|--------|------|---------|
| `_s` | String | `attribute_color_s` |
| `_f` | Float/Number | `attribute_weight_f` |
| `_b` | Boolean | `attribute_is_new_b` |

**Example attribute fields:**
- `attribute_color_s` - Color filter (string values)
- `attribute_size_s` - Size filter (string values)
- `attribute_is_new_b` - New arrivals filter (boolean)
- `attribute_weight_f` - Weight ranges (numeric)

---

## Usage Examples

### Basic Search

```bash
curl -X POST http://localhost:3001/api/search/search \
  -H "Content-Type: application/json" \
  -d '{
    "lang": "it",
    "text": "prodotto",
    "rows": 20
  }'
```

### Search with Filters

```bash
curl -X POST http://localhost:3001/api/search/search \
  -H "Content-Type: application/json" \
  -d '{
    "lang": "it",
    "text": "prodotto",
    "filters": {
      "brand_id": "BRAND123",
      "stock_status": "in_stock",
      "price_min": 10,
      "price_max": 100
    },
    "sort": { "field": "price", "order": "asc" }
  }'
```

### Search with Facets

```bash
curl -X POST http://localhost:3001/api/search/search \
  -H "Content-Type: application/json" \
  -d '{
    "lang": "it",
    "text": "prodotto",
    "facet_fields": ["brand_id", "category_ancestors", "stock_status", "price"]
  }'
```

### Get Facets Only

```bash
curl -X POST http://localhost:3001/api/search/facet \
  -H "Content-Type: application/json" \
  -d '{
    "lang": "it",
    "filters": { "brand_id": "BRAND123" },
    "facet_fields": ["category_ancestors", "stock_status"]
  }'
```

### Discover Available Facets

```bash
# Get all available facet fields
curl http://localhost:3001/api/search/facet/fields
```

### Use Dynamic Attribute Facets

After discovering attribute fields via `/api/search/facet/fields`, use them in search:

```bash
# Use discovered attribute fields in faceting
curl -X POST http://localhost:3001/api/search/search \
  -H "Content-Type: application/json" \
  -d '{
    "lang": "it",
    "facet_fields": ["brand_id", "attribute_color_s", "attribute_is_new_b"]
  }'
```

---

## Response Enrichment

Search results are automatically enriched with fresh data from MongoDB.

### Enriched Fields

| Field | Source | Notes |
|-------|--------|-------|
| `brand` | `brands` collection | Full entity with hierarchy |
| `category` | `categories` collection | Full entity with hierarchy |
| `collections` | `collections` collection | Full entities |
| `product_type` | `producttypes` collection | Full entity with features |
| `tags` | `tags` collection | Full entities |
| `attributes` | `pimproducts` collection | Localized for requested `lang` |
| `images` | `pimproducts` collection | Full image array |
| `media` | `pimproducts` collection | Localized labels |

### Localization

All multilingual fields are resolved based on the `lang` parameter with fallback to the default language configured in the `languages` collection (see [Language Configuration](#language-configuration-mongodb)).

---

## Error Handling

```typescript
// Success
{
  "success": true,
  "data": { ... }
}

// Error
{
  "error": "Search query failed",
  "details": {
    "code": "SOLR_ERROR",
    "message": "Connection refused"
  }
}
```

---

## Configuration

```bash
# Environment variables
SOLR_ENABLED=true
SOLR_URL=http://localhost:8983/solr
SOLR_CORE=your-core-name

# Search defaults
SEARCH_DEFAULT_ROWS=20
SEARCH_MAX_ROWS=100
FACET_DEFAULT_LIMIT=100
FACET_MIN_COUNT=1
```

---

**Last Updated**: 2025-11-27
**Version**: 2.3
