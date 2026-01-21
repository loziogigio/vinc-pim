# Technical Specifications and Product Types in PIM

This document explains how Technical Specifications and Product Types work in the VINC Commerce Suite PIM (Product Information Management) system.

## Overview

The PIM uses a two-level abstraction for managing product attributes:

```
┌─────────────────────────────────────────────────────────────┐
│  Technical Specifications                                    │
│  Define reusable attributes (e.g., Diameter, Pressure)       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Product Types                                               │
│  Group specs into templates (e.g., Water Meter, Pump)        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Products                                                    │
│  Assign a type and fill in specification values              │
└─────────────────────────────────────────────────────────────┘
```

---

## Marketing Features vs Technical Specifications

The PIM distinguishes between two types of product information:

| Type | Field | Purpose | Structure |
|------|-------|---------|-----------|
| **Marketing Features** | `marketing_features` | Bullet points for marketing | `{ "it": ["Wireless", "Waterproof"] }` |
| **Technical Specifications** | `technical_specifications` | Measured data with units | `{ "it": [{ key, label, value, uom }] }` |

### Marketing Features
Simple string arrays per language for marketing highlights:
```json
{
  "marketing_features": {
    "it": ["Alta efficienza energetica", "Silenzioso", "Facile installazione"],
    "en": ["High energy efficiency", "Quiet operation", "Easy installation"]
  }
}
```

### Technical Specifications
Structured data with keys, labels, values, and units:
```json
{
  "technical_specifications": {
    "it": [
      { "key": "max_pressure", "label": "Pressione Massima", "value": "10", "uom": "bar" },
      { "key": "flow_rate", "label": "Portata", "value": "120", "uom": "l/min" }
    ]
  }
}
```

---

## API Authentication

All API endpoints support two authentication methods:

### 1. Session Authentication (B2B Portal)

Used when accessing from the B2B portal UI. The session cookie is automatically included.

### 2. API Key Authentication (External Scripts/Integrations)

For external integrations and sync scripts, use API key authentication with these headers:

| Header         | Required | Format                       | Description          |
|----------------|----------|------------------------------|----------------------|
| `x-api-key-id` | Yes      | `ak_{tenant}_{12-hex-chars}` | API key identifier   |
| `x-api-secret` | Yes      | `sk_{32-hex-chars}`          | API key secret       |

**Example:**

```bash
curl -X GET "http://localhost:3001/{tenant}/api/b2b/pim/product-types" \
  -H "x-api-key-id: ak_hidros-it_aabbccddeeff" \
  -H "x-api-secret: sk_aabbccddeeff00112233445566778899"
```

**URL Patterns:**

- With tenant prefix: `/{tenant}/api/b2b/pim/...` (recommended for clarity)
- Without prefix: `/api/b2b/pim/...` (tenant extracted from API key)

**Required Permissions:**

| Endpoint                               | Permission                        |
|----------------------------------------|-----------------------------------|
| `/api/b2b/pim/technical-specifications` | `technical-specifications` or `*` |
| `/api/b2b/pim/product-types`           | `product-types` or `*`            |

---

## Technical Specifications

**Technical Specifications** define reusable data attributes for products.

### Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `technical_specification_id` | string | Yes | Unique identifier (nanoid) |
| `key` | string | Yes | Slug-like identifier (e.g., `diameter`, `material`) |
| `label` | string | Yes | Display name (e.g., "Diameter", "Material") |
| `type` | enum | Yes | One of: `text`, `number`, `select`, `multiselect`, `boolean` |
| `uom_id` | string | No | Reference to Unit of Measurement |
| `unit` | string | No | Legacy field (deprecated, use `uom_id`) |
| `options` | string[] | No | Available options for `select`/`multiselect` types |
| `default_required` | boolean | No | Default required state when added to product types |
| `display_order` | number | No | Sorting order (default: 0) |
| `is_active` | boolean | No | Active status (default: true) |

### Specification Types

| Type | Input Control | Example |
|------|--------------|---------|
| `text` | Text input | Material: "Stainless Steel" |
| `number` | Number input | Pressure Rating: 16 bar |
| `boolean` | Checkbox | FDA Approved: Yes/No |
| `select` | Dropdown | Size: Small / Medium / Large |
| `multiselect` | Checkbox list | Certifications: CE, UL, FDA |

### Example Technical Specification

```json
{
  "technical_specification_id": "xyz123abc456",
  "key": "pressure_rating",
  "label": "Pressure Rating",
  "type": "number",
  "uom_id": "bar-001",
  "uom": {
    "uom_id": "bar-001",
    "symbol": "bar",
    "name": "Bar",
    "category": "pressure"
  },
  "default_required": true,
  "display_order": 1,
  "is_active": true
}
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/b2b/pim/technical-specifications` | List all specifications |
| POST | `/api/b2b/pim/technical-specifications` | Create a new specification |
| PATCH | `/api/b2b/pim/technical-specifications/{id}` | Update a specification |
| DELETE | `/api/b2b/pim/technical-specifications/{id}` | Delete a specification |

### Create Technical Specification Example

```bash
curl -X POST "http://localhost:3001/{tenant}/api/b2b/pim/technical-specifications" \
  -H "Content-Type: application/json" \
  -H "x-api-key-id: ak_{tenant}_{key}" \
  -H "x-api-secret: sk_{secret}" \
  -d '{
    "key": "diameter",
    "label": "Diameter",
    "type": "number",
    "uom_id": "mm-001",
    "default_required": true,
    "display_order": 1
  }'
```

### Constraints

- `key` must be unique per tenant
- Cannot delete a specification that is used by any product type

---

## Product Types

**Product Types** are templates that define which technical specifications apply to a category of products.

### Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `product_type_id` | string | Yes | Unique identifier (nanoid) |
| `code` | string | No | Customer's ERP code (e.g., "001", "010") - must be unique |
| `name` | string | Yes | Display name (e.g., "Water Meter") |
| `slug` | string | Yes | URL-friendly identifier (lowercase) |
| `description` | string | No | Optional description |
| `technical_specifications` | array | No | Array of specification references |
| `display_order` | number | No | Sorting order (default: 0) |
| `is_active` | boolean | No | Active status (default: true) |
| `product_count` | number | No | Cached count of products using this type |

### Technical Specification Reference Schema

Each specification in the `technical_specifications` array has:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `technical_specification_id` | string | Yes | Reference to Technical Specification |
| `required` | boolean | No | Whether this spec is required for products |
| `display_order` | number | No | Display order within this product type |

### Example Product Type

```json
{
  "product_type_id": "abc123xyz789",
  "code": "001",
  "name": "Water Meter",
  "slug": "water-meter",
  "description": "Meters for measuring water flow and usage",
  "technical_specifications": [
    { "technical_specification_id": "diameter-001", "required": true, "display_order": 0 },
    { "technical_specification_id": "material-001", "required": true, "display_order": 1 },
    { "technical_specification_id": "pressure-001", "required": false, "display_order": 2 }
  ],
  "display_order": 0,
  "is_active": true,
  "product_count": 45
}
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/b2b/pim/product-types` | List all product types |
| POST | `/api/b2b/pim/product-types` | Create a new product type |
| GET | `/api/b2b/pim/product-types/{id}` | Get a single product type |
| PATCH | `/api/b2b/pim/product-types/{id}` | Update a product type |
| DELETE | `/api/b2b/pim/product-types/{id}` | Delete a product type |
| GET | `/api/b2b/pim/product-types/{id}/products` | List products of this type |
| GET | `/api/b2b/pim/product-types/{id}/export` | Export products of this type |

### Create Product Type Example

```bash
curl -X POST "http://localhost:3001/{tenant}/api/b2b/pim/product-types" \
  -H "Content-Type: application/json" \
  -H "x-api-key-id: ak_{tenant}_{key}" \
  -H "x-api-secret: sk_{secret}" \
  -d '{
    "code": "005",
    "name": "Pressure Gauge",
    "slug": "pressure-gauge",
    "description": "Instruments for measuring pressure",
    "technical_specifications": [
      { "technical_specification_id": "xyz123", "required": true, "display_order": 0 },
      { "technical_specification_id": "abc456", "required": false, "display_order": 1 }
    ],
    "display_order": 5
  }'
```

> **Note:** The `code` field is optional but recommended for ERP integration. It must be unique per tenant.

### Constraints

- `slug` must be unique per tenant
- Cannot delete a product type that has products assigned

---

## How They Work Together

### 1. Create Technical Specifications

First, define the reusable attributes:

```
Technical Specifications:
├── diameter (number, unit: mm)
├── material (select: Steel, Brass, Plastic)
├── pressure_rating (number, unit: bar)
├── color (text)
└── fda_approved (boolean)
```

### 2. Create Product Types

Group specifications into product templates:

```
Product Types:
├── Water Meter
│   ├── diameter (required)
│   ├── material (required)
│   └── pressure_rating (optional)
│
├── Valve
│   ├── diameter (required)
│   ├── material (required)
│   ├── pressure_rating (required)
│   └── color (optional)
│
└── Food Processing Pump
    ├── material (required)
    ├── pressure_rating (required)
    └── fda_approved (required)
```

### 3. Assign to Products

When creating a product, select a type and fill in values:

```json
{
  "entity_code": "WM-001",
  "name": { "it": "Contatore Acqua Digitale 25mm" },
  "product_type": {
    "product_type_id": "water-meter-001",
    "name": "Water Meter"
  },
  "technical_specifications": {
    "it": [
      { "key": "diameter", "label": "Diametro", "value": "25", "uom": "mm" },
      { "key": "material", "label": "Materiale", "value": "Ottone" },
      { "key": "pressure_rating", "label": "Pressione Massima", "value": "16", "uom": "bar" }
    ]
  }
}
```

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         ADMIN WORKFLOW                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. Create Technical Specifications                                   │
│     POST /api/b2b/pim/technical-specifications                        │
│     ┌──────────────────────────────────────────────┐                 │
│     │ { key: "diameter", type: "number", ... }     │                 │
│     └──────────────────────────────────────────────┘                 │
│                          │                                            │
│                          ▼                                            │
│  2. Create Product Types (referencing specifications)                 │
│     POST /api/b2b/pim/product-types                                   │
│     ┌──────────────────────────────────────────────┐                 │
│     │ { name: "Water Meter",                       │                 │
│     │   technical_specifications: [                │                 │
│     │     { technical_specification_id: "xyz",     │                 │
│     │       required: true }                       │                 │
│     │   ] }                                        │                 │
│     └──────────────────────────────────────────────┘                 │
│                          │                                            │
│                          ▼                                            │
│  3. Create Products (with type and spec values)                       │
│     POST /api/b2b/pim/products                                        │
│     ┌──────────────────────────────────────────────┐                 │
│     │ { entity_code: "WM-001",                     │                 │
│     │   product_type: { product_type_id: "..." },  │                 │
│     │   technical_specifications: {                │                 │
│     │     "it": [{ key: "diameter", value: "25" }] │                 │
│     │   }                                          │                 │
│     │ }                                            │                 │
│     └──────────────────────────────────────────────┘                 │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## UI Components

### FeaturesForm

Renders specification inputs based on product type definition:

- **Required specifications** are shown first with red asterisks
- **Optional specifications** are shown in a collapsible section
- Input type adapts to specification type (text, number, select, etc.)
- Shows unit symbol for numeric specifications with UOM

Location: `src/components/pim/FeaturesForm.tsx`

### ProductTypeSelector

Modal/dropdown for selecting a product type when creating products:

- Searchable list of available product types
- Shows specification count for each type
- When selected, enriches the type with full specification definitions

Location: `src/components/pim/ProductTypeSelector.tsx`

---

## Safety Constraints

### Specification Deletion

Cannot delete a specification that is used by any product type:

```json
{
  "error": "Cannot delete specification used in 3 product type(s)"
}
```

### Product Type Deletion

Cannot delete a product type that has products assigned:

```json
{
  "error": "Cannot delete product type with 45 products"
}
```

---

## Database Collections

| Collection | Model | Description |
|------------|-------|-------------|
| `technicalspecifications` | `TechnicalSpecificationModel` | Technical specification definitions |
| `producttypes` | `ProductTypeModel` | Product type templates |
| `pimproducts` | `PIMProductModel` | Products with embedded type data |
| `uoms` | `UOMModel` | Units of measurement |

---

## File Locations

```
Database Models:
  src/lib/db/models/technical-specification.ts
  src/lib/db/models/product-type.ts
  src/lib/db/models/uom.ts
  src/lib/db/models/pim-product.ts

Type Definitions:
  src/lib/types/pim.ts
  src/lib/types/entities/product-type.types.ts

API Routes:
  src/app/api/b2b/pim/technical-specifications/route.ts
  src/app/api/b2b/pim/technical-specifications/[id]/route.ts
  src/app/api/b2b/pim/product-types/route.ts
  src/app/api/b2b/pim/product-types/[id]/route.ts

UI Components:
  src/components/pim/FeaturesForm.tsx
  src/components/pim/ProductTypeSelector.tsx

UI Pages:
  src/app/b2b/(protected)/pim/technical-specifications/page.tsx
  src/app/b2b/(protected)/pim/product-types/page.tsx
```

---

## Related Documentation

- [TESTING_STANDARDS.md](../src/test/TESTING_STANDARDS.md) - Testing guidelines
- [CLAUDE.md](../CLAUDE.md) - Project guidelines
