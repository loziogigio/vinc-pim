# B2B Product Import - Complete Guide

## Overview

Successfully imported **16,113 products** from MongoDB BSON dump into the B2B system with full transformation to match the required interface.

## Import Process Summary

### 1. Source Data
- **Location**: `/home/jire87/Documents/crowdechain-mongo/hdr-api-it/`
- **Files**:
  - `products.bson.gz` (100MB compressed, 101MB uncompressed)
  - `products.metadata.json.gz`
- **Total Products**: 16,113

### 2. MongoDB Collections

#### Original Collection: `products`
Raw product data from ERP/PIM system with Italian structure:

```javascript
{
  _id: ObjectId,
  entity_code: "F10000",
  sku: "F10000",
  title: "Product title in Italian",
  description: "Short description",
  price: 0,
  status: "",
  status_description: "",
  media: [{                      // Product images
    media_id: 2956,
    filename: "product-image.jpg",
    path: "/product_images/F10000",
    media_area_id: "images"
  }],
  brand: {                       // Brand information
    cprec_darti: "BUG",
    tprec_darti: "BUGATTI"
  },
  brand_media: [{                // Brand images
    filename: "BUG.jpg",
    path: "/brands"
  }],
  family_type: {                 // Category level 1
    ctipo_dtpar: "10",
    ttipo_dtpar: "VALVOLAME E RACCORDERIA"
  },
  family_subtype: {              // Category level 2
    ctipo_darti: "1001",
    ttipo_darti: "VALVOLE, ELETTROVALVOLE..."
  },
  technical_features: {},        // Technical specifications
  docs: [],                      // Product documents (PDF, etc.)
  data: [{                       // Additional properties
    property_id: "short_description",
    value: "..."
  }]
}
```

#### Transformed Collection: `products_b2b`
Formatted to match the `RawProduct` interface used by the B2B frontend:

```typescript
{
  id: "685eb031ec617d9b98962253",
  entity_code: "F10000",
  sku: "F10000",
  id_parent: null,
  parent_sku: null,
  product_status: "",
  product_status_description: "",
  title: "Product title",
  short_description: "...",
  long_description: "...",
  unit: "",
  price: 0,
  sale_price: null,
  quantity: 0,
  sold: 0,
  model: "",
  features: [                    // Transformed from technical_features
    { label: "Feature", value: "Value" }
  ],
  docs: [                        // Product documents
    {
      media_area_id: "documents",
      url: "/path/to/doc.pdf"
    }
  ],
  images: [                      // Transformed from media
    {
      original: "/product_images/F10000/image.jpg",
      main: "/product_images/F10000/image.jpg",
      gallery: "/product_images/F10000/image.jpg",
      thumb: "/product_images/F10000/image.jpg"
    }
  ],
  brand: {                       // Brand info
    cprec_darti: "BUG",
    tprec_darti: "BUGATTI"
  },
  brand_image: [{                // Brand images
    original: "/brands/BUG.jpg",
    main: "/brands/BUG.jpg"
  }],
  category: {                    // Unified category
    id: "1001",
    name: "VALVOLE, ELETTROVALVOLE...",
    code: "1001"
  },
  tag: [],
  children_items: [],            // Product variations
  _source: {                     // Original metadata
    weight: { value: null, um: "0" },
    volume: { value: null, um: "0" },
    family_type: { ... },
    family_subtype: { ... },
    created_date: "2025-06-27T16:52:33.261Z",
    last_updated: "2025-07-10T07:05:16.702Z"
  }
}
```

### 3. Database Indexes

Created on `products_b2b` collection for optimal query performance:

```javascript
// Unique identifier
{ sku: 1 } (unique: true)

// Search fields
{ entity_code: 1 }
{ 'brand.cprec_darti': 1 }
{ 'category.code': 1 }

// Full-text search
{ title: 'text', short_description: 'text' }
```

## Product Statistics

Based on the imported data:

- **Total Products**: 16,113
- **Products with Images**: ~45% (estimated)
- **Products with Brand**: ~80% (estimated)
- **Products with Technical Features**: ~60% (estimated)
- **Products with Documents**: ~15% (estimated)
- **Products with Price > 0**: TBD (most are 0 in this dataset)

## API Implementation

### Search Endpoint

**URL**: `POST /api/b2b/search`

**Request Body**:
```json
{
  "text": "valvola",
  "filters": {
    "brand": ["BUG", "GRU"],
    "category": ["1001"],
    "min_price": 0,
    "max_price": 1000
  },
  "start": 0,
  "rows": 12,
  "sort": "relevance"
}
```

**Response**:
```json
{
  "results": [
    {
      "id": "...",
      "sku": "F10000",
      "title": "...",
      "price": 0,
      "images": [...],
      "brand": {...}
    }
  ],
  "numFound": 1523,
  "start": 0,
  "rows": 12
}
```

### Sort Options

- `relevance` - Text search relevance (default)
- `price_asc` - Price low to high
- `price_desc` - Price high to low
- `name_asc` - Name A-Z
- `name_desc` - Name Z-A

### Filter Fields

- `brand` - Array of brand codes (e.g., `["BUG", "GRU"]`)
- `category` - Array of category codes (e.g., `["1001"]`)
- `codice_figura` - Parent SKU filter (maps to `parent_sku`)
- `carti` - SKU filter (maps to `sku`)
- `min_price` / `max_price` - Price range

## Scripts

### 1. Import from BSON

**Location**: `scripts/import-products-from-bson.cjs`

```bash
cd /home/jire87/software/www-website/www-data/vendereincloud-app/vinc-apps/vinc-storefront
node scripts/import-products-from-bson.cjs
```

**What it does**:
- Reads `/tmp/products.bson`
- Parses BSON documents
- Imports into `products` collection
- Handles duplicates gracefully

### 2. Transform to B2B Format

**Location**: `scripts/transform-products-to-b2b.cjs`

```bash
node scripts/transform-products-to-b2b.cjs
```

**What it does**:
- Reads from `products` collection
- Transforms to `RawProduct` interface
- Creates `products_b2b` collection
- Creates search indexes

## Usage in Frontend

### Customer Web (Hidros)

The customer_web project already has the B2B product interface defined:

**Interface**: `src/framework/basic-rest/types.ts`
```typescript
export type Product = {
  id: number | string;
  sku: string;
  name: string;
  price: number;
  image: Attachment;
  gallery?: Attachment[];
  brand?: Brand;
  features?: any[];
  docs?: Array<{...}>;
  variations: Product[];
}
```

**Transform Function**: `src/utils/transform/b2b-product.ts`
```typescript
export function transformProduct(rawProducts: RawProduct[]): Product[]
```

**Usage**:
```typescript
import { fetchProductList } from '@framework/product/get-b2b-product';

const { items, total } = await fetchProductList({
  text: 'valvola',
  filters: { brand: ['BUG'] },
  per_page: 12
}, 0);
```

### Vinc-Storefront (B2B Portal)

**API Config**: `src/lib/config/b2b-api.ts`
```typescript
import { B2B_API_ENDPOINTS } from '@/lib/config/b2b-api';

fetch(B2B_API_ENDPOINTS.SEARCH, {
  method: 'POST',
  body: JSON.stringify({ text: 'valvola' })
});
```

## Data Quality Notes

### Missing/Incomplete Data

1. **Prices**: Most products have `price: 0`
   - May need price update from ERP
   - Could use separate price list import

2. **Images**: ~45% of products have images
   - Missing images should use placeholder
   - Image paths need CDN mapping

3. **Descriptions**: Many use title as description
   - Could benefit from AI enhancement
   - Short vs long description overlap

4. **Technical Features**: Structure varies
   - Some are objects, some arrays
   - Normalization needed for display

### Recommendations

1. **Price Sync**: Set up scheduled job to sync prices from ERP
2. **Image Processing**:
   - Upload missing images
   - Generate thumbnails
   - Implement CDN (Cloudflare/Cloudinary)
3. **Content Enhancement**:
   - AI-generated descriptions for products without them
   - Translate technical features
   - SEO optimization
4. **Category Mapping**:
   - Create user-friendly category tree
   - Map Italian names to English
   - Add category images

## Next Steps

### Immediate (Week 1)

1. ✅ Import products from BSON
2. ✅ Transform to B2B format
3. ✅ Create search API endpoint
4. ✅ Create B2B user account
5. ⏳ Test search functionality in B2B portal
6. ⏳ Verify image paths and CDN setup

### Short Term (Week 2-4)

1. Price sync from ERP
2. Image upload and CDN integration
3. Category tree management UI
4. Product detail API endpoint
5. Bulk operations (import/export)
6. Analytics tracking

### Medium Term (Month 2-3)

1. AI content enhancement
2. Multi-language support
3. Advanced filtering (facets)
4. Product comparison
5. Related products
6. Customer-specific pricing

## Troubleshooting

### Search returns no results

```bash
# Check if products exist
node -e "
const mongoose = require('mongoose');
mongoose.connect('mongodb://root:root@localhost:27017/hdr-api-it?authSource=admin')
  .then(async () => {
    const db = mongoose.connection.db;
    const count = await db.collection('products_b2b').countDocuments();
    console.log('Products:', count);
    const sample = await db.collection('products_b2b').findOne({});
    console.log('Sample:', sample.sku, sample.title.substring(0, 50));
    mongoose.disconnect();
  });
"
```

### Text search not working

Ensure text index exists:
```bash
node -e "
const mongoose = require('mongoose');
mongoose.connect('mongodb://root:root@localhost:27017/hdr-api-it?authSource=admin')
  .then(async () => {
    const db = mongoose.connection.db;
    const indexes = await db.collection('products_b2b').indexes();
    console.log(JSON.stringify(indexes, null, 2));
    mongoose.disconnect();
  });
"
```

### Re-import products

To re-import from scratch:
```bash
# Drop collections
node -e "
const mongoose = require('mongoose');
mongoose.connect('mongodb://root:root@localhost:27017/hdr-api-it?authSource=admin')
  .then(async () => {
    const db = mongoose.connection.db;
    await db.collection('products').drop();
    await db.collection('products_b2b').drop();
    console.log('Collections dropped');
    mongoose.disconnect();
  });
"

# Re-run import scripts
node scripts/import-products-from-bson.cjs
node scripts/transform-products-to-b2b.cjs
```

## Database Connection

**Environment Variables** (`.env`):
```env
VINC_MONGO_URL=mongodb://root:root@localhost:27017/?authSource=admin
VINC_MONGO_DB=hdr-api-it
```

**Connection String**: `mongodb://root:root@localhost:27017/hdr-api-it?authSource=admin`

## Related Documentation

- [PIM Implementation Plan](./PIM_IMPLEMENTATION_PLAN.md) - Future PIM system design
- [B2B Module Setup](../vinc-apps/vinc-storefront/docs/B2B_MODULE_SETUP.md) - B2B portal setup
- [Product Types](../hidros-app/customer_web/src/framework/basic-rest/types.ts) - TypeScript interfaces

## Contact

For questions or issues with the product import:
- Check MongoDB logs: `docker logs vinc-mongo`
- Review API logs in browser console
- Check server logs: `pnpm dev` output
