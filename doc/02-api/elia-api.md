# ELIA AI Search API

> Frontend Integration Guide

**Base URL:** `http://localhost:3001` (dev) | `https://pim.yourdomain.com` (prod)

---

## Quick Start (3-Step Flow)

The ELIA search uses a 3-step architecture:

```bash
# Step 1: Extract intent from query
INTENT=$(curl -s -X POST http://localhost:3001/api/elia/intent \
  -H "Content-Type: application/json" \
  -d '{"query": "caldaia economica per 200 mq", "language": "it"}' | jq '.data.intent')

# Step 2: Cascade search with intent (text-only, no filters)
curl -X POST http://localhost:3001/api/elia/search \
  -H "Content-Type: application/json" \
  -d "{\"intent\": $INTENT, \"language\": \"it\", \"limit\": 20}"

# Step 3: Analyze products (after B2B fetches ERP prices)
# See Step 3 section below
```

---

## Intent Structure (5-Array Schema)

The intent uses a **5-array structure** with precision scores for flexible cascade search:

```typescript
interface EliaIntentExtraction {
  intent_type: 'ricerca' | 'confronto' | 'consiglio' | 'specifico';

  // PRODUCT SYNONYMS (2 levels)
  product_exact: SynonymTerm[];      // Exact product terms (precision: 1.0)
  product_synonyms: SynonymTerm[];   // 2 synonyms (precision: 0.9-0.8)

  // ATTRIBUTE SYNONYMS (3 levels)
  attribute_exact: SynonymTerm[];    // Exact attributes (precision: 1.0)
  attribute_synonyms: SynonymTerm[]; // 3+ synonyms (precision: 0.9-0.7)
  attribute_related: SynonymTerm[];  // 3+ related terms (precision: 0.6-0.4)

  // FILTERS & MODIFIERS
  sort_by: SortPreference;
  stock_filter: StockFilter;
  price_min?: number;
  price_max?: number;
  constraints?: { min?: number; max?: number; unit?: string };

  // RESPONSE
  user_message: string;
  confidence: number;
}

interface SynonymTerm {
  term: string;
  precision: number;  // 0-1 (1 = exact match)
}
```

---

## Step 1: Intent Extraction

### `POST /api/elia/intent`

Extract intent from user query using Claude AI.

#### Request

```typescript
interface EliaIntentRequest {
  query: string;      // User search query (3-300 characters)
  language?: string;  // "it" (default) or "en"
}
```

#### Example

```bash
curl -X POST http://localhost:3001/api/elia/intent \
  -H "Content-Type: application/json" \
  -d '{"query": "caldaia economica per 200 mq", "language": "it"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "caldaia economica per 200 mq",
    "language": "it",
    "intent": {
      "intent_type": "ricerca",
      "product_exact": [
        { "term": "caldaia", "precision": 1 }
      ],
      "product_synonyms": [
        { "term": "scaldabagno", "precision": 0.9 },
        { "term": "impianto di riscaldamento", "precision": 0.8 }
      ],
      "attribute_exact": [
        { "term": "economica", "precision": 1 }
      ],
      "attribute_synonyms": [
        { "term": "a basso costo", "precision": 0.9 },
        { "term": "risparmio energetico", "precision": 0.8 },
        { "term": "conveniente", "precision": 0.7 }
      ],
      "attribute_related": [
        { "term": "efficiente", "precision": 0.6 },
        { "term": "consumi ridotti", "precision": 0.5 },
        { "term": "ecologica", "precision": 0.4 }
      ],
      "constraints": { "min": 200, "max": 200, "unit": "mq" },
      "sort_by": "price_asc",
      "stock_filter": "any",
      "user_message": "Cerco una caldaia economica per 200 mq!",
      "confidence": 0.92
    },
    "timestamp": "2025-12-03T05:00:00.000Z"
  }
}
```

---

## Step 2: Cascade Search

### `POST /api/elia/search`

Performs **24-level cascade search** using text-only queries. No filters applied - just text matching through Solr.

> **Important:** Cascade search is text-only. Filters (stock, price, sort) are applied by Claude in Step 3.

#### Request

```typescript
interface EliaSearchRequest {
  intent: EliaIntentExtraction;  // Full intent from Step 1
  language?: string;             // "it" (default) or "en"
  limit?: number;                // Max results (default: 20)
}
```

#### Response

```typescript
interface EliaSearchResponse {
  success: boolean;
  data: {
    search_id: string;
    intent: EliaIntentExtraction;   // Pass to Step 3
    search_info: {
      matched_level: number;        // 0-23
      matched_level_name: string;   // e.g., "exact + attr_exact + constraint"
      matched_search_text: string;  // Actual Solr query text
    };
    products: Product[];            // Search results
    total_found: number;            // Total count
    matched_products: string[];     // Product terms used
    matched_attributes: string[];   // Attribute terms used
    performance: {
      total_ms: number;
    };
  };
}
```

#### Example

```bash
curl -X POST http://localhost:3001/api/elia/search \
  -H "Content-Type: application/json" \
  -d '{
    "intent": {
      "intent_type": "ricerca",
      "product_exact": [{"term": "caldaia", "precision": 1}],
      "product_synonyms": [
        {"term": "scaldabagno", "precision": 0.9},
        {"term": "impianto di riscaldamento", "precision": 0.8}
      ],
      "attribute_exact": [{"term": "economica", "precision": 1}],
      "attribute_synonyms": [
        {"term": "a basso costo", "precision": 0.9},
        {"term": "risparmio energetico", "precision": 0.8},
        {"term": "conveniente", "precision": 0.7}
      ],
      "attribute_related": [
        {"term": "efficiente", "precision": 0.6},
        {"term": "consumi ridotti", "precision": 0.5},
        {"term": "ecologica", "precision": 0.4}
      ],
      "constraints": {"min": 200, "unit": "mq"},
      "sort_by": "price_asc",
      "stock_filter": "in_stock",
      "user_message": "Cerco caldaia economica per 200 mq",
      "confidence": 0.92
    },
    "language": "it",
    "limit": 20
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "search_id": "elia_1764739587044_3v2lsmh",
    "intent": { "...full intent..." },
    "search_info": {
      "matched_level": 19,
      "matched_level_name": "exact only",
      "matched_search_text": "caldaia"
    },
    "products": ["...26 products..."],
    "total_found": 26,
    "matched_products": ["caldaia"],
    "matched_attributes": [],
    "performance": { "total_ms": 1250 }
  }
}
```

---

## 24-Level Cascade Strategy

The cascade searches through 24 combinations of product and attribute terms:

### Phase 1-3: Product × Attribute Combinations (Levels 0-17)

```
Level 0:  product_exact + attribute_exact + constraints
Level 1:  product_exact + attribute_exact
Level 2:  product_exact + attribute_synonyms + constraints
Level 3:  product_exact + attribute_synonyms
Level 4:  product_exact + attribute_related + constraints
Level 5:  product_exact + attribute_related
Level 6:  product_synonyms[0] + attribute_exact + constraints
Level 7:  product_synonyms[0] + attribute_exact
Level 8:  product_synonyms[0] + attribute_synonyms + constraints
Level 9:  product_synonyms[0] + attribute_synonyms
Level 10: product_synonyms[0] + attribute_related + constraints
Level 11: product_synonyms[0] + attribute_related
Level 12: product_synonyms[1] + attribute_exact + constraints
Level 13: product_synonyms[1] + attribute_exact
Level 14: product_synonyms[1] + attribute_synonyms + constraints
Level 15: product_synonyms[1] + attribute_synonyms
Level 16: product_synonyms[1] + attribute_related + constraints
Level 17: product_synonyms[1] + attribute_related
```

### Phase 4: Product-Only Fallback (Levels 18-23) - LAST RESORT

```
Level 18: product_exact + constraints
Level 19: product_exact only
Level 20: product_synonyms[0] + constraints
Level 21: product_synonyms[0] only
Level 22: product_synonyms[1] + constraints
Level 23: product_synonyms[1] only
```

### Stop Condition

Cascade **stops** when `total_found >= minResults` (default: 10).

### Example Cascade

Query: `"caldaia economica per 200 mq"`

```
Level 0: "caldaia economica 200 mq"     → 0 results
Level 1: "caldaia economica"            → 0 results
Level 2: "caldaia a basso costo..."     → 0 results
...
Level 19: "caldaia"                     → 26 results ✓ STOP
```

---

## Step 3: Product Analysis

### `POST /api/elia/analyze`

Uses **Claude Haiku** to analyze, filter, and reorder products based on intent.

#### Flow

```
1. B2B calls /api/elia/search → gets products + intent
2. B2B calls ERP → gets price/stock per entity_code
3. B2B calls /api/elia/analyze with products + ERP data + intent
4. PIM fetches product details from Solr (name, brand, attributes)
5. Claude analyzes and reorders with intent context
```

#### Request

```typescript
interface AnalyzeRequest {
  products: ProductErpData[];        // entity_code + ERP data
  intent: EliaIntentExtraction;      // Full intent from Step 1
  language?: string;                 // "it" (default) or "en"
  total_found?: number;              // From Step 2
}

interface ProductErpData {
  entity_code: string;
  price?: number;
  availability?: number;
  add_to_cart?: boolean;
}
```

#### Response

```typescript
interface AnalyzeResponse {
  success: boolean;
  data: {
    products: AnalyzedProduct[];     // Sorted by attribute_match_score
    total_count: number;
    analyzed_count: number;          // Max 10
    received_count: number;
    total_found: number;
    summary: string;                 // AI-generated summary
  };
}

interface AnalyzedProduct {
  entity_code: string;
  attribute_match_score: number;     // 0-1
  match_reasons: string[];
  ranking_reason?: string;
}
```

#### Example

```bash
curl -X POST http://localhost:3001/api/elia/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "products": [
      { "entity_code": "F20071", "price": 1299, "availability": 5 },
      { "entity_code": "F20561", "price": 899, "availability": 10 }
    ],
    "intent": {
      "intent_type": "ricerca",
      "product_exact": [{"term": "caldaia", "precision": 1}],
      "product_synonyms": [
        {"term": "scaldabagno", "precision": 0.9},
        {"term": "impianto di riscaldamento", "precision": 0.8}
      ],
      "attribute_exact": [{"term": "economica", "precision": 1}],
      "attribute_synonyms": [
        {"term": "a basso costo", "precision": 0.9},
        {"term": "risparmio energetico", "precision": 0.8},
        {"term": "conveniente", "precision": 0.7}
      ],
      "attribute_related": [
        {"term": "efficiente", "precision": 0.6},
        {"term": "consumi ridotti", "precision": 0.5},
        {"term": "ecologica", "precision": 0.4}
      ],
      "sort_by": "price_asc",
      "stock_filter": "in_stock",
      "user_message": "Cerco caldaia economica",
      "confidence": 0.92
    },
    "total_found": 26,
    "language": "it"
  }'
```

---

## Sort & Filter Options

### Sort Preferences

| sort_by | Description |
|---------|-------------|
| `relevance` | Default - by search relevance |
| `price_asc` | Cheapest first |
| `price_desc` | Most expensive first |
| `quality` | By priority score |
| `newest` | Most recent first |
| `popularity` | By popularity score |

### Stock Filters

| stock_filter | Description |
|--------------|-------------|
| `any` | No filter (default) |
| `in_stock` | `availability > 0` OR `add_to_cart = true` |
| `available_soon` | `availability = 0` AND `add_to_cart = true` |

### Constraints

```typescript
constraints: {
  min?: number;   // Minimum value (e.g., 200 for "200 mq")
  max?: number;   // Maximum value
  unit?: string;  // Unit of measure (mq, mm, litri, etc.)
}
```

---

## Intent Types

| Type | Description | Example |
|------|-------------|---------|
| `ricerca` | Generic search | "cerco una caldaia" |
| `confronto` | Comparison | "meglio caldaia A o B?" |
| `consiglio` | Recommendation | "cosa mi consigli per..." |
| `specifico` | Specific product | "caldaia Vaillant EcoTEC Plus" |

---

## Model Selection Strategy

| Query Type | Model | Reason |
|------------|-------|--------|
| Simple (< 150 chars, low complexity) | Haiku | Faster, cheaper |
| Complex (comparison, recommendation) | Sonnet | More reliable |
| Haiku failure | Sonnet | Automatic fallback |

---

## Error Handling

### Error Response

```typescript
interface EliaErrorResponse {
  success: false;
  error: string;
  code: 'VALIDATION_ERROR' | 'INTENT_EXTRACTION_FAILED' | 'SEARCH_FAILED' | 'INTERNAL_ERROR';
  details?: string;
}
```

### Common Errors

| Code | HTTP Status | Cause |
|------|-------------|-------|
| `VALIDATION_ERROR` | 400 | Invalid intent or query |
| `INTENT_EXTRACTION_FAILED` | 500 | Claude API failed |
| `SEARCH_FAILED` | 500 | Solr search failed |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Configuration Endpoints

### `GET /api/elia/intent`

Returns intent extraction configuration and model info.

### `GET /api/elia/search`

Returns search configuration.

### `GET /api/elia/analyze`

Returns analyze endpoint usage info.

---

## 3-Step Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              B2B FRONTEND                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ User search: "caldaia economica per 200 mq"
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: Intent Extraction (Claude Haiku/Sonnet)                             │
│  POST /api/elia/intent                                                       │
│  ─────────────────────────────────────────────────────────────────────────── │
│  IN:  { query: "caldaia economica per 200 mq" }                              │
│  OUT: { intent: { product_exact, product_synonyms,                           │
│                   attribute_exact, attribute_synonyms, attribute_related,    │
│                   constraints, sort_by, stock_filter, ... } }                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Pass full intent
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: 24-Level Cascade Search (Solr) - TEXT ONLY                          │
│  POST /api/elia/search                                                       │
│  ─────────────────────────────────────────────────────────────────────────── │
│  IN:  { intent: {...}, limit: 20 }                                           │
│  OUT: { products: [...], search_info: { matched_level, matched_search_text } │
│  ─────────────────────────────────────────────────────────────────────────── │
│  Cascade: Levels 0-17 (product × attributes) → Levels 18-23 (product only)  │
│  NO filters applied - just text search                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ products + intent
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  B2B: Fetch ERP Data                                                         │
│  POST /erp/get_multiple_prices                                               │
│  ─────────────────────────────────────────────────────────────────────────── │
│  → Fetch price/stock for each entity_code                                    │
│  → Returns: { entity_code, price, availability, add_to_cart }               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ products + ERP data + intent
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: Product Analysis (Claude Haiku)                                     │
│  POST /api/elia/analyze                                                      │
│  ─────────────────────────────────────────────────────────────────────────── │
│  IN: { products: [entity_code + price + stock], intent: {...} }             │
│  ─────────────────────────────────────────────────────────────────────────── │
│  Claude applies: sort_by, stock_filter, attribute matching                   │
│  Claude generates: attribute_match_score, match_reasons, summary             │
│  ─────────────────────────────────────────────────────────────────────────── │
│  OUT: { products: [...reordered], summary: "Ho trovato 2 caldaie..." }      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Display Results to User                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Status

- [x] Step 1: Intent extraction with 5-array structure (Haiku/Sonnet)
- [x] Step 2: 24-level cascade search (text-only, no filters)
- [x] Step 3: Product analysis with Claude Haiku (filtering/sorting)
- [x] Precision scores for synonym terms
- [x] Constraints support (min, max, unit)
- [x] Full `/api/elia/intent` endpoint
- [x] Full `/api/elia/search` endpoint
- [x] Full `/api/elia/analyze` endpoint

---

**Last Updated:** 2025-12-03 (v3.0 - 5-array structure, 24-level cascade, text-only search)
