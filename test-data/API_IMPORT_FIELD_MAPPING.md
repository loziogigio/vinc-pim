# API Import with Field Mapping

## Overview

The API import system now supports **field mapping**, allowing you to map your supplier's field names to the PIM standard schema. Extra fields that aren't in the mapping are automatically preserved.

## How It Works

### 1. Configure Field Mappings in Source

Each import source has a `field_mappings` configuration:

```json
{
  "source_id": "api-supplier-1",
  "field_mappings": {
    "product_code": "entity_code",
    "product_title": "name",
    "retail_price": "price",
    "manufacturer": "brand"
  }
}
```

### 2. Send API Request with Supplier Fields

Your API request uses **your supplier's field names**:

```json
{
  "source_id": "api-supplier-1",
  "products": [
    {
      "product_code": "SUPP-001",
      "product_title": "Wireless Mouse",
      "retail_price": 34.99,
      "manufacturer": "TechBrand",
      "custom_field_1": "Express Shipping"
    }
  ]
}
```

### 3. System Transforms Data

The system automatically:

1. **Applies field mappings**: `product_code` → `entity_code`, `product_title` → `name`
2. **Preserves extra fields**: `custom_field_1` is kept as-is
3. **Validates required fields**: Checks `name`, `price`, `category` exist
4. **Applies auto-publish rules**: Based on completeness score

**Result in PIM**:
```json
{
  "entity_code": "SUPP-001",
  "sku": "SUPP-001",
  "name": "Wireless Mouse",
  "price": 34.99,
  "brand": "TechBrand",
  "custom_field_1": "Express Shipping"
}
```

## Example: Supplier with Different Field Names

### Source Configuration

```javascript
{
  "source_id": "api-supplier-with-mapping",
  "field_mappings": {
    // Core fields
    "product_code": "entity_code",
    "product_title": "name",
    "long_description": "description",
    "retail_price": "price",
    "promo_price": "sale_price",
    "product_category": "category",

    // Additional fields
    "manufacturer": "brand",
    "quantity_available": "stock",
    "item_weight": "weight",
    "product_color": "color",
    "build_material": "material",
    "model_number": "model",
    "guarantee_period": "warranty_months"
  }
}
```

### API Request

```bash
curl -X POST http://localhost:3000/api/b2b/pim/import/api \
  -H "Content-Type: application/json" \
  -d '{
    "source_id": "api-supplier-with-mapping",
    "products": [
      {
        "product_code": "SUPP-001",
        "product_title": "Professional Wireless Mouse",
        "long_description": "Ergonomic wireless mouse",
        "retail_price": 34.99,
        "promo_price": 29.99,
        "product_category": "Electronics",
        "manufacturer": "TechBrand",
        "quantity_available": 250,
        "item_weight": 0.18,
        "product_color": "Silver",
        "build_material": "Aluminum",
        "model_number": "WM-PRO-2024",
        "guarantee_period": 12,
        "custom_field_1": "Express Shipping Available",
        "supplier_notes": "Popular item"
      }
    ]
  }'
```

### Stored in PIM

```json
{
  "entity_code": "SUPP-001",
  "sku": "SUPP-001",
  "name": "Professional Wireless Mouse",
  "description": "Ergonomic wireless mouse",
  "price": 34.99,
  "sale_price": 29.99,
  "category": "Electronics",
  "brand": "TechBrand",
  "stock": 250,
  "weight": 0.18,
  "color": "Silver",
  "material": "Aluminum",
  "model": "WM-PRO-2024",
  "warranty_months": 12,
  "custom_field_1": "Express Shipping Available",
  "supplier_notes": "Popular item"
}
```

## Benefits

1. **Flexibility**: Use your supplier's existing field names
2. **Standardization**: Data is automatically mapped to PIM standard
3. **Extra Fields**: Custom fields are preserved
4. **No Data Loss**: All fields are kept, even if not mapped
5. **Easy Integration**: Suppliers don't need to change their APIs

## Setup

### 1. Create Source with Mappings

```bash
node scripts/create-api-import-source-with-mappings.cjs
```

### 2. Test Import

```bash
# With field mappings
curl -X POST http://localhost:3000/api/b2b/pim/import/api \
  -H "Content-Type: application/json" \
  -d @test-data/api-import-with-mapping-example.json

# Without field mappings (1:1 mapping)
curl -X POST http://localhost:3000/api/b2b/pim/import/api \
  -H "Content-Type: application/json" \
  -d @test-data/api-import-example.json
```

### 3. View Results

Go to: `http://localhost:3000/b2b/pim/jobs`

## Field Mapping Rules

1. **Mapped fields**: Transformed from supplier field → PIM field
2. **Unmapped fields**: Kept with original name
3. **Missing fields**: Ignored (won't cause errors)
4. **Duplicate mappings**: Last mapping wins
5. **Required fields**: Validated after mapping

## Managing Field Mappings

### Via UI

1. Go to: `/b2b/pim/sources`
2. Click on a source
3. Edit "Field Mappings" section
4. Save changes

### Via API

```bash
curl -X PATCH http://localhost:3000/api/b2b/pim/sources/api-supplier-1 \
  -H "Content-Type: application/json" \
  -d '{
    "field_mappings": {
      "product_code": "entity_code",
      "product_title": "name"
    }
  }'
```

### Via Database

```javascript
db.import_sources.updateOne(
  { source_id: "api-supplier-1" },
  {
    $set: {
      field_mappings: {
        "product_code": "entity_code",
        "product_title": "name",
        "retail_price": "price"
      }
    }
  }
);
```
