# Product Variants and Faceting Control

This document explains how product variants and Solr faceting are handled in the PIM system.

## Overview

The PIM system supports product variants (parent-child relationships) and controls which products appear in Solr faceting/filtering through two key fields:

- `is_parent`: Indicates if a product is a parent product
- `include_faceting`: Controls whether the product should be included in Solr faceting

## Field Definitions

### `is_parent` (boolean)

Indicates whether this product is a parent product or a child variant.

**Values:**
- `true`: Product is a parent (either standalone or with variants)
- `false`: Product is a child variant of another product

**Default:** `true`

### `include_faceting` (boolean)

Controls whether this product should be included in Solr faceting and filtering operations.

**Values:**
- `true`: Include in faceting (show in filters, search results)
- `false`: Exclude from faceting (grouping only)

**Default:** `true`

## Logic Rules

The system handles 4 product types:

1. **Standalone**: `is_parent=true`, `include_faceting=true`
2. **Grouping (2+ children)**: `is_parent=true`, `include_faceting=false`
3. **Variant child**: `is_parent=false`, `include_faceting=true`
4. **Orphaned child**: `is_parent=true`, `include_faceting=true` (promoted to standalone)

### 1. Single Products (Standalone)

Products that exist independently without any parent-child relationships.

**Characteristics:**
- No `parent_sku` or `parent_entity_code`
- No `variations_sku` or `variations_entity_code`

**Field Values:**
- `is_parent = true`
- `include_faceting = true`

**Example:**
```json
{
  "entity_code": "DRILL-001",
  "sku": "DRILL-001",
  "name": { "it": "Trapano Professionale", "en": "Professional Drill" },
  "is_parent": true,
  "include_faceting": true
}
```

### 2. Parent Products with Variants (Grouping Products)

Products that have multiple variants (e.g., different colors, sizes).

**Characteristics:**
- Has `variations_sku` or `variations_entity_code` with at least one item
- No `parent_sku` or `parent_entity_code`

**Field Values:**
- `is_parent = true`
- `include_faceting = false`

**Why exclude from faceting?**
Parent products serve as grouping containers and don't represent actual purchasable items. The variants are the actual products that should appear in facets and filters.

**Example:**
```json
{
  "entity_code": "TSHIRT-BASE",
  "sku": "TSHIRT-BASE",
  "name": { "it": "Maglietta Base", "en": "Base T-Shirt" },
  "variations_sku": ["TSHIRT-RED-S", "TSHIRT-RED-M", "TSHIRT-BLUE-S", "TSHIRT-BLUE-M"],
  "variations_entity_code": ["TSHIRT-RED-S", "TSHIRT-RED-M", "TSHIRT-BLUE-S", "TSHIRT-BLUE-M"],
  "is_parent": true,
  "include_faceting": false
}
```

### 3. Variant Products (Children)

Individual variants of a parent product.

**Characteristics:**
- Has `parent_sku` or `parent_entity_code`
- No `variations_sku` or `variations_entity_code`

**Field Values:**
- `is_parent = false`
- `include_faceting = true`

**Why include in faceting?**
Variants are the actual purchasable products that should appear in search results and facets.

**Example:**
```json
{
  "entity_code": "TSHIRT-RED-M",
  "sku": "TSHIRT-RED-M",
  "name": { "it": "Maglietta Rossa M", "en": "Red T-Shirt M" },
  "parent_sku": "TSHIRT-BASE",
  "parent_entity_code": "TSHIRT-BASE",
  "is_parent": false,
  "include_faceting": true,
  "attributes": {
    "it": [
      { "key": "color", "label": "Colore", "value": "Rosso" },
      { "key": "size", "label": "Taglia", "value": "M" }
    ]
  }
}
```

### 4. Orphaned Child Products

Child variants whose parent product doesn't exist or no longer references them. These are automatically promoted to standalone products.

**Characteristics:**
- Has `parent_sku` or `parent_entity_code` BUT
- Parent product doesn't exist in the database, OR
- Parent's `variations_sku`/`variations_entity_code` doesn't include this product

**Field Values:**
- `is_parent = true` (promoted to standalone)
- `include_faceting = true`

**Why promote orphaned children?**
If a parent product is deleted or the relationship is broken, child products shouldn't become invisible in search. They're promoted to standalone products to ensure they remain discoverable.

**Example:**
```json
{
  "entity_code": "TSHIRT-GREEN-L",
  "sku": "TSHIRT-GREEN-L",
  "name": { "it": "Maglietta Verde L", "en": "Green T-Shirt L" },
  "parent_sku": "TSHIRT-BASE",  // Parent no longer exists
  "parent_entity_code": "TSHIRT-BASE",
  "is_parent": true,  // Promoted to standalone
  "include_faceting": true
}
```

**Recommendation:** Run periodic cleanup to either:
- Remove `parent_sku`/`parent_entity_code` from orphaned products, OR
- Re-link them to the correct parent, OR
- Delete them if they're no longer needed

## Implementation

### MongoDB Schema

Fields are defined in `src/lib/db/models/pim-product.ts`:

```typescript
interface IPIMProduct {
  // ... other fields ...

  // Variations & Faceting Control
  parent_sku?: string;
  parent_entity_code?: string;
  variations_sku?: string[];
  variations_entity_code?: string[];
  is_parent?: boolean;  // Default: true
  include_faceting?: boolean;  // Default: true
}
```

### Batch Import

During batch import (`src/lib/queue/import-worker.ts`), these fields are calculated automatically:

```typescript
// Calculate variant and faceting flags
const hasVariants = (productData.variations_sku && productData.variations_sku.length > 0) ||
                   (productData.variations_entity_code && productData.variations_entity_code.length > 0);
const isChild = !!productData.parent_sku || !!productData.parent_entity_code;

// Set is_parent (default true unless explicitly a child)
const is_parent = productData.is_parent ?? !isChild;

// Set include_faceting based on variant structure
const include_faceting = productData.include_faceting ?? (hasVariants ? false : true);
```

### Solr Adapter

The Solr adapter (`src/lib/adapters/solr-adapter.ts`) includes these fields when indexing:

```typescript
const doc: SolrMultilingualDocument = {
  // ... other fields ...

  // Use product's explicit values, or calculate based on variant structure
  is_parent: product.is_parent ?? (!product.parent_sku && !product.parent_entity_code),
  parent_sku: product.parent_sku,
  parent_entity_code: product.parent_entity_code,
  include_faceting: product.include_faceting ?? this.calculateIncludeFaceting(product),
};
```

## Frontend Usage

### Solr Queries

When querying Solr for search results or faceting:

```javascript
// Only include products that should be in facets
const query = {
  q: '*:*',
  fq: 'include_faceting:true',  // Filter to only facetable products
  facet: 'true',
  'facet.field': ['brand_id', 'category_id', 'price']
};
```

### Product Display

When displaying product listings:

```typescript
// Show variants grouped under parent
if (product.is_parent && product.variations_sku?.length > 0) {
  // This is a parent with variants - show variant picker
  fetchVariants(product.variations_entity_code);
} else if (!product.is_parent) {
  // This is a variant - show link to parent/siblings
  fetchParent(product.parent_entity_code);
} else {
  // This is a single product - show normally
  displayProduct(product);
}
```

## Migration Guide

For existing products in the database:

```javascript
// Script to calculate and update fields for existing products
db.pimproducts.find({ isCurrent: true }).forEach(function(product) {
  const hasVariants = (product.variations_sku && product.variations_sku.length > 0) ||
                     (product.variations_entity_code && product.variations_entity_code.length > 0);
  const isChild = !!product.parent_sku || !!product.parent_entity_code;

  db.pimproducts.updateOne(
    { _id: product._id },
    {
      $set: {
        is_parent: !isChild,
        include_faceting: hasVariants ? false : true
      }
    }
  );
});
```

## Testing

### Test Cases

1. **Single Product**
   ```json
   Input: { "sku": "TEST-001" }
   Expected: { "is_parent": true, "include_faceting": true }
   ```

2. **Parent with Variants**
   ```json
   Input: {
     "sku": "TEST-PARENT",
     "variations_sku": ["TEST-VAR-1", "TEST-VAR-2"]
   }
   Expected: { "is_parent": true, "include_faceting": false }
   ```

3. **Child Variant**
   ```json
   Input: {
     "sku": "TEST-VAR-1",
     "parent_sku": "TEST-PARENT"
   }
   Expected: { "is_parent": false, "include_faceting": true }
   ```

### Verification

After import, verify in MongoDB:

```javascript
// Count products by type
db.pimproducts.aggregate([
  { $match: { isCurrent: true } },
  {
    $group: {
      _id: {
        is_parent: "$is_parent",
        include_faceting: "$include_faceting"
      },
      count: { $sum: 1 }
    }
  }
]);
```

## Best Practices

1. **Always set variant relationships**: When creating variants, always set `parent_sku`/`parent_entity_code` on children and `variations_sku`/`variations_entity_code` on parents.

2. **Let the system calculate**: Don't manually set `is_parent` and `include_faceting` unless you have a specific reason. The system will calculate them correctly based on the variant structure.

3. **Consistent SKU patterns**: Use consistent SKU naming patterns for variants (e.g., `BASE-SKU-COLOR-SIZE`).

4. **Test faceting**: After importing variants, test Solr queries to ensure faceting works correctly.

## Orphaned Children Detection & Cleanup

### Detection Script

Identify orphaned child products:

```javascript
// Find products that reference a parent that doesn't exist
const orphanedChildren = await db.pimproducts.aggregate([
  {
    $match: {
      isCurrent: true,
      $or: [
        { parent_sku: { $exists: true, $ne: null } },
        { parent_entity_code: { $exists: true, $ne: null } }
      ]
    }
  },
  {
    $lookup: {
      from: "pimproducts",
      let: {
        parentSku: "$parent_sku",
        parentEntityCode: "$parent_entity_code",
        currentSku: "$sku"
      },
      pipeline: [
        {
          $match: {
            isCurrent: true,
            $expr: {
              $and: [
                {
                  $or: [
                    { $eq: ["$sku", "$$parentSku"] },
                    { $eq: ["$entity_code", "$$parentEntityCode"] }
                  ]
                },
                {
                  $or: [
                    { $in: ["$$currentSku", "$variations_sku"] },
                    { $in: ["$$currentSku", "$variations_entity_code"] }
                  ]
                }
              ]
            }
          }
        }
      ],
      as: "parent"
    }
  },
  {
    $match: {
      parent: { $size: 0 }  // No matching parent found
    }
  },
  {
    $project: {
      entity_code: 1,
      sku: 1,
      name: 1,
      parent_sku: 1,
      parent_entity_code: 1,
      is_parent: 1,
      include_faceting: 1
    }
  }
]);
```

### Cleanup Options

**Option 1: Promote to Standalone (Recommended)**

Remove parent references and ensure correct flags:

```javascript
// Promote orphaned children to standalone products
orphanedChildren.forEach(function(product) {
  db.pimproducts.updateOne(
    { _id: product._id },
    {
      $unset: {
        parent_sku: "",
        parent_entity_code: ""
      },
      $set: {
        is_parent: true,
        include_faceting: true
      }
    }
  );
});
```

**Option 2: Delete Orphaned Products**

If the variants should be removed:

```javascript
// Delete orphaned children
const orphanedIds = orphanedChildren.map(p => p._id);
db.pimproducts.deleteMany({ _id: { $in: orphanedIds } });
```

**Option 3: Re-link to Correct Parent**

If you know the correct parent:

```javascript
// Re-link to correct parent
db.pimproducts.updateOne(
  { entity_code: "ORPHANED-CHILD-SKU" },
  {
    $set: {
      parent_sku: "CORRECT-PARENT-SKU",
      parent_entity_code: "CORRECT-PARENT-CODE",
      is_parent: false,
      include_faceting: true
    }
  }
);

// Add to parent's variations
db.pimproducts.updateOne(
  { sku: "CORRECT-PARENT-SKU", isCurrent: true },
  {
    $addToSet: {
      variations_sku: "ORPHANED-CHILD-SKU",
      variations_entity_code: "ORPHANED-CHILD-SKU"
    },
    $set: {
      is_parent: true,
      include_faceting: false
    }
  }
);
```

## Troubleshooting

### Products not appearing in search

**Problem**: Variant products don't show in search results

**Solution**: Check that `include_faceting = true` for the variants. Parent products with `include_faceting = false` won't appear in faceted search.

### Parent product showing in filters

**Problem**: Parent product appears in color/size filters

**Solution**: Verify that `include_faceting = false` for the parent. Only variants should have `include_faceting = true`.

### Orphaned variants appearing incorrectly

**Problem**: Child variants exist but parent is missing, and they're showing as `is_parent = false`

**Solution**: Run the orphaned children detection script above and choose one of the cleanup options:
1. Promote to standalone (remove parent references)
2. Delete if no longer needed
3. Re-link to correct parent
