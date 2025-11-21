# PIM Structure Standard

## Design Principles

**This is our FOUNDATION. We will be PERSISTENT with this structure.**

1. **Clear Separation** - PIM metadata vs Product data
2. **Reusability** - Types can be imported and used anywhere
3. **Simplicity** - Easy to understand, no complex nesting
4. **Standard Naming** - Consistent conventions across all files
5. **Type Safety** - Full TypeScript support

---

## File Structure

```
src/lib/
├── types/
│   └── pim.ts              # All reusable PIM types
├── db/models/
│   ├── pim-product.ts      # Product model (3 sections)
│   ├── import-source.ts    # Import source config
│   └── import-job.ts       # Import job tracking
├── pim/
│   ├── scorer.ts           # Quality scoring
│   ├── auto-publish.ts     # Auto-publish logic
│   └── parser.ts           # File parsing
└── queue/
    └── import-worker.ts    # Background import jobs
```

---

## PIM Product Model Structure

### The 3 Sections (NEVER CHANGE)

```typescript
// SECTION 1: PIM METADATA
// - Versioning, quality, analytics
// - Everything related to managing the product

// SECTION 2: PRODUCT CORE DATA
// - The actual product information
// - Matches Product interface from customer_web

// SECTION 3: TIMESTAMPS
// - created_at, updated_at
```

---

## Type Definitions

### Location
**All types live in:** `src/lib/types/pim.ts`

### Core Shared Types (matching customer_web)

```typescript
export type Attachment = {
  id: string;
  thumbnail: string;
  original: string;
};

export type Brand = {
  id: string;
  name: string;
  slug: string;
  image?: Attachment;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  details?: string;
  image?: Attachment;
  icon?: string;
};

export type Tag = {
  id: string;
  name: string;
  slug: string;
};
```

### Product Data (composable)

```typescript
// Basic info
export type ProductCore = {
  sku: string;
  name: string;
  slug: string;
  description?: string;
};

// Pricing
export type ProductPricing = {
  price: number;
  sale_price?: number;
  min_price?: number;
  max_price?: number;
  currency: string;
};

// Inventory
export type ProductInventory = {
  quantity: number;
  sold: number;
  unit: string;
  stock_status?: StockStatus;
};

// Images
export type ProductImages = {
  image: Attachment;
  gallery?: Attachment[];
};
```

---

## Naming Conventions

### Fields

| Type | Convention | Example |
|------|------------|---------|
| IDs | `{noun}_id` | `wholesaler_id`, `source_id` |
| Codes | `{noun}_code` | `entity_code`, `sku` |
| Names | `name`, `{noun}_name` | `name`, `source_name` |
| Status | `status`, `{noun}_status` | `status`, `stock_status` |
| Booleans | `is{State}`, `{verb}ed` | `isCurrent`, `manually_edited` |
| Dates | `{noun}_at` | `created_at`, `published_at` |
| Arrays | plural noun | `features`, `critical_issues` |
| Scores | `{noun}_score` | `completeness_score`, `priority_score` |

### Types

| Convention | Example |
|------------|---------|
| Interface (Mongoose) | `I{Name}` | `IPIMProduct` |
| Type (reusable) | `{Name}` | `ProductData`, `Brand` |
| Enum values | `lowercase_snake` | `"in_stock"`, `"out_of_stock"` |

---

## Data Model Standard

### Identity Fields (always required)
```typescript
wholesaler_id: string;   // Who owns this product
entity_code: string;      // Unique product ID (from ERP)
sku: string;              // Stock keeping unit
```

### Versioning Fields (always required)
```typescript
version: number;              // 1, 2, 3...
isCurrent: boolean;           // Latest version?
isCurrentPublished: boolean;  // Is this published?
```

### Status Fields (always required)
```typescript
status: "draft" | "published" | "archived";
published_at?: Date;
```

### Quality Fields (always included)
```typescript
completeness_score: number;  // 0-100
critical_issues: string[];   // Array of issue descriptions
```

### Source Fields (always included)
```typescript
source: {
  source_id: string;
  source_name: string;
  imported_at: Date;
};
```

---

## Product Data Standard

### Required Fields
```typescript
// Identity
sku: string;
name: string;

// Pricing
price: number;
currency: string;

// Images
image: Attachment;  // Primary image

// Inventory
quantity: number;
sold: number;
unit: string;
```

### Optional Fields (extend as needed)
```typescript
// Classification
brand?: Brand;
category?: Category;
tag?: Tag[];

// Content
description?: string;
short_description?: string;
long_description?: string;
features?: ProductFeature[];
docs?: ProductDocument[];

// Variations
id_parent?: string;
parent_sku?: string;
variations?: string[];

// Images
gallery?: Attachment[];

// Pricing
sale_price?: number;
min_price?: number;
max_price?: number;

// SEO
slug?: string;
meta_title?: string;
meta_description?: string;
```

---

## Import & Export

### Importing Types

```typescript
// Import specific types
import { Brand, Category, ProductCore } from "@/lib/types/pim";

// Import model
import { PIMProductModel, IPIMProduct } from "@/lib/db/models/pim-product";
```

### Using Types in Components

```typescript
import { PIMProductListItem, PIMDashboardStats } from "@/lib/types/pim";

function ProductList() {
  const [products, setProducts] = useState<PIMProductListItem[]>([]);
  // ...
}
```

### Using Types in API Routes

```typescript
import { PIMDashboardStats } from "@/lib/types/pim";

export async function GET() {
  const stats: PIMDashboardStats = {
    total_products: 100,
    // ...
  };
  return NextResponse.json(stats);
}
```

---

## Extending the Structure

### When to Add Fields

**✅ Add to Product Core Data when:**
- Field is part of the actual product (price, name, images, etc.)
- Field needs to be exported to customer_web
- Field is visible to end users

**✅ Add to PIM Metadata when:**
- Field is for internal management (scores, analytics, etc.)
- Field controls PIM behavior (auto-publish, locking, etc.)
- Field tracks workflow (versioning, editing, etc.)

**❌ Don't add when:**
- It can be calculated from existing fields
- It's temporary/transient data
- It's specific to one use case only

### How to Add Fields

1. **Add to type definition** (`src/lib/types/pim.ts`)
2. **Add to interface** (`IPIMProduct` in model)
3. **Add to schema** (Mongoose schema definition)
4. **Update scorer** (if affects quality)
5. **Update docs** (this file)

### Example: Adding a new field

```typescript
// 1. Add to type (src/lib/types/pim.ts)
export type ProductCore = {
  sku: string;
  name: string;
  slug: string;
  description?: string;
  barcode?: string;  // NEW FIELD
};

// 2. Add to interface (pim-product.ts)
export interface IPIMProduct extends Document {
  // ... other fields
  barcode?: string;
}

// 3. Add to schema (pim-product.ts)
const PIMProductSchema = new Schema<IPIMProduct>({
  // ... other fields
  barcode: { type: String },
});

// 4. Update scorer if needed (scorer.ts)
// If barcode is required for quality...

// 5. Document it here
```

---

## Quality Scoring Standard

### Score Weights (Total: 100)

| Field | Points | Level |
|-------|--------|-------|
| Product name | 15 | Critical |
| Primary image | 15 | Critical |
| Price | 15 | Critical |
| Features | 15 | Important |
| Description | 10 | Important |
| Brand | 10 | Important |
| Category | 10 | Important |
| Gallery | 5 | Nice to have |
| Packaging | 5 | Nice to have |

### Critical Issues

Products with these missing will show warnings:
- Product name < 10 characters
- No primary image
- Price = 0 or missing
- No brand
- No category
- Description < 50 characters

---

## Auto-Publish Standard

### Rules (ALL must be true)

1. **Auto-publish enabled** for the import source
2. **No locked fields** (manual edits are protected)
3. **Score >= threshold** (default: 80)
4. **All required fields present**

### Default Required Fields

```typescript
const DEFAULT_REQUIRED = [
  "name",
  "image",
  "price",
  "sku",
];
```

---

## Indexes (for performance)

```typescript
// Single field indexes
wholesaler_id: 1
entity_code: 1
sku: 1
status: 1
completeness_score: -1 (descending)
analytics.priority_score: -1 (descending)

// Compound indexes
{ entity_code: 1, version: 1 }
{ entity_code: 1, isCurrent: 1 }
{ wholesaler_id: 1, status: 1, completeness_score: -1 }
{ wholesaler_id: 1, "analytics.priority_score": -1 }
{ "source.source_id": 1, status: 1 }
```

---

## API Response Standards

### List Response

```typescript
{
  products: PIMProductListItem[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    pages: number
  }
}
```

### Error Response

```typescript
{
  error: string,
  details?: string,
  code?: string
}
```

### Stats Response

```typescript
{
  total_products: number,
  published_count: number,
  draft_count: number,
  critical_issues_count: number,
  avg_completeness_score: number,
  auto_published_today: number,
  pending_imports: number
}
```

---

## Migration Standard

When changing the schema:

1. **Update SCHEMA_UPDATE doc** with details
2. **Write migration script** if data exists
3. **Test with sample data**
4. **Update all affected files**
5. **Run compilation check**
6. **Update this STRUCTURE_STANDARD doc**

---

## Summary

**Remember:**
- 3 sections: PIM Metadata, Product Core Data, Timestamps
- All types in `src/lib/types/pim.ts`
- Clear naming conventions
- Extend thoughtfully
- Document changes

**This structure is our FOUNDATION. Stay persistent with it!**
