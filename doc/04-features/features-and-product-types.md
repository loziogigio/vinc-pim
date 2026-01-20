# Features and Product Types in PIM

This document explains how Features and Product Types work in the VINC Commerce Suite PIM (Product Information Management) system.

## Overview

The PIM uses a two-level abstraction for managing product attributes:

```
┌─────────────────────────────────────────────────────────────┐
│  Features                                                    │
│  Define reusable product attributes (e.g., Diameter, Color)  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Product Types                                               │
│  Group features into templates (e.g., Water Meter, Pump)     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Products                                                    │
│  Assign a type and fill in feature values                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Features

**Features** (also called Technical Features) define reusable data attributes for products.

### Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `feature_id` | string | Yes | Unique identifier (nanoid) |
| `key` | string | Yes | Slug-like identifier (e.g., `diameter`, `material`) |
| `label` | string | Yes | Display name (e.g., "Diameter", "Material") |
| `type` | enum | Yes | One of: `text`, `number`, `select`, `multiselect`, `boolean` |
| `uom_id` | string | No | Reference to Unit of Measurement |
| `unit` | string | No | Legacy field (deprecated, use `uom_id`) |
| `options` | string[] | No | Available options for `select`/`multiselect` types |
| `default_required` | boolean | No | Default required state when added to product types |
| `display_order` | number | No | Sorting order (default: 0) |
| `is_active` | boolean | No | Active status (default: true) |

### Feature Types

| Type | Input Control | Example |
|------|--------------|---------|
| `text` | Text input | Material: "Stainless Steel" |
| `number` | Number input | Pressure Rating: 16 bar |
| `boolean` | Checkbox | FDA Approved: Yes/No |
| `select` | Dropdown | Size: Small / Medium / Large |
| `multiselect` | Checkbox list | Certifications: CE, UL, FDA |

### Example Feature

```json
{
  "feature_id": "xyz123abc456",
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
| GET | `/api/b2b/pim/features` | List all features |
| POST | `/api/b2b/pim/features` | Create a new feature |
| PATCH | `/api/b2b/pim/features/{featureId}` | Update a feature |
| DELETE | `/api/b2b/pim/features/{featureId}` | Delete a feature |

### Create Feature Example

```bash
curl -X POST "http://localhost:3001/api/b2b/pim/features" \
  -H "Content-Type: application/json" \
  -H "x-auth-method: api-key" \
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
- Cannot delete a feature that is used by any product type

---

## Product Types

**Product Types** are templates that define which features apply to a category of products.

### Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `product_type_id` | string | Yes | Unique identifier (nanoid) |
| `name` | string | Yes | Display name (e.g., "Water Meter") |
| `slug` | string | Yes | URL-friendly identifier (lowercase) |
| `description` | string | No | Optional description |
| `features` | array | No | Array of feature references |
| `display_order` | number | No | Sorting order (default: 0) |
| `is_active` | boolean | No | Active status (default: true) |
| `product_count` | number | No | Cached count of products using this type |

### Feature Reference Schema

Each feature in the `features` array has:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `feature_id` | string | Yes | Reference to Feature |
| `required` | boolean | No | Whether this feature is required for products |
| `display_order` | number | No | Display order within this product type |

### Example Product Type

```json
{
  "product_type_id": "abc123xyz789",
  "name": "Water Meter",
  "slug": "water-meter",
  "description": "Meters for measuring water flow and usage",
  "features": [
    { "feature_id": "diameter-001", "required": true, "display_order": 0 },
    { "feature_id": "material-001", "required": true, "display_order": 1 },
    { "feature_id": "pressure-001", "required": false, "display_order": 2 }
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
curl -X POST "http://localhost:3001/api/b2b/pim/product-types" \
  -H "Content-Type: application/json" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant}_{key}" \
  -H "x-api-secret: sk_{secret}" \
  -d '{
    "name": "Pressure Gauge",
    "slug": "pressure-gauge",
    "description": "Instruments for measuring pressure",
    "features": [
      { "feature_id": "xyz123", "required": true, "display_order": 0 },
      { "feature_id": "abc456", "required": false, "display_order": 1 }
    ],
    "display_order": 5
  }'
```

### Constraints

- `slug` must be unique per tenant
- Cannot delete a product type that has products assigned

---

## How They Work Together

### 1. Create Features

First, define the reusable attributes:

```
Features:
├── diameter (number, unit: mm)
├── material (select: Steel, Brass, Plastic)
├── pressure_rating (number, unit: bar)
├── color (text)
└── fda_approved (boolean)
```

### 2. Create Product Types

Group features into product templates:

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
  "name": "Digital Water Meter 25mm",
  "product_type": {
    "product_type_id": "water-meter-001",
    "name": "Water Meter",
    "features": [
      { "key": "diameter", "value": 25, "unit": "mm" },
      { "key": "material", "value": "Brass" },
      { "key": "pressure_rating", "value": 16, "unit": "bar" }
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
│  1. Create Features                                                   │
│     POST /api/b2b/pim/features                                        │
│     ┌──────────────────────────────────────────────┐                 │
│     │ { key: "diameter", type: "number", ... }     │                 │
│     └──────────────────────────────────────────────┘                 │
│                          │                                            │
│                          ▼                                            │
│  2. Create Product Types (referencing features)                       │
│     POST /api/b2b/pim/product-types                                   │
│     ┌──────────────────────────────────────────────┐                 │
│     │ { name: "Water Meter", features: [           │                 │
│     │   { feature_id: "xyz", required: true }      │                 │
│     │ ] }                                          │                 │
│     └──────────────────────────────────────────────┘                 │
│                          │                                            │
│                          ▼                                            │
│  3. Create Products (with type and feature values)                    │
│     POST /api/b2b/pim/products                                        │
│     ┌──────────────────────────────────────────────┐                 │
│     │ { entity_code: "WM-001",                     │                 │
│     │   product_type: { id: "...",                 │                 │
│     │     features: [{ key: "diameter", value: 25 }│                 │
│     │   ] }                                        │                 │
│     │ }                                            │                 │
│     └──────────────────────────────────────────────┘                 │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## UI Components

### FeaturesForm

Renders feature inputs based on product type definition:

- **Required features** are shown first with red asterisks
- **Optional features** are shown in a collapsible section
- Input type adapts to feature type (text, number, select, etc.)
- Shows unit symbol for numeric features with UOM

Location: `src/components/pim/FeaturesForm.tsx`

### ProductTypeSelector

Modal/dropdown for selecting a product type when creating products:

- Searchable list of available product types
- Shows feature count for each type
- When selected, enriches the type with full feature definitions

Location: `src/components/pim/ProductTypeSelector.tsx`

---

## Safety Constraints

### Feature Deletion

Cannot delete a feature that is used by any product type:

```json
{
  "error": "Cannot delete feature used in 3 product type(s)"
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
| `Features` | `FeatureModel` | Technical feature definitions |
| `ProductType` | `ProductTypeModel` | Product type templates |
| `pimproducts` | `PIMProductModel` | Products with embedded type data |
| `uoms` | `UOMModel` | Units of measurement |

---

## File Locations

```
Database Models:
  src/lib/db/models/feature.ts
  src/lib/db/models/product-type.ts
  src/lib/db/models/uom.ts
  src/lib/db/models/pim-product.ts

Type Definitions:
  src/lib/types/pim.ts
  src/lib/types/entities/product-type.types.ts

API Routes:
  src/app/api/b2b/pim/features/route.ts
  src/app/api/b2b/pim/features/[featureId]/route.ts
  src/app/api/b2b/pim/product-types/route.ts
  src/app/api/b2b/pim/product-types/[id]/route.ts

UI Components:
  src/components/pim/FeaturesForm.tsx
  src/components/pim/ProductTypeSelector.tsx
```

---

## Related Documentation

- [TESTING_STANDARDS.md](../src/test/TESTING_STANDARDS.md) - Testing guidelines
- [CLAUDE.md](../CLAUDE.md) - Project guidelines
