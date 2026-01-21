# Correlations API

API documentation for managing product correlations (related products, accessories, etc.).

## Overview

Product correlations allow you to define relationships between products. In Phase 1, only the **"related"** correlation type is supported (Articoli Correlati).

### Correlation Types

| Type | Description | Status |
|------|-------------|--------|
| `related` | Related products | **Phase 1** |
| `accessory` | Accessories for a product | Future |
| `alternative` | Alternative products | Future |
| `spare_part` | Spare parts | Future |
| `upsell` | Upsell products | Future |
| `cross_sell` | Cross-sell products | Future |

### Data Model

Correlations are stored in a **separate collection** (`productcorrelations`) with embedded product data for display efficiency:

```typescript
interface ProductCorrelation {
  correlation_id: string;           // Unique identifier
  source_entity_code: string;       // Main product code
  target_entity_code: string;       // Related product code
  correlation_type: "related";      // Type of correlation

  // Embedded product data (for display without joins)
  source_product: {
    entity_code: string;
    sku: string;
    name: Record<string, string>;   // { it: "...", en: "..." }
    cover_image_url?: string;
    price?: number;
  };
  target_product: {
    entity_code: string;
    sku: string;
    name: Record<string, string>;
    cover_image_url?: string;
    price?: number;
  };

  position: number;                 // Display order
  is_bidirectional: boolean;        // A↔B or A→B only
  is_active: boolean;               // Soft delete flag

  created_by?: string;              // User or API key ID
  source_import?: {                 // Import tracking
    source_id: string;
    source_name: string;
    imported_at: Date;
  };

  created_at: Date;
  updated_at: Date;
}
```

## Authentication

All endpoints support two authentication methods:

### API Key Authentication

```bash
-H "x-auth-method: api-key"
-H "x-api-key-id: ak_{tenant-id}_{key-suffix}"
-H "x-api-secret: sk_{secret}"
```

### Session Authentication

Use B2B portal login session (cookie-based).

## Endpoints

### List Correlations

```
GET /api/b2b/correlations
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `source_entity_code` | string | - | Filter by source product code |
| `target_entity_code` | string | - | Filter by target product code |
| `correlation_type` | string | `related` | Filter by type |
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Items per page (max: 100) |

#### Example Request

```bash
curl "http://localhost:3001/api/b2b/correlations?source_entity_code=001479&page=1&limit=10" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant-id}_{key}" \
  -H "x-api-secret: sk_{secret}"
```

#### Example Response

```json
{
  "correlations": [
    {
      "correlation_id": "abc123xyz",
      "source_entity_code": "001479",
      "target_entity_code": "001480",
      "correlation_type": "related",
      "source_product": {
        "entity_code": "001479",
        "sku": "001479",
        "name": { "it": "Contatore Acqua DN15", "en": "Water Meter DN15" },
        "cover_image_url": "https://cdn.example.com/001479.jpg",
        "price": 45.00
      },
      "target_product": {
        "entity_code": "001480",
        "sku": "001480",
        "name": { "it": "Raccordo 1/2\"", "en": "Fitting 1/2\"" },
        "cover_image_url": "https://cdn.example.com/001480.jpg",
        "price": 12.50
      },
      "position": 0,
      "is_bidirectional": true,
      "is_active": true,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### Create Correlation

```
POST /api/b2b/correlations
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source_entity_code` | string | Yes | Source product code |
| `target_entity_code` | string | Yes | Target product code |
| `correlation_type` | string | No | Type (default: `related`) |
| `is_bidirectional` | boolean | No | Create reverse correlation (default: `false`) |
| `position` | number | No | Display order (default: `0`) |

#### Example Request

```bash
curl -X POST "http://localhost:3001/api/b2b/correlations" \
  -H "Content-Type: application/json" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant-id}_{key}" \
  -H "x-api-secret: sk_{secret}" \
  -d '{
    "source_entity_code": "001479",
    "target_entity_code": "001480",
    "is_bidirectional": true
  }'
```

#### Example Response (Bidirectional)

```json
{
  "success": true,
  "correlations": [
    {
      "correlation_id": "abc123xyz",
      "source_entity_code": "001479",
      "target_entity_code": "001480",
      "correlation_type": "related",
      "is_bidirectional": true,
      "position": 0,
      "is_active": true
    },
    {
      "correlation_id": "def456uvw",
      "source_entity_code": "001480",
      "target_entity_code": "001479",
      "correlation_type": "related",
      "is_bidirectional": true,
      "position": 0,
      "is_active": true
    }
  ],
  "message": "Created 2 correlation(s)"
}
```

#### Validation Rules

- Source and target products must exist in PIM
- Cannot create self-correlation (same source and target)
- Duplicate correlations return `409 Conflict`

---

### Bulk Import Correlations (JSON API)

```
POST /api/b2b/correlations/bulk
```

Import multiple correlations in a single request. Ideal for ERP sync.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `correlations` | array | Yes | Array of correlation objects (max: 1000) |
| `sync_mode` | string | No | `merge` (default) or `replace` |
| `correlation_type` | string | No | Default type for all (default: `related`) |

Each correlation object:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source_entity_code` | string | Yes | Source product code |
| `target_entity_code` | string | Yes | Target product code |
| `is_bidirectional` | boolean | No | Create reverse correlation (default: `false`) |
| `position` | number | No | Display order (default: index) |

#### Sync Modes

| Mode      | Description                                                    |
|-----------|----------------------------------------------------------------|
| `merge`   | Add new correlations, skip existing duplicates                 |
| `replace` | Delete all existing correlations of the type first, then insert |

#### Example Request

```bash
curl -X POST "http://localhost:3001/api/b2b/correlations/bulk" \
  -H "Content-Type: application/json" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant-id}_{key}" \
  -H "x-api-secret: sk_{secret}" \
  -d '{
    "correlations": [
      { "source_entity_code": "001479", "target_entity_code": "001480", "is_bidirectional": true },
      { "source_entity_code": "001479", "target_entity_code": "001481" },
      { "source_entity_code": "001479", "target_entity_code": "001482" }
    ],
    "sync_mode": "merge"
  }'
```

#### Example Response

```json
{
  "success": true,
  "result": {
    "created": 4,
    "skipped": 0,
    "failed": 0,
    "errors": []
  },
  "message": "Created 4 correlations, skipped 0, failed 0"
}
```

#### Error Handling

Failed correlations are reported in the `errors` array:

```json
{
  "success": true,
  "result": {
    "created": 2,
    "skipped": 1,
    "failed": 1,
    "errors": [
      {
        "index": 2,
        "source": "001479",
        "target": "INVALID",
        "error": "Target product not found: INVALID"
      }
    ]
  }
}
```

---

### Get Single Correlation

```
GET /api/b2b/correlations/{correlation_id}
```

#### Example Request

```bash
curl "http://localhost:3001/api/b2b/correlations/abc123xyz" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant-id}_{key}" \
  -H "x-api-secret: sk_{secret}"
```

#### Example Response

```json
{
  "correlation": {
    "correlation_id": "abc123xyz",
    "source_entity_code": "001479",
    "target_entity_code": "001480",
    "correlation_type": "related",
    "source_product": {
      "entity_code": "001479",
      "sku": "001479",
      "name": { "it": "Contatore Acqua DN15" },
      "cover_image_url": "https://cdn.example.com/001479.jpg",
      "price": 45.00
    },
    "target_product": {
      "entity_code": "001480",
      "sku": "001480",
      "name": { "it": "Raccordo 1/2\"" },
      "cover_image_url": "https://cdn.example.com/001480.jpg",
      "price": 12.50
    },
    "position": 0,
    "is_bidirectional": true,
    "is_active": true,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

---

### Update Correlation

```
PATCH /api/b2b/correlations/{correlation_id}
```

#### Request Body

| Field | Type | Description |
|-------|------|-------------|
| `position` | number | Update display order |
| `is_active` | boolean | Enable/disable correlation |

#### Example Request

```bash
curl -X PATCH "http://localhost:3001/api/b2b/correlations/abc123xyz" \
  -H "Content-Type: application/json" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant-id}_{key}" \
  -H "x-api-secret: sk_{secret}" \
  -d '{
    "position": 5,
    "is_active": false
  }'
```

---

### Delete Correlation

```
DELETE /api/b2b/correlations/{correlation_id}
```

Permanently deletes the correlation.

#### Example Request

```bash
curl -X DELETE "http://localhost:3001/api/b2b/correlations/abc123xyz" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant-id}_{key}" \
  -H "x-api-secret: sk_{secret}"
```

#### Example Response

```json
{
  "success": true,
  "message": "Correlation deleted"
}
```

---

### Bulk Delete Correlations

```
POST /api/b2b/correlations/bulk-delete
```

Delete multiple correlations in a single request. Supports three modes:

#### Option 1: Delete by IDs

```json
{
  "correlation_ids": ["id1", "id2", "id3"]
}
```

#### Option 2: Delete by Filter

```json
{
  "filter": {
    "source_entity_code": "001479",
    "target_entity_code": "001480",
    "correlation_type": "related"
  }
}
```

At least one filter criterion is required to prevent accidental mass deletion.

#### Option 3: Delete All of a Type

```json
{
  "delete_all": true,
  "correlation_type": "related"
}
```

#### Example Request (Delete by IDs)

```bash
curl -X POST "http://localhost:3001/api/b2b/correlations/bulk-delete" \
  -H "Content-Type: application/json" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant-id}_{key}" \
  -H "x-api-secret: sk_{secret}" \
  -d '{
    "correlation_ids": ["abc123xyz", "def456uvw"]
  }'
```

#### Example Request (Delete by Filter)

```bash
curl -X POST "http://localhost:3001/api/b2b/correlations/bulk-delete" \
  -H "Content-Type: application/json" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant-id}_{key}" \
  -H "x-api-secret: sk_{secret}" \
  -d '{
    "filter": {
      "source_entity_code": "001479",
      "correlation_type": "related"
    }
  }'
```

#### Example Response

```json
{
  "success": true,
  "result": {
    "deleted": 5,
    "failed": 0,
    "errors": []
  },
  "message": "Deleted 5 correlation(s)"
}
```

---

### Get Statistics

```
GET /api/b2b/correlations/stats
```

Returns correlation statistics for the dashboard.

#### Example Request

```bash
curl "http://localhost:3001/api/b2b/correlations/stats" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant-id}_{key}" \
  -H "x-api-secret: sk_{secret}"
```

#### Example Response

```json
{
  "stats": {
    "total_correlations": 150,
    "products_with_correlations": 45,
    "by_type": {
      "related": 150
    }
  }
}
```

---

## Bulk Import (ERP Integration)

The correlations API supports bulk import from ERP systems (e.g., CORRE00F table) using the batched import system.

### CSV Format

```csv
source,target,bidirectional
001479,001480,S
001479,001481,N
001480,001482,S
```

| Column | Description |
|--------|-------------|
| `source` | Source product entity_code (ERP: ARTPR) |
| `target` | Target product entity_code (ERP: ARTCO) |
| `bidirectional` | S=Yes, N=No (ERP: CORSIM) |

### Step 1: Create Import Source

```bash
curl -X POST "http://localhost:3001/api/b2b/pim/sources" \
  -H "Content-Type: application/json" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant-id}_{key}" \
  -H "x-api-secret: sk_{secret}" \
  -d '{
    "source_id": "erp-corre00f",
    "source_name": "ERP Correlations (CORRE00F)",
    "source_type": "csv",
    "import_type": "correlations",
    "field_mapping": [
      { "source_field": "source", "pim_field": "source_entity_code" },
      { "source_field": "target", "pim_field": "target_entity_code" },
      { "source_field": "bidirectional", "pim_field": "is_bidirectional" }
    ],
    "correlation_settings": {
      "default_type": "related",
      "create_bidirectional": true,
      "sync_mode": "replace"
    }
  }'
```

### Step 2: Upload CSV and Start Import

```bash
curl -X POST "http://localhost:3001/api/b2b/pim/import" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant-id}_{key}" \
  -H "x-api-secret: sk_{secret}" \
  -F "file=@correlations.csv" \
  -F "source_id=erp-corre00f"
```

### Step 3: Check Import Status

```bash
curl "http://localhost:3001/api/b2b/pim/import/{job_id}" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant-id}_{key}" \
  -H "x-api-secret: sk_{secret}"
```

### Import Settings

| Setting | Values | Description |
|---------|--------|-------------|
| `sync_mode` | `replace` / `merge` | `replace`: Delete existing before import. `merge`: Only add new. |
| `create_bidirectional` | `true` / `false` | Auto-create reverse correlations when `bidirectional=S` |
| `default_type` | `related` | Correlation type to assign |

### Bidirectional Flag Parsing

| Input | Result |
|-------|--------|
| `S` | `true` (Italian "Sì") |
| `N` | `false` (Italian "No") |
| `Y` | `true` (English "Yes") |
| `1` | `true` |
| `0` | `false` |
| `true` | `true` |
| `false` | `false` |

---

## Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| `400` | `source_entity_code and target_entity_code are required` | Missing required fields |
| `400` | `Cannot create correlation to the same product` | Self-correlation attempted |
| `400` | `Invalid correlation_type` | Unknown correlation type |
| `401` | `Unauthorized` | Invalid or missing authentication |
| `404` | `Source product not found: {code}` | Source product doesn't exist |
| `404` | `Target product not found: {code}` | Target product doesn't exist |
| `404` | `Correlation not found` | Correlation ID doesn't exist |
| `409` | `Correlation already exists` | Duplicate correlation |

---

## Usage in UI

### Correlations Dashboard

Navigate to **Correlazioni & Analytics** in the App Launcher to:

1. View all correlations with pagination
2. Search by product code
3. See source and target products with images
4. Delete individual correlations
5. View import job status

### Product Detail Page

Related products are displayed on the PIM product detail page, fetched via:

```
GET /api/b2b/correlations?source_entity_code={product_code}
```
