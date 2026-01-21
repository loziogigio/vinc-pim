# Technical Specifications - Search & Facet API

This guide explains how to filter and facet products by their technical specifications using the Solr search API.

## Overview

Technical specifications are indexed as dynamic fields in Solr with the naming pattern:

```
spec_{key}_{suffix}
```

Where:
- `{key}` is the specification key (e.g., `col`, `mat`, `tip`)
- `{suffix}` indicates the data type:
  - `_s` = string (single value)
  - `_f` = float/number
  - `_b` = boolean
  - `_ss` = string array (multi-value)
  - `_fs` = float array (multi-value)

## Common Specification Fields

| Field | Label (IT) | Example Values |
|-------|------------|----------------|
| `spec_col_s` | Colore | Bianco, Nero, Grigio, Cromato |
| `spec_mat_s` | Materiale/Rivestimento | Ottone, Acciaio, Pvc, Ghisa |
| `spec_tip_s` | Tipologia | Curva, Valvola, Elettropompa |
| `spec_ali_s` | Alimentazione | Elettrica, Manuale |
| `spec_ver_s` | Versione | Sommersa, Standard |
| `spec_pes_s` | Peso | 1.0, 2.5, 10.0 |
| `spec_dia_s` | Diametro | 40.0, 50.0, 100.0 |

---

## API Endpoints

### 1. Search with Spec Filters

**Endpoint:** `POST /api/b2b/search`

**Headers:**
```
Content-Type: application/json
x-auth-method: api-key
x-api-key-id: ak_{tenant}_{key}
x-api-secret: sk_{secret}
```

**Request Body:**
```json
{
  "query": "*",
  "filters": {
    "spec_col_s": "Grigio",
    "spec_mat_s": "Ottone"
  },
  "facets": ["spec_col_s", "spec_mat_s", "spec_tip_s"],
  "limit": 20,
  "page": 1,
  "lang": "it"
}
```

**Response:**
```json
{
  "total": 150,
  "products": [
    {
      "entity_code": "001234",
      "sku": "ABC123",
      "name_text_it": "Prodotto Example",
      "spec_col_s": "Grigio",
      "spec_mat_s": "Ottone"
    }
  ],
  "facets": {
    "spec_col_s": {
      "buckets": [
        { "val": "Grigio", "count": 150 },
        { "val": "Bianco", "count": 80 }
      ]
    },
    "spec_mat_s": {
      "buckets": [
        { "val": "Ottone", "count": 150 },
        { "val": "Acciaio", "count": 45 }
      ]
    }
  },
  "page": 1,
  "limit": 20,
  "pages": 8
}
```

### 2. Get Available Specs

**Endpoint:** `GET /api/b2b/search/available-specs`

Discovers available specification fields from indexed products.

**Query Parameters:**

- `product_type_id` (optional) - Filter to specs from a specific product type (system ID)
- `product_type_code` (optional) - Filter to specs from a specific product type (customer's ERP code)
- `limit` (optional) - Number of sample products to check (default: 100)

**Example with ERP code:**
```bash
GET /api/b2b/search/available-specs?product_type_code=001
```

**Response:**
```json
{
  "specs": [
    {
      "key": "col",
      "field": "spec_col_s",
      "type": "string",
      "label": "Colore",
      "sample_values": ["Bianco", "Nero", "Grigio"]
    },
    {
      "key": "mat",
      "field": "spec_mat_s",
      "type": "string",
      "label": "Materiale/Rivestimento",
      "sample_values": ["Ottone", "Acciaio", "Pvc"]
    }
  ],
  "total_products_checked": 100,
  "product_type_id": null
}
```

---

## Use Case Examples

### Example 1: Filter by Product Type, Then Show Related Specs

**Step 1:** Filter products by product type and get spec facets

```bash
curl -X POST "http://localhost:3001/api/b2b/search" \
  -H "Content-Type: application/json" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant}_{key}" \
  -H "x-api-secret: sk_{secret}" \
  -d '{
    "query": "*",
    "filters": {
      "product_type_json": "*Pompe*"
    },
    "facets": ["spec_tip_s", "spec_col_s", "spec_mat_s", "spec_ali_s"],
    "limit": 0
  }'
```

**Response:**
```json
{
  "total": 123,
  "products": [],
  "facets": {
    "spec_tip_s": {
      "buckets": [
        { "val": "Elettropompa centrifuga", "count": 39 },
        { "val": "Elettropompa sommergibile", "count": 24 },
        { "val": "Elettropompa sommersa", "count": 24 }
      ]
    },
    "spec_col_s": {
      "buckets": [
        { "val": "Cromato", "count": 41 },
        { "val": "Blu", "count": 26 },
        { "val": "Verde", "count": 15 }
      ]
    },
    "spec_mat_s": {
      "buckets": [
        { "val": "Ghisa", "count": 53 },
        { "val": "Acciaio", "count": 37 },
        { "val": "Acciaio inox", "count": 10 }
      ]
    }
  },
  "page": 1,
  "limit": 0,
  "pages": null
}
```

**Step 2:** User selects "Ghisa" material - filter further

```bash
curl -X POST "http://localhost:3001/api/b2b/search" \
  -H "Content-Type: application/json" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant}_{key}" \
  -H "x-api-secret: sk_{secret}" \
  -d '{
    "query": "*",
    "filters": {
      "product_type_json": "*Pompe*",
      "spec_mat_s": "Ghisa"
    },
    "facets": ["spec_tip_s", "spec_col_s"],
    "limit": 20
  }'
```

**Response:**
```json
{
  "total": 53,
  "products": [
    {
      "entity_code": "001307",
      "sku": "PM40",
      "name_text_it": "Elettropompa periferica in ghisa monofase modello pm",
      "spec_mat_s": "Ghisa",
      "spec_tip_s": "Elettropompa periferica",
      "cover_image_url": "https://example.com/image.jpg"
    }
  ],
  "facets": {
    "spec_tip_s": {
      "buckets": [
        { "val": "Elettropompa centrifuga", "count": 23 },
        { "val": "Elettropompa autoadescante", "count": 8 },
        { "val": "Elettropompa sommergibile", "count": 8 }
      ]
    },
    "spec_col_s": {
      "buckets": [
        { "val": "Verde", "count": 15 },
        { "val": "Blu", "count": 12 },
        { "val": "Azzurro", "count": 8 }
      ]
    }
  },
  "page": 1,
  "limit": 20,
  "pages": 3
}
```

### Example 2: Filter by Color Across All Products

```bash
curl -X POST "http://localhost:3001/api/b2b/search" \
  -H "Content-Type: application/json" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant}_{key}" \
  -H "x-api-secret: sk_{secret}" \
  -d '{
    "query": "*",
    "filters": {
      "spec_col_s": "Grigio"
    },
    "limit": 10
  }'
```

**Response:**
```json
{
  "total": 1822,
  "products": [
    {
      "entity_code": "002337",
      "sku": "ABC123",
      "name_text_it": "Curva 45° PVC",
      "spec_col_s": "Grigio",
      "cover_image_url": "https://example.com/image.jpg"
    }
  ],
  "page": 1,
  "limit": 10,
  "pages": 183
}
```

### Example 3: Multiple Spec Filters (AND logic)

Filter products that are both "Grigio" AND made of "Pvc":

```bash
curl -X POST "http://localhost:3001/api/b2b/search" \
  -H "Content-Type: application/json" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant}_{key}" \
  -H "x-api-secret: sk_{secret}" \
  -d '{
    "query": "*",
    "filters": {
      "spec_col_s": "Grigio",
      "spec_mat_s": "Pvc"
    },
    "facets": ["spec_tip_s"],
    "limit": 10
  }'
```

---

## Direct Solr Queries

For debugging or direct access, you can query Solr directly:

### Filter Query

```bash
curl "http://{SOLR_URL}/solr/{collection}/select" \
  -d 'q=*:*' \
  -d 'fq=spec_col_s:Grigio' \
  -d 'fq=spec_mat_s:Pvc' \
  -d 'rows=10' \
  -d 'fl=entity_code,sku,spec_col_s,spec_mat_s' \
  -d 'wt=json'
```

### Facet Query

```bash
curl "http://{SOLR_URL}/solr/{collection}/select" \
  -d 'q=*:*' \
  -d 'fq=product_type_json:*Pompe*' \
  -d 'rows=0' \
  -d 'facet=true' \
  -d 'facet.field=spec_col_s' \
  -d 'facet.field=spec_mat_s' \
  -d 'facet.field=spec_tip_s' \
  -d 'facet.limit=10' \
  -d 'wt=json'
```

### JSON API (Recommended)

```bash
curl -X POST "http://{SOLR_URL}/solr/{collection}/query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "*:*",
    "filter": ["product_type_json:*Pompe*", "spec_mat_s:Ghisa"],
    "limit": 10,
    "fields": "entity_code,sku,spec_*",
    "facet": {
      "spec_col_s": { "type": "terms", "field": "spec_col_s", "limit": 10 },
      "spec_tip_s": { "type": "terms", "field": "spec_tip_s", "limit": 10 }
    }
  }'
```

---

## Workflow: Building a Filter UI

### 1. Initial Load - Get All Facets

When user lands on a category/product type page:

```javascript
// Fetch initial facets for the product type
const response = await fetch('/api/b2b/search', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-auth-method': 'api-key',
    'x-api-key-id': apiKeyId,
    'x-api-secret': apiSecret
  },
  body: JSON.stringify({
    query: '*',
    filters: { product_type_json: '*Pompe*' },
    facets: ['spec_col_s', 'spec_mat_s', 'spec_tip_s', 'spec_ali_s'],
    limit: 0  // Only get facets, no products
  })
});

const { total, facets } = await response.json();

// Render filter UI with facets
// facets.spec_col_s.buckets -> Color checkboxes
// facets.spec_mat_s.buckets -> Material checkboxes

// Example: Render color filter
facets.spec_col_s.buckets.forEach(bucket => {
  console.log(`${bucket.val}: ${bucket.count} products`);
  // Render checkbox: Cromato (41)
});
```

### 2. User Selects Filter

When user checks "Ghisa" in Material filter:

```javascript
const response = await fetch('/api/b2b/search', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-auth-method': 'api-key',
    'x-api-key-id': apiKeyId,
    'x-api-secret': apiSecret
  },
  body: JSON.stringify({
    query: '*',
    filters: {
      product_type_json: '*Pompe*',
      spec_mat_s: 'Ghisa'  // Add selected filter
    },
    facets: ['spec_col_s', 'spec_mat_s', 'spec_tip_s'],
    limit: 20,
    page: 1
  })
});

const { total, products, facets, page, pages } = await response.json();

// Update UI:
// - Show filtered products
products.forEach(product => {
  console.log(`${product.sku}: ${product.name_text_it}`);
});

// - Update facet counts (other facets now show counts within Ghisa selection)
// - Show pagination: Page 1 of 3
console.log(`Showing ${products.length} of ${total} products (Page ${page} of ${pages})`);
```

### 3. Multiple Selections

User adds "Cromato" color:

```javascript
const response = await fetch('/api/b2b/search', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-auth-method': 'api-key',
    'x-api-key-id': apiKeyId,
    'x-api-secret': apiSecret
  },
  body: JSON.stringify({
    query: '*',
    filters: {
      product_type_json: '*Pompe*',
      spec_mat_s: 'Ghisa',
      spec_col_s: 'Cromato'  // AND filter - both must match
    },
    facets: ['spec_col_s', 'spec_mat_s', 'spec_tip_s'],
    limit: 20,
    page: 1
  })
});

const data = await response.json();
// data.total = number of products matching ALL filters
// data.products = array of matching products
// data.facets = updated counts within the filtered set
```

---

## Notes

### Indexing

Technical specifications are indexed during `pnpm solr:resync`. The indexing logic:

1. Reads `technical_specifications` from MongoDB (multilingual: `{ it: [...], de: [...] }`)
2. For each spec in the primary language, creates a dynamic field `spec_{key}_{suffix}`
3. Suffix is determined by value type (string → `_s`, number → `_f`, boolean → `_b`)

### Re-indexing

If technical specifications change, run:

```bash
VINC_TENANT_ID={tenant} pnpm run solr:resync
```

### Labels

Spec labels are stored in `spec_labels_text_{lang}` for full-text search and in `technical_specifications_json` for retrieval. The `/api/b2b/search/available-specs` endpoint extracts labels from the JSON.

---

## Complete React Example

Here's a complete React component showing how to build a filterable product list:

```tsx
import { useState, useEffect } from 'react';

// Types
interface FacetBucket {
  val: string;
  count: number;
}

interface SearchResponse {
  total: number;
  products: any[];
  facets?: Record<string, { buckets: FacetBucket[] }>;
  page: number;
  limit: number;
  pages: number;
}

// API helper
async function searchProducts(params: {
  query?: string;
  filters?: Record<string, string>;
  facets?: string[];
  limit?: number;
  page?: number;
}): Promise<SearchResponse> {
  const response = await fetch('/api/b2b/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-auth-method': 'api-key',
      'x-api-key-id': process.env.NEXT_PUBLIC_API_KEY_ID!,
      'x-api-secret': process.env.NEXT_PUBLIC_API_SECRET!,
    },
    body: JSON.stringify({
      query: params.query || '*',
      filters: params.filters || {},
      facets: params.facets || [],
      limit: params.limit || 20,
      page: params.page || 1,
    }),
  });
  return response.json();
}

// Component
export function ProductFilter({ productType }: { productType: string }) {
  const [products, setProducts] = useState<any[]>([]);
  const [facets, setFacets] = useState<Record<string, FacetBucket[]>>({});
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);

  // Spec fields to show as filters
  const specFields = ['spec_col_s', 'spec_mat_s', 'spec_tip_s'];

  // Labels for spec fields
  const specLabels: Record<string, string> = {
    spec_col_s: 'Colore',
    spec_mat_s: 'Materiale',
    spec_tip_s: 'Tipologia',
  };

  // Fetch products when filters or page changes
  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);

      const response = await searchProducts({
        filters: {
          product_type_json: `*${productType}*`,
          ...filters,
        },
        facets: specFields,
        limit: 20,
        page,
      });

      setProducts(response.products);
      setTotal(response.total);
      setPages(response.pages);

      // Update facets
      if (response.facets) {
        const newFacets: Record<string, FacetBucket[]> = {};
        for (const field of specFields) {
          if (response.facets[field]) {
            newFacets[field] = response.facets[field].buckets;
          }
        }
        setFacets(newFacets);
      }

      setLoading(false);
    }

    fetchProducts();
  }, [filters, page, productType]);

  // Handle filter selection
  const handleFilterChange = (field: string, value: string | null) => {
    setPage(1); // Reset to first page
    if (value) {
      setFilters(prev => ({ ...prev, [field]: value }));
    } else {
      setFilters(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  return (
    <div className="flex gap-6">
      {/* Filters Sidebar */}
      <div className="w-64 shrink-0">
        <h2 className="font-bold mb-4">Filtri</h2>

        {specFields.map(field => (
          <div key={field} className="mb-4">
            <h3 className="font-medium mb-2">{specLabels[field]}</h3>
            <div className="space-y-1">
              {facets[field]?.map(bucket => (
                <label key={bucket.val} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={field}
                    checked={filters[field] === bucket.val}
                    onChange={() => handleFilterChange(field, bucket.val)}
                  />
                  <span>{bucket.val}</span>
                  <span className="text-gray-500">({bucket.count})</span>
                </label>
              ))}
              {filters[field] && (
                <button
                  onClick={() => handleFilterChange(field, null)}
                  className="text-blue-600 text-sm"
                >
                  Rimuovi filtro
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Products Grid */}
      <div className="flex-1">
        <div className="mb-4">
          <span className="font-medium">{total}</span> prodotti trovati
        </div>

        {loading ? (
          <div>Caricamento...</div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              {products.map(product => (
                <div key={product.entity_code} className="border p-4 rounded">
                  <img
                    src={product.cover_image_url || '/placeholder.png'}
                    alt={product.name_text_it}
                    className="w-full h-32 object-cover mb-2"
                  />
                  <h3 className="font-medium">{product.sku}</h3>
                  <p className="text-sm text-gray-600">{product.name_text_it}</p>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Precedente
                </button>
                <span className="px-3 py-1">
                  Pagina {page} di {pages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                  disabled={page === pages}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Successiva
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

### Usage

```tsx
// In your page component
<ProductFilter productType="Pompe" />
```

This component:
1. Loads products filtered by product type
2. Shows facets (Color, Material, Type) in a sidebar
3. Updates facet counts when filters are selected
4. Supports pagination
5. Resets to page 1 when filters change
