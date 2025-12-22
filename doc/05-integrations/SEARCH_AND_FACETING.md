# Search & Faceting API

This document describes the search and faceting API endpoints for the PIM system.

---

## Overview

The PIM search system provides:
- **Full-text search** across multilingual product fields
- **Faceted filtering** with hierarchical support (categories, brands, product types)
- **Variant handling** with `include_faceting` control
- **Response enrichment** from MongoDB (source of truth)
- **Automatic schema management** with language-aware field types
- **Weighted field boosting** for relevance ranking

---

## 1. Solr Schema Management

### Automatic Schema Creation

The PIM system automatically manages Solr schema fields when languages are enabled/disabled. This ensures proper multilingual support with language-specific analyzers.

#### Base Fields

Non-language fields are created automatically:

| Field | Type | Description |
|-------|------|-------------|
| `entity_code` | string | Product identifier |
| `sku` | string | Stock keeping unit |
| `ean` | strings | EAN barcodes (multi-valued) |
| `price` | pdouble | Product price |
| `quantity` | pint | Stock quantity |
| `stock_status` | string | in_stock, out_of_stock, pre_order |
| `brand_id` | string | Brand identifier |
| `category_id` | string | Category identifier |
| `category_ancestors` | strings | Hierarchy path for faceting |
| `has_active_promo` | boolean | Has active promotion |
| `completeness_score` | pint | Quality score (0-100) |

#### Multilingual Fields

For each enabled language, text fields are created with proper analyzers:

```
name_text_{lang}           → Full-text search (tokenized)
name_sort_{lang}           → Prefix matching (lowercase string)
description_text_{lang}    → Full-text search
short_description_text_{lang}
features_text_{lang}       → Multi-valued features
attr_values_text_{lang}    → Attribute values for search
attr_labels_text_{lang}    → Attribute labels
category_name_text_{lang}  → Category name search
synonym_terms_text_{lang}  → Synonym dictionary terms for enhanced search
```

**Naming Convention:**
- `*_text_{lang}` - Tokenized text fields (e.g., `name_text_it`)
- `*_sort_{lang}` - Lowercase string fields for prefix matching (e.g., `name_sort_it`)

#### Language-Specific Analyzers

Each language uses appropriate Solr analyzers:

| Language | Analyzer | Features |
|----------|----------|----------|
| `text_it` | Italian | Lowercase, stopwords, light stemming |
| `text_de` | German | Normalization, light stemming |
| `text_en` | English | Porter stemming |
| `text_fr` | French | Elision, light stemming |
| `text_es` | Spanish | Light stemming |
| `text_cjk` | Chinese/Japanese/Korean | CJK bigram tokenization |
| `text_ar` | Arabic | Normalization, stemming |
| `text_general` | Generic | Lowercase only |

#### Dynamic Attribute Fields

Product attributes are indexed using Solr's dynamic field patterns:

| Pattern | Type | Example |
|---------|------|---------|
| `attribute_{key}_s` | String | `attribute_colore_s = "ROSSO"` |
| `attribute_{key}_f` | Float | `attribute_peso_f = 12.5` |
| `attribute_{key}_b` | Boolean | `attribute_disponibile_b = true` |
| `attribute_{key}_ss` | String array | `attribute_taglie_ss = ["S", "M", "L"]` |

### Schema Initialization

```bash
# Schema is automatically initialized when enabling search for a language
POST /api/admin/languages/{code}/enable-search

# Example: Enable Italian search indexing
curl -X POST http://localhost:3001/api/admin/languages/it/enable-search
```

**What happens:**
1. Creates `text_{lang}` field type with language-specific analyzer
2. Creates all multilingual fields (`name_text_{lang}`, etc.)
3. Creates base fields if missing
4. Replaces existing fields with correct types

---

## 2. Language Sync & Indexing

### Language Configuration

Languages are managed in the `languages` MongoDB collection:

```typescript
interface Language {
  code: string;              // ISO 639-1 (e.g., "it", "de", "en")
  name: string;              // Display name
  nativeName: string;        // Native name
  flag?: string;             // Flag emoji
  isDefault: boolean;        // Default/fallback language
  isEnabled: boolean;        // Active for data entry
  searchEnabled: boolean;    // Solr indexing enabled ⭐
  solrAnalyzer: string;      // Solr field type (e.g., "text_it")
  direction: "ltr" | "rtl";
  order: number;
}
```

### Enabling Search for a Language

```bash
# Enable search indexing for German
POST /api/admin/languages/de/enable-search
```

**What happens:**
1. Sets `searchEnabled: true` in MongoDB
2. Creates `text_de` field type in Solr
3. Creates all German text fields (`name_text_de`, etc.)
4. Triggers reindexing of products with German content

### Sync Flow

```
┌─────────────────────────────────────────────────────┐
│  1. Enable Language Search                           │
│     POST /api/admin/languages/{code}/enable-search  │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│  2. Create Solr Schema                               │
│     - Add field type (text_{lang})                   │
│     - Add multilingual fields                        │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│  3. Reindex Products                                 │
│     - Extract content for new language               │
│     - Index to new fields                            │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│  4. Search Available                                 │
│     POST /api/search/search { lang: "{code}" }      │
└─────────────────────────────────────────────────────┘
```

### Localization Fallback

When searching, content falls back through the language chain:

1. **Requested language** (`lang` parameter)
2. **Default language** (`isDefault: true`)
3. **First enabled language** (by `order`)
4. **First available value**

---

## 3. Text Search & Boosting

### Search Field Weights

The search engine uses weighted field boosting for relevance ranking. **Code fields have the highest priority** so exact code matches always appear first:

| Field | Exact Match | Prefix (term*) | Contains (*term*) |
|-------|-------------|----------------|-------------------|
| `entity_code` | **50,000** ⭐ | - | - |
| `ean` | **45,000** ⭐ | - | - |
| `sku` | **40,000** ⭐ | 30,000 | - |
| `parent_entity_code` | **35,000** | - | - |
| `parent_sku` | **30,000** | 20,000 | - |
| `name_sort_{lang}` | - | 10,000 | - |
| `name_text_{lang}` | 5,000 | 2,000 | 800 |
| `synonym_terms_text_{lang}` | 4,500 | 1,800 | 700 |
| `brand_label` | 200 | 80 | - |
| `product_model` | 150 | 50 | - |
| `attr_values_text_{lang}` | 80 | 30 | - |
| `category_name_text_{lang}` | 40 | 12 | - |
| `short_description_text_{lang}` | 20 | 8 | 3 |
| `description_text_{lang}` | 20 | 8 | 3 |

**Key points:**
- **Code fields rank highest** - searching "F9998260" will always show exact SKU/entity_code/EAN matches first
- **Parent code search** - searching "F20071" finds all child products with that `parent_entity_code`
- Code fields (`sku`, `entity_code`, `ean`) use `lowercase` type for **case-insensitive** search
- `name_sort_{lang}` has high prefix weight (10,000) for "starts with" matching
- **Synonym search** - products associated with synonym dictionaries are found via `synonym_terms_text_{lang}`
- Text fields use tokenized search + wildcard patterns
- **AND logic** - All search terms are required (no false positives)

### Query Building Strategy

For search text `"caldaia economica"`:

```
Query: caldaia economica

Step 1: Split into terms → ["caldaia", "economica"]

Step 2: For each term, build weighted field queries:
  - entity_code:caldaia^1000
  - sku:caldaia^800
  - sku:caldaia*^600
  - name_sort_it:caldaia*^2000    ← Prefix on string field
  - name_text_it:caldaia^500      ← Tokenized exact
  - name_text_it:caldaia*^200     ← Tokenized prefix
  - name_text_it:*caldaia*^50     ← Contains
  - brand_label:caldaia^350
  - ...

Step 3: Apply term position boost (earlier terms weighted higher):
  - caldaia: boost × 1.5 × (2 - 0) = 3.0
  - economica: boost × 1.5 × (2 - 1) = 1.5

Step 4: Combine with AND (all terms required):
  +((field queries for caldaia)^3.0) +((field queries for economica)^1.5)

Note: All terms use the + prefix to ensure ALL terms must match.
This prevents false positives (e.g., "foo bar" won't match if only "bar" exists).
```

### Fuzzy Search

Enable fuzzy matching for typo tolerance:

```json
{
  "text": "caldaie",
  "lang": "it",
  "fuzzy": true,
  "fuzzy_num": 1
}
```

With `fuzzy: true`:
- `name_text_it:caldaie~1^500` matches "caldaia", "caldaie", "caladie"
- Works on text fields, not exact match fields (entity_code, ean)

### Synonym Search

Synonym Dictionaries enhance search by associating products with groups of related terms. When a user searches for any term in a dictionary, products associated with that dictionary are found.

#### How It Works

1. **Synonym Dictionary**: A collection of related terms (e.g., "split", "condizionatore", "clima", "climatizzatore")
2. **Product Association**: Products are linked to dictionaries via `synonym_keys` array
3. **Solr Indexing**: All dictionary terms are expanded into `synonym_terms_text_{lang}` field
4. **Search Matching**: Searching any term finds all associated products

#### Example

**Dictionary "climatizzatore" (Italian):**
```json
{
  "key": "climatizzatore",
  "locale": "it",
  "terms": ["split", "condizionatore", "clima", "climatizzatore", "aria condizionata"]
}
```

**Product association:**
```json
{
  "entity_code": "084211",
  "synonym_keys": ["climatizzatore"]
}
```

**Indexed in Solr:**

```text
synonym_terms_text_it: ["split", "condizionatore", "clima", "climatizzatore", "aria condizionata"]
```

**Search behavior:**
- Searching "split" → finds product 084211 (via synonym_terms_text_it)
- Searching "aria condizionata" → finds product 084211
- Searching "climatizzatore" → finds product 084211

#### Synonym Terms Field Weight

The `synonym_terms_text_{lang}` field has weight **4,500** for exact match, placing it just below `name_text_{lang}` but above other descriptive fields. This ensures:

- Synonym matches appear prominently in results
- Product name matches still rank slightly higher
- Synonym search doesn't overshadow code/SKU exact matches

### Search Examples

#### Basic Text Search

```bash
curl -X POST http://localhost:3001/api/search/search \
  -H "Content-Type: application/json" \
  -d '{
    "text": "caldaia economica",
    "lang": "it",
    "rows": 20
  }'
```

#### Prefix Search (starts with)

Products starting with "cald":
```bash
curl -X POST http://localhost:3001/api/search/search \
  -H "Content-Type: application/json" \
  -d '{
    "text": "cald",
    "lang": "it"
  }'
```

The `name_sort_it:cald*^2000` query ensures "starts with" matches rank highest.

#### Fuzzy Search with Typo Tolerance

```bash
curl -X POST http://localhost:3001/api/search/search \
  -H "Content-Type: application/json" \
  -d '{
    "text": "cadaia",
    "lang": "it",
    "fuzzy": true,
    "fuzzy_num": 2
  }'
```

Matches "caldaia" despite typo (edit distance ≤ 2).

---

## 4. Variant Grouping

Group search results by parent product to show variants together.

### Simple Variant Grouping (`group_variants`)

**Recommended approach** - automatically groups by `parent_entity_code` and returns each product with its variants as a nested array:

```bash
# POST
curl -X POST http://localhost:3001/api/search/search \
  -H "Content-Type: application/json" \
  -d '{
    "text": "caldaia",
    "lang": "it",
    "group_variants": true,
    "rows": 10
  }'

# GET
curl "http://localhost:3001/api/search/search?lang=it&text=caldaia&group_variants=true&rows=10"
```

### `group_variants` Response Structure

Each result has a `variants` array containing sibling products:

```json
{
  "success": true,
  "data": {
    "numFound": 366,
    "results": [
      {
        "entity_code": "079496",
        "sku": "0010038405",
        "name": "Caldaia a condensazione modello thematek condens",
        "is_parent": false,
        "parent_entity_code": "F20071",
        "brand": { "brand_id": "HER", "label": "HERMANN SAUNIER DUVAL" },
        "variants": [
          {
            "entity_code": "073214",
            "sku": "0010026147",
            "name": "Caldaia a condensazione modello thematek condens",
            "is_parent": false,
            "parent_entity_code": "F20071",
            "price": 1250.00,
            ...
          }
        ],
        ...
      },
      {
        "entity_code": "F20112",
        "sku": "F20112",
        "name": "Caldaia murale ...",
        "is_parent": true,
        "variants": [
          { "entity_code": "081234", "sku": "...", ... },
          { "entity_code": "081235", "sku": "...", ... }
        ],
        ...
      }
    ],
    "grouped": {
      "field": "parent_entity_code",
      "ngroups": 366,
      "matches": 707,
      "groups": [...]
    }
  }
}
```

**Key behaviors:**
- Groups by `parent_entity_code` with unlimited variants (`group.limit: -1`)
- If parent product (`is_parent: true`) is in the group, it becomes the representative
- If no parent in group, first child becomes the representative
- Other products in the group become the `variants` array
- `numFound` returns number of groups (unique products), not total documents

### Manual Grouping (`group`)

For more control over grouping behavior:

```bash
curl -X POST http://localhost:3001/api/search/search \
  -H "Content-Type: application/json" \
  -d '{
    "text": "caldaia",
    "lang": "it",
    "rows": 10,
    "group": {
      "field": "parent_entity_code",
      "limit": 3
    }
  }'
```

### Group Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `field` | string | required | Field to group by (e.g., `parent_entity_code`) |
| `limit` | number | 3 | Max products per group (-1 for all) |
| `sort` | string | - | Sort within group (e.g., `price asc`) |
| `ngroups` | boolean | true | Return total number of groups |

### Manual Group Response Structure

```json
{
  "success": true,
  "data": {
    "results": [...],           // Flat array (backwards compatible)
    "grouped": {
      "field": "parent_entity_code",
      "ngroups": 366,           // Total unique groups
      "matches": 707,           // Total matching documents
      "groups": [
        {
          "groupValue": "F20071",   // Parent entity code
          "numFound": 2,            // Variants in this group
          "docs": [                 // Products (max = group.limit)
            {
              "sku": "0010038405",
              "name": "Caldaia a condensazione modello thematek condens",
              "parent_sku": "F20071",
              "parent_entity_code": "F20071",
              "brand": { "brand_id": "HER", "label": "HERMANN SAUNIER DUVAL" },
              ...
            },
            {
              "sku": "0010026147",
              "name": "Caldaia a condensazione modello thematek condens",
              "parent_sku": "F20071",
              ...
            }
          ]
        },
        {
          "groupValue": "F20112",
          "numFound": 2,
          "docs": [...]
        }
      ]
    },
    "numFound": 707,
    "start": 0
  }
}
```

### Comparison: `group_variants` vs `group`

| Feature | `group_variants: true` | `group: {...}` |
|---------|------------------------|----------------|
| Configuration | Single flag | Full options object |
| Variants location | Nested in `variants` array | In `grouped.groups[].docs` |
| Group limit | Unlimited (-1) | Configurable |
| Representative | Auto-selects parent or first child | First doc in group |
| Use case | E-commerce product listing | Custom grouping scenarios |

### Filter by Parent

Get all variants of a specific parent product:

```bash
curl -X POST http://localhost:3001/api/search/search \
  -H "Content-Type: application/json" \
  -d '{
    "lang": "it",
    "filters": {
      "parent_entity_code": "F20071"
    }
  }'
```

Or filter by parent SKU:

```bash
curl -X POST http://localhost:3001/api/search/search \
  -H "Content-Type: application/json" \
  -d '{
    "lang": "it",
    "filters": {
      "parent_sku": "F20071"
    }
  }'
```

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

  // Variant Grouping (recommended)
  group_variants?: boolean;          // Group by parent_entity_code with variants array (default: false)

  // Manual Grouping (advanced)
  group?: {
    field: string;                   // Field to group by
    limit?: number;                  // Max products per group (default: 3, -1 for unlimited)
    sort?: string;                   // Sort within group (e.g., "price asc")
    ngroups?: boolean;               // Return total group count (default: true)
  };

  // Facets (optional, include with search)
  facet_fields?: string[];

  // Fuzzy search
  fuzzy?: boolean;                   // Enable typo tolerance (default: false)
  fuzzy_num?: number;                // Edit distance 1-2 (default: 1)
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

**Last Updated**: 2025-12-18
**Version**: 3.2
