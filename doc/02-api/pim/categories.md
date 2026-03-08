# Categories

Categories organize products into a navigable hierarchy. The system supports up to N levels of nesting (typically 3: root, child, leaf) with slug-based URL navigation and Solr-powered faceting. Categories are **channel-aware** — root categories are assigned to a sales channel (e.g., `b2c`), and products can have different category assignments per channel via `channel_categories`.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Category (MongoDB)                                              │
│  Standalone document in `categories` collection                  │
│  Fields: category_id, name, slug, parent_id, level, path,       │
│          channel_code (root only)                                │
└──────────────────────────────────────────────────────────────────┘
                              │
               embedded on product (2 ways)
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Product.category (Primary — Embedded Subdocument)               │
│  Self-contained copy with full hierarchy for Solr indexing       │
│  Fields: category_id, name:{it}, slug:{it}, parent_id,          │
│          level, path[], hierarchy[], channel_code                │
├──────────────────────────────────────────────────────────────────┤
│  Product.channel_categories[] (Per-Channel Overrides)            │
│  Different category per sales channel                            │
│  Fields: channel_code, category: { same structure as above }    │
└──────────────────────────────────────────────────────────────────┘
                              │
                     Solr adapter maps
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Solr Document                                                   │
│  category_id, category_path (merged), channels[],                │
│  category_slug_path_{lang} (merged),                             │
│  category_breadcrumb_{lang} (merged), category_level             │
└──────────────────────────────────────────────────────────────────┘
```

### Why embedded?

Products carry a **self-contained copy** of their category data (including ancestor hierarchy). This means:
- Solr indexing needs zero database lookups for category paths
- Search responses include breadcrumbs without joins
- Each product knows its full category tree

### Channel-aware categories

Root categories have a `channel_code` (e.g., `"b2c"`). Children inherit the channel from their root via `resolveChannelCode()`. A product can have:
- A **primary category** (`product.category`) — the default
- **Channel-specific overrides** (`product.channel_categories[]`) — different categories per channel

When a search request includes `channel: "b2c"`, the enrichment pipeline resolves the B2C-specific category from `channel_categories` instead of the default. Solr indexes **merged** paths from all categories so products appear in facets for all their channels.

---

## Data Model

### Category Document (MongoDB)

Collection: `categories`

```typescript
interface ICategory {
  category_id: string;       // Unique ID (nanoid, 12 chars)
  name: string;              // Plain string (e.g., "Bicchieri")
  slug: string;              // URL-safe, unique (e.g., "bicchieri")
  description?: string;
  parent_id?: string;        // null for root categories
  level: number;             // 0 = root, 1 = child, 2 = leaf, ...
  path: string[];            // Ancestor IDs from root to parent
  channel_code?: string;     // Sales channel (root only, e.g., "b2c")
  hero_image?: { url, alt_text, cdn_key };
  mobile_hero_image?: { url, alt_text, cdn_key };
  seo: { title?, description?, keywords? };
  display_order: number;
  is_active: boolean;
  product_count: number;     // Cached count
  created_at: Date;
  updated_at: Date;
}
```

**Indexes:** `category_id` (unique), `slug` (unique), `parent_id + display_order`, `level`

### Embedded Category on Products

When a product is assigned to a category, the product stores a **multilingual, self-contained** copy:

```typescript
// Product.category subdocument (primary)
{
  category_id: "TkOehdTBEl1H",
  name: { it: "Bicchieri" },           // Multilingual
  slug: { it: "bicchieri" },           // Multilingual
  parent_id: "QvFMnj0c0Mrk",
  level: 3,
  path: ["wJPzwYmHxboD", "PiwHd1i5tJPr", "QvFMnj0c0Mrk"],
  hierarchy: [                          // Full ancestor chain
    {
      category_id: "wJPzwYmHxboD",
      name: { it: "prodotti" },
      slug: { it: "prodotti" },
      level: 0
    },
    {
      category_id: "PiwHd1i5tJPr",
      name: { it: "Tavola e Servizio" },
      slug: { it: "tavola-e-servizio" },
      level: 1
    },
    {
      category_id: "QvFMnj0c0Mrk",
      name: { it: "Bicchieri e Bevande" },
      slug: { it: "bicchieri-e-bevande" },
      level: 2
    }
  ],
  channel_code: "b2c",                 // Resolved from root
  is_active: true
}
```

### Per-Channel Category Overrides

A product can have different category assignments per sales channel:

```typescript
// Product.channel_categories[] — overrides per channel
[
  {
    channel_code: "b2c",
    category: {
      category_id: "TkOehdTBEl1H",
      name: { it: "Bicchieri" },
      slug: { it: "bicchieri" },
      // ... same structure as primary category with hierarchy
    }
  },
  {
    channel_code: "b2b",
    category: {
      category_id: "XYZ123",
      name: { it: "Bicchieri HoReCa" },
      slug: { it: "bicchieri-horeca" },
      // ... different hierarchy for B2B
    }
  }
]
```

When the search API receives `channel: "b2c"`, the enrichment pipeline returns the B2C category instead of the primary one.

**Important:** The Category model stores `name`/`slug` as plain strings, but the embedded copy on products wraps them in multilingual objects (`{ it: "..." }`). The assign endpoint handles this conversion automatically.

---

## Hierarchy Example

```
prodotti (root, level 0, channel_code: "b2c")
├── Tavola e Servizio (level 1)
│   ├── Bicchieri e Bevande (level 2)
│   │   ├── Bicchieri (level 3) — 19 products
│   │   ├── Cannucce (level 3) — 12 products
│   │   └── Coperchi per Bicchieri (level 3) — 12 products
│   ├── Piatti (level 2)
│   │   ├── Piatti (level 3) — 15 products
│   │   └── Vassoi (level 3) — 8 products
│   └── Posate (level 2)
│       └── Posate (level 3) — 30 products
├── Contenitori e Asporto (level 1)
│   ├── Contenitori e Coperchi (level 2)
│   │   ├── Contenitori (level 3) — 31 products
│   │   └── Coperchi (level 3) — 8 products
│   └── ...
├── Vassoi e Presentazione (level 1)
├── Abbigliamento Professionale (level 1)
├── Igiene e Protezione (level 1)
└── Imballaggi e Accessori (level 1)
```

All categories under "prodotti" inherit `channel_code: "b2c"` from the root. The `channel_code` is only stored on root categories — children resolve it by walking `path[0]`.

---

## API Endpoints

Base: `/api/b2b/pim/categories`

Auth: Session or API key (`x-auth-method: api-key`)

### List Categories

```
GET /api/b2b/pim/categories
```

| Param | Type | Description |
| ----- | ---- | ----------- |
| `parent_id` | string | Filter by parent. Use `null` for root categories only |
| `include_inactive` | boolean | Include soft-deleted categories |
| `channel` | string | Filter by channel code. Returns roots with matching `channel_code` and all descendants |

Response includes live `product_count` (aggregated from products, not cached value).

```json
{
  "categories": [
    {
      "category_id": "wJPzwYmHxboD",
      "name": "prodotti",
      "slug": "prodotti",
      "parent_id": null,
      "level": 0,
      "path": [],
      "channel_code": "b2c",
      "product_count": 0,
      "is_active": true,
      "display_order": 0
    }
  ]
}
```

### Create Category

```
POST /api/b2b/pim/categories
```

```json
{
  "name": "Bicchieri",
  "slug": "bicchieri",
  "parent_id": "QvFMnj0c0Mrk",
  "description": "Bicchieri monouso e riutilizzabili",
  "channel_code": "b2c",
  "display_order": 1,
  "seo": {
    "title": "Bicchieri",
    "description": "Gamma completa di bicchieri",
    "keywords": ["bicchieri", "bevande"]
  }
}
```

The `level` and `path` are calculated automatically from the parent. The `channel_code` is only accepted for root categories (no `parent_id`).

### Get Single Category

```
GET /api/b2b/pim/categories/{category_id}
```

Returns category with `product_count` and `child_count`.

### Update Category

```
PATCH /api/b2b/pim/categories/{category_id}
```

Supports partial updates. If `parent_id` changes, `level` and `path` are recalculated. Validates against circular references (cannot set a descendant as parent).

### Delete Category

```
DELETE /api/b2b/pim/categories/{category_id}
```

Soft-deletes (sets `is_active: false`). Blocked if the category has products or child categories.

### Reorder Categories

```
PUT /api/b2b/pim/categories/reorder
```

### Associate Products

```
POST /api/b2b/pim/categories/{category_id}/products
```

```json
{
  "entity_codes": ["119791", "119792", "119793"],
  "action": "add"
}
```

| Action | Behavior |
|--------|----------|
| `add` | Sets `product.category` with full hierarchy data |
| `remove` | Unsets `product.category` entirely |

When adding, the endpoint:
1. Fetches the category and its ancestors
2. Builds the full embedded category object with multilingual names/slugs and hierarchy
3. Updates all matching products via `updateMany`
4. Recalculates `product_count` on the category

### Get Category Products

```
GET /api/b2b/pim/categories/{category_id}/products?page=1&limit=50&search=bicchiere
```

Returns paginated products assigned to the category.

### Import Product Associations (File Upload)

```
POST /api/b2b/pim/categories/{category_id}/import?action=add
Content-Type: multipart/form-data
```

Upload a CSV, TXT, or XLSX file with entity codes. Creates a background job for batch processing.

**TXT format:** one entity_code per line
**CSV format:** first column is entity_code (header row `entity_code` is skipped)

### Export Category Products

```
GET /api/b2b/pim/categories/{category_id}/export?format=csv
```

Formats: `csv`, `txt`, `xlsx`

---

## Solr Integration

### Schema Setup

Category fields are defined in `src/services/solr-schema.service.ts` and provisioned automatically when a language is enabled via `addLanguageFieldsToSolr()` or `syncSolrSchemaWithLanguages()`.

**Base fields** (language-independent, in `BASE_FIELDS`):

| Field | Solr Type | Purpose |
|-------|-----------|---------|
| `category_id` | `string` | Direct filter by category ID |
| `category_path` | `strings` | Hierarchical ID-based paths for faceting |
| `category_ancestors` | `strings` | All ancestor IDs for filtering |
| `category_level` | `pint` | Category depth (0 = root) |
| `category_json` | `string` (stored only) | Full category JSON for response enrichment |

**Multilingual fields** (per language, in `MULTILINGUAL_FIELDS`):

| Field Pattern | Solr Type | Example Field | Purpose |
|---------------|-----------|---------------|---------|
| `category_name_text_{lang}` | `text_{lang}` | `category_name_text_it` | Full-text search on category name |
| `category_slug_text_{lang}` | `text_{lang}` | `category_slug_text_it` | Leaf slug text search |
| `category_slug_path_{lang}` | `strings` | `category_slug_path_it` | Slug-based hierarchical navigation and faceting |
| `category_breadcrumb_{lang}` | `strings` | `category_breadcrumb_it` | Display name breadcrumbs |

**Important:** `category_slug_path` and `category_breadcrumb` use `type: "strings"` (exact match), not `text_{lang}` (tokenized). This is critical — tokenized text fields break faceting because they split on hyphens and slashes. The schema service handles this via the `type` property in `MULTILINGUAL_FIELDS`:

```typescript
// In MULTILINGUAL_FIELDS — type: "strings" overrides the default text analyzer
{ name: "category_slug_path", multiValued: true, type: "strings" },
{ name: "category_breadcrumb", multiValued: true, type: "strings" },
```

Fields with a custom `type` get the suffix `_{lang_code}` (e.g., `_it`), while text fields get `_{solrAnalyzer}` (e.g., `_text_it`).

### How Hierarchy Paths Work

For a product in **Bicchieri** (level 2, under Bicchieri e Bevande, under Tavola e Servizio):

```
category_path (ID-based):
  - "PiwHd1i5tJPr"                                          (root)
  - "PiwHd1i5tJPr/QvFMnj0c0Mrk"                             (root/child)
  - "PiwHd1i5tJPr/QvFMnj0c0Mrk/TkOehdTBEl1H"                (root/child/leaf)

category_slug_path_it (slug-based):
  - "tavola-e-servizio"                                       (root)
  - "tavola-e-servizio/bicchieri-e-bevande"                   (root/child)
  - "tavola-e-servizio/bicchieri-e-bevande/bicchieri"         (root/child/leaf)

category_breadcrumb_it (display names):
  - "Tavola e Servizio"
  - "Bicchieri e Bevande"
  - "Bicchieri"
```

Each product stores **all levels** of its path. This means filtering by the root slug returns products from all descendant categories.

### Adapter Pipeline

The Solr adapter (`src/lib/adapters/solr-adapter.ts`) builds these fields from the embedded category:

1. `buildCategoryPaths(category)` — builds `category_path`, `category_ancestors`, `category_level` from `hierarchy[]` or `path[]`
2. `buildSlugCategoryPath(category, lang)` — builds hierarchical slug paths from hierarchy slugs
3. `buildNamedCategoryPath(category, lang)` — builds display-name breadcrumbs from hierarchy names

### Channel-Aware Indexing

When a product has `channel_categories`, the Solr adapter:

1. **Merges category paths** — `category_path`, `category_ancestors`, `category_slug_path_{lang}`, and `category_breadcrumb_{lang}` include paths from both the primary category and all channel-specific categories
2. **Derives channels** — `channels[]` field is the union of explicit `product.channels`, the primary category's resolved `channel_code`, and all `channel_categories[].channel_code`

This means a single Solr document is discoverable across all its channels. The `fq: channels:b2c` filter scopes results to B2C products, and facets naturally show only B2C-relevant category paths.

### Channel-Aware Enrichment

When the search API receives `channel: "b2c"`:

1. **Query builder** adds `fq: channels:b2c` — only B2C products returned
2. **Response enricher** checks `channel_categories` for a matching entry and returns that category instead of the primary one
3. The storefront receives the correct B2C category hierarchy (breadcrumbs, slugs, names)

---

## Slug-Based Navigation (Breadcrumbs)

### Filtering by Slug Path

Use `category_slug_path` in `filters` to navigate the hierarchy. Add `channel` to scope results to a specific sales channel:

```json
POST /api/search/search
{
  "query": "*",
  "lang": "it",
  "channel": "b2c",
  "filters": {
    "category_slug_path": "prodotti/tavola-e-servizio"
  }
}
```

| Level | Filter Value | Result |
|-------|-------------|--------|
| Root | `"tavola-e-servizio"` | 96 products (all descendants) |
| Child | `"tavola-e-servizio/bicchieri-e-bevande"` | 43 products |
| Leaf | `"tavola-e-servizio/bicchieri-e-bevande/cannucce"` | 12 products |

### Faceting by Slug Path

Use `category_slug_path` in `facet_fields` to get category counts for building navigation menus:

```json
POST /api/search/search
{
  "query": "*",
  "lang": "it",
  "facet_fields": ["category_slug_path"]
}
```

Response:

```json
{
  "facet_results": {
    "category_slug_path": [
      { "value": "tavola-e-servizio", "count": 96 },
      { "value": "contenitori-e-asporto", "count": 82 },
      { "value": "vassoi-e-presentazione", "count": 56 },
      { "value": "tavola-e-servizio/bicchieri-e-bevande", "count": 43 },
      { "value": "tavola-e-servizio/piatti-categoria", "count": 36 },
      { "value": "tavola-e-servizio/piatti-categoria/piatti", "count": 33 }
    ]
  }
}
```

The storefront can parse the `/`-separated values to build a drill-down tree. Root categories have no `/`, children have one `/`, leaves have two.

### Combined: Filter + Facet for Drill-Down

Filter to a root category and facet to show its children:

```json
{
  "query": "*",
  "lang": "it",
  "filters": { "category_slug_path": "tavola-e-servizio" },
  "facet_fields": ["category_slug_path"]
}
```

The facet results will include only paths under "tavola-e-servizio", allowing the UI to show child/leaf options within that category.

### Building Breadcrumbs in the Storefront

Each product in the search response includes:

```json
{
  "category": {
    "category_id": "TkOehdTBEl1H",
    "name": "Bicchieri",
    "slug": "bicchieri",
    "breadcrumb": [
      "Tavola e Servizio",
      "Bicchieri e Bevande",
      "Bicchieri"
    ],
    "slug_path": [
      "tavola-e-servizio",
      "tavola-e-servizio/bicchieri-e-bevande",
      "tavola-e-servizio/bicchieri-e-bevande/bicchieri"
    ],
    "hierarchy": [
      { "category_id": "PiwHd1i5tJPr", "name": "Tavola e Servizio", "slug": "tavola-e-servizio", "level": 0 },
      { "category_id": "QvFMnj0c0Mrk", "name": "Bicchieri e Bevande", "slug": "bicchieri-e-bevande", "level": 1 }
    ],
    "level": 2,
    "parent_id": "QvFMnj0c0Mrk"
  }
}
```

To render clickable breadcrumbs, zip `breadcrumb` and `slug_path`:

```tsx
// Storefront breadcrumb component
const crumbs = category.breadcrumb.map((label, i) => ({
  label,                           // "Tavola e Servizio"
  href: `/categories/${category.slug_path[i]}`  // "/categories/tavola-e-servizio"
}));

// Renders: Tavola e Servizio > Bicchieri e Bevande > Bicchieri
//          (each segment is a clickable link)
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/db/models/category.ts` | Category schema and indexes (includes `channel_code`) |
| `src/lib/db/models/pim-product.ts` | Product schema with embedded category and `channel_categories[]` |
| `src/lib/services/category.service.ts` | `resolveChannelCode()`, `buildCategoryFromMap()`, `rebuildProductEmbeddings()` |
| `src/app/api/b2b/pim/categories/route.ts` | List and create categories |
| `src/app/api/b2b/pim/categories/[id]/route.ts` | Get, update, delete single category |
| `src/app/api/b2b/pim/categories/[id]/products/route.ts` | Associate/disassociate products |
| `src/app/api/b2b/pim/categories/[id]/import/route.ts` | Bulk import via file upload |
| `src/app/api/b2b/pim/categories/[id]/export/route.ts` | Export category products |
| `src/services/solr-schema.service.ts` | Solr schema definitions (field types, base fields, multilingual fields) |
| `src/lib/adapters/solr-adapter.ts` | Builds Solr fields from embedded category (paths, slugs, breadcrumbs) |
| `src/lib/search/query-builder.ts` | Handles `category_slug_path` filter and facet resolution |
| `src/lib/search/response-transformer.ts` | Parses category from Solr response, includes `slug_path` and `breadcrumb` |
| `src/lib/search/facet-config.ts` | Category facet and filter field mappings |

---

## Important Notes

1. **Products have a primary category + optional per-channel overrides.** The `category` field is a single subdocument (default for all channels). The `channel_categories[]` array allows different category assignments per sales channel.

2. **Re-sync after assignment.** After assigning products to categories, run a Solr batch sync (`rebuild_embeddings: true`) so the new `category_slug_path`, `category_breadcrumb`, and `channels` fields are indexed.

3. **Slug uniqueness.** Category slugs are unique per tenant (unique index on `slug`). This guarantees that slug paths are unambiguous for navigation.

4. **Name vs Slug duality.** The Category model stores `name` and `slug` as plain strings. The embedded copy on products converts them to multilingual `{ it: "..." }` format for Solr compatibility.

5. **Product count.** The cached `product_count` on the category document may drift. The list endpoint (`GET /categories`) always returns live counts via aggregation. The assign endpoint updates the cached count after each operation.

6. **Solr field types matter.** `category_slug_path` and `category_breadcrumb` must be `strings` type (exact match, non-tokenized) in Solr, not `text_general`. Tokenized text fields split on hyphens/slashes, breaking faceting and exact filtering. The schema service handles this automatically via `type: "strings"` in `MULTILINGUAL_FIELDS`. If a field was auto-created by Solr's schemaless mode with the wrong type, the schema sync will fix it via `replace-field`.

7. **Schema sync on existing tenants.** When adding new Solr fields, run the schema sync (`syncSolrSchemaWithLanguages`) before batch sync. The sync uses `replace-field` for existing fields, correcting wrong types from schemaless auto-creation. If replacing a field type, you may need to: clear the index (`delete *:*`), reload the collection (`RELOAD`), then re-sync products.
