# Pricing & Packaging API

API documentation for importing products with packaging options and reference-based pricing.

## Overview

Products can have multiple packaging options (e.g., PZ, BOX, CF, PALLET), each with its own pricing. The pricing system supports:

- **Reference-based pricing** - derive prices from a reference packaging
- **List discount** - percentage or fixed amount discount from retail to get list price
- **Sale discount** - percentage or fixed amount discount from list to get sale price
- **Packaging-level promotions** - promotions tied to specific packaging options

## Pricing Structure

### Price Hierarchy

```
Retail Price (MSRP)
    ↓ List Discount (% or fixed amount)
List Price (B2B cost)
    ↓ Sale Discount (% or fixed amount)
Sale Price (discounted)
```

### Reference-Based Pricing

Packaging options can reference another packaging for price derivation. The reference price is multiplied by the quantity ratio.

**Example:** CF (24 units) references BOX (6 units)
- Quantity ratio: 24 / 6 = 4
- CF retail = BOX retail × 4 = €540 × 4 = €2160
- CF list = CF retail × (1 - 50%) = €2160 × 0.5 = €1080
- CF sale = BOX sale × 4 - €150 = €243 × 4 - €150 = €822

## Packaging Pricing Fields

### Unit Prices (per single piece) - PRIMARY

| Field | Type | Description |
|-------|------|-------------|
| `list_unit` | number | List price **per unit** (e.g., €45/pz) |
| `retail_unit` | number | Retail price **per unit** (e.g., €90/pz) |
| `sale_unit` | number | Sale price **per unit** (e.g., €40.50/pz) |

### Package Prices (unit × qty) - CALCULATED

| Field | Type | Description |
|-------|------|-------------|
| `list` | number | Total list price for packaging (list_unit × qty) |
| `retail` | number | Total retail price for packaging (retail_unit × qty) |
| `sale` | number | Total sale price for packaging (sale_unit × qty) |

### Reference & Discount Fields

| Field | Type | Description |
|-------|------|-------------|
| `price_ref` | string | Reference packaging code (e.g., "PZ", "BOX") |
| `list_discount_pct` | number | Percentage discount from retail to list (e.g., 50 for -50%) |
| `list_discount_amt` | number | Fixed amount discount from retail to list (e.g., 5 for -€5) |
| `sale_discount_pct` | number | Percentage discount from list to sale (e.g., 10 for -10%) |
| `sale_discount_amt` | number | Fixed amount discount from list to sale (e.g., 150 for -€150) |

> **Note:** You can provide either unit prices OR package prices. If only package prices are provided, unit prices can be derived by dividing by `qty`.

## Import API

### Endpoint

```
POST /api/b2b/pim/import/api
```

### Authentication

```bash
-H "x-auth-method: api-key"
-H "x-api-key-id: ak_{tenant-id}_{key-suffix}"
-H "x-api-secret: sk_{secret}"
```

### Request Body (Package Prices)

This example uses **package prices** (total per packaging):

```json
{
  "source_id": "erp-sync",
  "products": [
    {
      "entity_code": "PROD-001",
      "sku": "PROD-001",
      "name": { "it": "Prodotto Test", "en": "Test Product" },
      "status": "published",
      "packaging_options": [
        {
          "code": "PZ",
          "label": { "it": "Pezzo", "en": "Piece" },
          "qty": 1,
          "uom": "PZ",
          "is_default": false,
          "is_smallest": true,
          "pricing": {
            "retail": 100,
            "list": 50,
            "list_discount_pct": 50
          }
        },
        {
          "code": "BOX",
          "label": { "it": "Scatola", "en": "Box" },
          "qty": 6,
          "uom": "PZ",
          "is_default": true,
          "is_smallest": false,
          "pricing": {
            "retail": 540,
            "list": 270,
            "sale": 243,
            "price_ref": "PZ",
            "list_discount_pct": 50,
            "sale_discount_pct": 10
          },
          "promotions": [
            {
              "promo_code": "BOX-PROMO",
              "is_active": true,
              "label": { "it": "Sconto quantità", "en": "Quantity discount" },
              "discount_percentage": 10,
              "min_quantity": 3
            }
          ]
        },
        {
          "code": "CF",
          "label": { "it": "Cartone", "en": "Carton" },
          "qty": 24,
          "uom": "PZ",
          "is_default": false,
          "is_smallest": false,
          "pricing": {
            "retail": 2160,
            "list": 1080,
            "sale": 822,
            "price_ref": "BOX",
            "list_discount_pct": 50,
            "sale_discount_amt": 150
          }
        }
      ]
    }
  ]
}
```

### Request Body (Unit Prices)

This example uses **unit prices** (per single piece) - simpler and recommended:

```json
{
  "source_id": "erp-sync",
  "products": [
    {
      "entity_code": "PROD-002",
      "sku": "PROD-002",
      "name": { "it": "Prodotto con prezzi unitari" },
      "status": "published",
      "packaging_options": [
        {
          "code": "PZ",
          "qty": 1,
          "uom": "PZ",
          "is_default": false,
          "is_smallest": true,
          "is_sellable": false,
          "pricing": {
            "retail_unit": 100,
            "list_unit": 50
          }
        },
        {
          "code": "BOX",
          "qty": 6,
          "uom": "PZ",
          "is_default": true,
          "is_smallest": false,
          "is_sellable": true,
          "pricing": {
            "retail_unit": 90,
            "list_unit": 45,
            "sale_unit": 40.50
          }
        }
      ]
    }
  ]
}
```

**Result for BOX (qty: 6):**
| Unit Price | × qty | = Package Price |
|------------|-------|-----------------|
| `retail_unit`: €90 | × 6 | `retail`: €540 |
| `list_unit`: €45 | × 6 | `list`: €270 |
| `sale_unit`: €40.50 | × 6 | `sale`: €243 |

### Response

```json
{
  "success": true,
  "job_id": "api_import_1234567890_abc123",
  "summary": {
    "total": 1,
    "successful": 1,
    "failed": 0,
    "auto_published": 1,
    "duration_seconds": 0.2,
    "sync_batches_queued": 1
  },
  "errors": []
}
```

## Packaging Option Structure

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `code` | string | Unique packaging code (e.g., "PZ", "BOX", "CF") |
| `qty` | number | Quantity per packaging unit |
| `uom` | string | Unit of measure (e.g., "PZ") |
| `is_default` | boolean | Is this the default packaging? |
| `is_smallest` | boolean | Is this the smallest unit? |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `label` | MultiLangString | Multilingual label |
| `is_sellable` | boolean | Can this packaging be sold? (default: `true`) |
| `ean` | string | EAN barcode |
| `position` | number | Display order |
| `pricing` | object | Pricing details (see above) |
| `promotions` | array | Packaging-level promotions |

## Promotion Structure

Promotions have to be tied to specific packaging options:

```json
{
  "promo_code": "SUMMER-2024",
  "promo_row": 1,
  "is_active": true,
  "promo_type": "STD",
  "label": { "it": "Promo Estate", "en": "Summer Promo" },
  "discount_percentage": 15,
  "promo_price": 85.00,
  "min_quantity": 2,
  "start_date": "2024-06-01T00:00:00Z",
  "end_date": "2024-08-31T23:59:59Z",
  "is_stackable": false,
  "priority": 1
}
```

### Promotion Fields

| Field | Type | Description |
|-------|------|-------------|
| `promo_code` | string | Promotion code identifier |
| `promo_row` | number | Row number from ERP |
| `is_active` | boolean | Is promotion currently active? |
| `promo_type` | string | Business category (STD, XXX, OMG, EOL) |
| `label` | MultiLangString | Promotion label |
| `discount_percentage` | number | Percentage discount |
| `discount_amount` | number | Fixed amount discount |
| `promo_price` | number | Final promotional price |
| `min_quantity` | number | Minimum quantity required |
| `min_order_value` | number | Minimum order value required |
| `start_date` | string | Promotion start date (ISO 8601) |
| `end_date` | string | Promotion end date (ISO 8601) |
| `is_stackable` | boolean | Can combine with other promotions sharing the same promo_code? |
| `priority` | number | Promotion priority (lower = higher priority) |

## Complete Example (Unit Prices - Recommended)

```bash
curl -X POST "https://api.example.com/api/b2b/pim/import/api" \
  -H "Content-Type: application/json" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant-id}_{key-suffix}" \
  -H "x-api-secret: sk_{secret}" \
  -d '{
    "source_id": "erp-sync",
    "products": [
      {
        "entity_code": "DRILL-PRO-750",
        "sku": "DRILL-PRO-750",
        "name": {
          "it": "Trapano Professionale 750W",
          "en": "Professional Drill 750W"
        },
        "status": "published",
        "packaging_options": [
          {
            "code": "PZ",
            "label": { "it": "Pezzo", "en": "Piece" },
            "qty": 1,
            "uom": "PZ",
            "is_default": true,
            "is_smallest": true,
            "ean": "8001234567890",
            "pricing": {
              "retail_unit": 199.99,
              "list_unit": 149.99
            }
          },
          {
            "code": "BOX",
            "label": { "it": "Confezione da 4", "en": "Box of 4" },
            "qty": 4,
            "uom": "PZ",
            "is_default": false,
            "is_smallest": false,
            "ean": "8001234567891",
            "pricing": {
              "retail_unit": 199.99,
              "list_unit": 137.49,
              "sale_unit": 124.99
            },
            "promotions": [
              {
                "promo_code": "PRO-PACK",
                "is_active": true,
                "label": {
                  "it": "Risparmia sul pack",
                  "en": "Save on pack"
                },
                "discount_percentage": 9,
                "min_quantity": 1,
                "start_date": "2024-01-01T00:00:00Z",
                "end_date": "2024-12-31T23:59:59Z"
              }
            ]
          }
        ]
      }
    ]
  }'
```

**Calculated package prices for BOX (qty: 4):**

- `retail`: 199.99 × 4 = €799.96
- `list`: 137.49 × 4 = €549.96
- `sale`: 124.99 × 4 = €499.96

## Get Product API

Retrieve a product with its packaging options and pricing.

**Endpoint:**

```http
GET /api/b2b/pim/products/{entity_code}
```

**Headers:**

```bash
-H "x-auth-method: api-key"
-H "x-api-key-id: ak_{tenant-id}_{key-suffix}"
-H "x-api-secret: sk_{secret}"
```

**Example Request:**

```bash
curl "https://api.example.com/api/b2b/pim/products/DRILL-PRO-750" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant-id}_{key-suffix}" \
  -H "x-api-secret: sk_{secret}"
```

**Example Response:**

```json
{
  "product": {
    "entity_code": "DRILL-PRO-750",
    "sku": "DRILL-PRO-750",
    "name": { "it": "Trapano Professionale 750W", "en": "Professional Drill 750W" },
    "status": "published",
    "packaging_options": [
      {
        "code": "PZ",
        "label": { "it": "Pezzo", "en": "Piece" },
        "qty": 1,
        "uom": "PZ",
        "is_default": false,
        "is_smallest": true,
        "pricing": {
          "retail_unit": 100,
          "list_unit": 50,
          "retail": 100,
          "list": 50
        },
        "promotions": []
      },
      {
        "code": "BOX",
        "label": { "it": "Scatola", "en": "Box" },
        "qty": 6,
        "uom": "PZ",
        "is_default": true,
        "is_smallest": false,
        "pricing": {
          "retail_unit": 90,
          "list_unit": 45,
          "sale_unit": 40.50,
          "retail": 540,
          "list": 270,
          "sale": 243
        },
        "promotions": [
          {
            "promo_code": "BOX-PROMO",
            "is_active": true,
            "label": { "it": "Sconto quantità", "en": "Quantity discount" },
            "discount_percentage": 10,
            "min_quantity": 3
          }
        ]
      }
    ]
  }
}
```

## UI Display

The PIM product detail page displays packaging options in a table:

| Code | Label | Qty | UOM | List | Retail | Sale | List Disc. | Sale Disc. | Ref | Flags |
|------|-------|-----|-----|------|--------|------|------------|------------|-----|-------|
| PZ | Pezzo | 1 | PZ | €50.00 | €100.00 | — | -50% | — | — | Smallest |
| BOX | Scatola | 6 | PZ | €270.00 | €540.00 | €243.00 | -50% | -10% | PZ | Default |
| CF | Cartone | 24 | PZ | €1080.00 | €2160.00 | €822.00 | -50% | -€150 | BOX | |

Promotions are displayed in a separate table showing packaging, promo code, label, discount, min qty, promo price, and date range.
