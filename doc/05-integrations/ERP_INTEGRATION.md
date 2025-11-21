# Hidros Import Plan - Product Import to PIM

**Date:** November 6, 2025
**Source:** Hidros MySQL Database (port 33088)
**Target:** MongoDB PIM System
**Estimated Products:** ~16,000

---

## Database Connection Details

### Hidros MySQL
```javascript
{
  host: '161.156.172.254',
  port: 33088,
  user: 'readonly_user',
  password: 'SecurePassword123!',
  databases: {
    main: 'mymb_hidros',        // Products, brands, prices, inventory
    supervisor: 'supervisor_hidros'  // Features, categories, custom properties
  }
}
```

### Target MongoDB
```javascript
{
  connection: 'mongodb://root:root@localhost:27017/?authSource=admin',
  database: 'hdr-api-it',
  collection: 'products_pim'  // New collection for PIM products
}
```

---

## Key Tables and Relationships

### Core Product Tables (mymb_hidros)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `myartmag` | Main products table | `oarti` (ID), `carti` (SKU), `tarti` (name), `oarti_xvari_r` (parent) |
| `myprecod` | Brands | `cprec_darti` (code), `tprec_darti` (name) |
| `mytparti` | Product subtypes | `ctipo_darti` (code), `ttipo_darti` (name), `ctipo_dtpar` (parent type) |
| `mytptpar` | Product parent types | `ctipo_dtpar` (code), `ttipo_dtpar` (name) |
| `myarxgru` | Product groups/categories | `oarti`, `cgrup_darti` (group code) |
| `myartcar` | **Technical characteristics** (70+ fields) | `OARTI`, `FRET01-70` (labels), `FREV01-70` (values) |
| `mybarcod` | Barcodes | `oarti`, `cbarx` (barcode) |
| `mylisrig` | Price lists | `oarti`, `aprez_ivalu` (price) |
| `myacxart` | Related products | `oarti`, `oarti_sacce` (related product) |
| `mypromor` | Product promotions | `oarti`, `cprom` (promo code) |
| `mypromot` | Promotion details | `cprom`, `sutil` (start date), `futil` (end date) |

### Supervisor Tables (supervisor_hidros)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `submenu_product` | Product-category associations | `product_code`, `submenu_id` |
| `channel_submenu` | Category hierarchy (3 levels) | `submenu_id`, `submenu_id_ref` (parent), `label` |
| `data` | Custom product properties | `entity_code`, `property_id`, `value`, `channel_id` |
| `product_feature` | Product features | `product_code`, `feature_id`, `stringdata`, `numericdata`, `datedata`, `booleandata` |
| `feature` | Feature definitions | `feature_id`, `label` |

---

## Product Structure

### Parent-Child Relationships
Products can be:
1. **Simple Product**: No parent, no children (`oarti_xvari_r = ''`, `busat_xvari = 'N'`)
2. **Parent Product**: Has children variations (`oarti_xvari_r = ''`, `busat_xvari = 'S'`)
3. **Child Product**: Has parent (`oarti_xvari_r != ''`)

```sql
-- Find parent products with children
SELECT oarti, carti, tarti
FROM myartmag
WHERE busat_xvari = 'S' AND oarti_xvari_r = '';

-- Find children of a parent
SELECT oarti, carti, tarti
FROM myartmag
WHERE oarti_xvari_r = '100071';
```

---

## Field Mapping: Hidros → PIM

### Basic Product Fields

| Hidros Field | PIM Field | Type | Notes |
|--------------|-----------|------|-------|
| `oarti` | `entity_code` | string | Internal product ID |
| `carti` | `sku` | string | Customer-facing SKU |
| `tarti` | `title` | string | Product name/description |
| `oarti_xvari_r` | `parent_sku` | string | Parent product reference |
| `busat_xvari` | `has_variations` | boolean | 'S' = true, 'N' = false |
| `binse_inocl` | `is_sellable` | boolean | 'S' = true |
| `cstat_darti` | `status` | string | N=new, F=future, etc. |
| `dinse_ianag` | `created_at` | date | Insert date |

### Brand Mapping

```sql
-- Query
SELECT p.cprec_darti, b.tprec_darti
FROM myartmag p
LEFT JOIN myprecod b ON b.cprec_darti = p.cprec_darti
WHERE p.oarti = ?
```

**PIM Structure:**
```javascript
{
  brand: {
    brand_id: cprec_darti,  // e.g., "BUG"
    name: tprec_darti       // e.g., "BUGATTI"
  }
}
```

### Product Type/Category Mapping

```sql
-- Query: Get type and subtype
SELECT
  t.ctipo_darti,           -- Subtype code
  t.ttipo_darti,           -- Subtype name
  t.ctipo_dtpar,           -- Type code (parent)
  pt.ttipo_dtpar           -- Type name
FROM myartmag p
INNER JOIN mytparti t ON t.ctipo_darti = p.ctipo_darti
LEFT JOIN mytptpar pt ON pt.ctipo_dtpar = t.ctipo_dtpar
WHERE p.oarti = ?
```

**PIM Structure:**
```javascript
{
  product_type: {
    type_id: ctipo_dtpar,      // e.g., "10"
    type_name: ttipo_dtpar,    // e.g., "VALVOLAME"
    subtype_id: ctipo_darti,   // e.g., "1001"
    subtype_name: ttipo_darti  // e.g., "VALVOLE"
  }
}
```

### Categories/Families (3-level hierarchy)

```sql
-- Query: Get all category levels
SELECT DISTINCT
  s1.submenu_id as level1_id,
  s1.label as level1_name,
  s2.submenu_id as level2_id,
  s2.label as level2_name,
  s3.submenu_id as level3_id,
  s3.label as level3_name
FROM supervisor_hidros.submenu_product sp
INNER JOIN supervisor_hidros.channel_submenu s1 ON s1.submenu_id = sp.submenu_id
LEFT JOIN supervisor_hidros.channel_submenu s2 ON s2.submenu_id = s1.submenu_id_ref
LEFT JOIN supervisor_hidros.channel_submenu s3 ON s3.submenu_id = s2.submenu_id_ref
WHERE sp.product_code = ?
```

**PIM Structure:**
```javascript
{
  categories: [
    { category_id: "lev1", name: "Main Category", level: 1 },
    { category_id: "lev2", name: "Sub Category", level: 2 },
    { category_id: "lev3", name: "Sub-sub Category", level: 3 }
  ]
}
```

### Groups/Tags

```sql
-- Query
SELECT cgrup_darti
FROM myarxgru
WHERE oarti = ? AND bdele = 'S'
```

**PIM Structure:**
```javascript
{
  tags: ["GROUP1", "GROUP2"]
}
```

### Technical Characteristics (from myartcar)

The `myartcar` table stores technical characteristics as **70 feature pairs** (label + value):

```sql
-- Query: Get all technical characteristics for a product
SELECT * FROM myartcar
WHERE OARTI = ? AND CSOCI = '0001'
```

**Table Structure:**
- `FRET01` to `FRET70` - Feature labels (e.g., "Colore", "Materiale Rivestimento")
- `FREV01` to `FREV70` - Feature values (e.g., "GRIGIO", "PVC")
- Additional fields: `FREV71-95` (values only), `FRETB1-5` (boolean features)

**Example Data for CH4:**
| Label (FRET) | Value (FREV) | Description |
|--------------|--------------|-------------|
| codice fornitore | CH400NI | Supplier code |
| Pagina Catalogo | 302 | Catalog page number |
| EAN | 3309030229052 | Barcode |
| Colore | GRIGIO | Color (grey) |
| Materiale Rivestimento | PVC | Coating material |
| Versione | INCOLLAGGIO | Version (glued) |

**Transformation Logic:**
```javascript
// Extract non-empty feature pairs
const characteristics = [];
for (let i = 1; i <= 70; i++) {
  const num = String(i).padStart(2, '0');
  const label = row[`FRET${num}`];
  const value = row[`FREV${num}`];

  if (label && value) {
    characteristics.push({ label, value });
  }
}
```

**PIM Structure:**
```javascript
{
  technical_characteristics: [
    { label: "codice fornitore", value: "CH400NI" },
    { label: "Pagina Catalogo", value: "302" },
    { label: "EAN", value: "3309030229052" },
    { label: "Colore", value: "GRIGIO" },
    { label: "Materiale Rivestimento", value: "PVC" },
    { label: "Versione", value: "INCOLLAGGIO" }
  ]
}
```

### Custom Properties (from supervisor_hidros.data)

```sql
-- Query
SELECT property_id, value, channel_id
FROM supervisor_hidros.data
WHERE entity_id = 'product'
  AND entity_code = ?
  AND channel_id IN ('DEFAULT', 'B2B')
```

**Common Properties:**
- `model` - Product model
- `brand` - Brand name (may differ from brand code)
- `synonymous` - Search synonyms
- `title_frontend` - Frontend display title
- `short_description` - Short description

**PIM Structure:**
```javascript
{
  metadata: {
    model: "XYZ-123",
    synonyms: ["alias1", "alias2"],
    display_title: "Custom Title",
    short_description: "Brief desc"
  }
}
```

### Product Features (from supervisor_hidros.product_feature)

```sql
-- Query
SELECT
  pf.feature_id,
  f.label,
  pf.datedata,
  pf.stringdata,
  pf.numericdata,
  pf.booleandata
FROM supervisor_hidros.product_feature pf
INNER JOIN supervisor_hidros.feature f ON f.feature_id = pf.feature_id
WHERE pf.product_code = ?
```

**PIM Structure:**
```javascript
{
  features: [
    { feature_id: 1, label: "Color", value: "Red", type: "string" },
    { feature_id: 2, label: "Weight", value: 1.5, type: "numeric" },
    { feature_id: 3, label: "Available", value: true, type: "boolean" }
  ]
}
```

### Pricing

```sql
-- Query: Get base price
SELECT aprez_ivalu as price
FROM mylisrig
WHERE csoci = 'CSOCI_VALUE'
  AND ctipo_dlist = 'LIST_TYPE'
  AND clist = 'BASE_LIST'
  AND oarti = ?
  AND sutil <= CURDATE()
  AND futil > CURDATE()
ORDER BY origa_dlist DESC
LIMIT 1
```

**PIM Structure:**
```javascript
{
  pricing: {
    base_price: 123.45,
    currency: "EUR",
    list_type: "BASE"
  }
}
```

### Images

Images are retrieved via a custom helper class `Images::getSingleImageFromFather()`. The logic:
1. Try to get images for the product itself
2. If none, get images from parent product
3. Images are stored in filesystem paths

**PIM Structure:**
```javascript
{
  images: [
    {
      cdn_key: "product_images/F10000/image1.jpg",
      url: "https://cdn.example.com/...",
      position: 0,
      is_primary: true
    }
  ]
}
```

### Barcodes

```sql
-- Query: Get primary barcode
SELECT cbarx
FROM mybarcod
WHERE csoci = 'CSOCI_VALUE'
  AND oarti = ?
ORDER BY daggi DESC, bbarx_sazie ASC
LIMIT 1

-- For parent products, also get children barcodes
SELECT b.cbarx
FROM mybarcod b
INNER JOIN myartmag m ON m.oarti = b.oarti
WHERE m.oarti_xvari_r = ?
```

**PIM Structure:**
```javascript
{
  barcodes: ["8012345678901", "8012345678902"]
}
```

### Promotions

```sql
-- Query
SELECT DISTINCT
  r.cprom,
  t.cfami_dprom,
  t.ctipo_dtpro,
  t.sutil,
  t.futil
FROM mypromor r
INNER JOIN mypromot t ON t.cprom = r.cprom AND t.csoci = r.csoci
WHERE r.csoci = 'CSOCI_VALUE'
  AND r.bdele = 'S'
  AND r.oarti = ?
  AND CURDATE() BETWEEN t.sutil AND t.futil
```

**PIM Structure:**
```javascript
{
  promotions: [
    {
      promo_code: "PROMO2025",
      promo_family: "WINTER",
      promo_type: "DISCOUNT",
      start_date: "2025-01-01",
      end_date: "2025-03-31"
    }
  ]
}
```

### Related Products

```sql
-- Query
SELECT m.oarti, m.carti
FROM myacxart a
INNER JOIN myartmag m ON m.oarti = a.oarti_sacce
WHERE a.oarti = ?
  AND m.binse_inocl = 'S'
```

**PIM Structure:**
```javascript
{
  related_products: ["100072", "100073"]
}
```

---

## Complete PIM Product Schema

```typescript
interface PIMProduct {
  // Basic Info
  entity_code: string;           // oarti (internal ID)
  sku: string;                   // carti (customer SKU)
  title: string;                 // tarti or custom title
  description: string;           // long description
  short_description: string;     // brief description

  // Hierarchy
  parent_sku?: string;           // oarti_xvari_r
  has_variations: boolean;       // busat_xvari = 'S'
  children_skus?: string[];      // List of child product SKUs

  // Status
  is_sellable: boolean;          // binse_inocl = 'S'
  status: string;                // cstat_darti (N=new, F=future)
  is_new: boolean;               // cstat_darti = 'N'
  is_future: boolean;            // cstat_darti = 'F'
  is_popular: boolean;           // barti_srich = 'S'
  is_promo: boolean;             // bprom_steor = 'S'

  // Brand
  brand: {
    brand_id: string;            // cprec_darti
    name: string;                // tprec_darti
  };

  // Product Type/Category
  product_type: {
    type_id: string;             // ctipo_dtpar
    type_name: string;           // ttipo_dtpar
    subtype_id: string;          // ctipo_darti
    subtype_name: string;        // ttipo_darti
  };

  // Categories (3-level hierarchy from supervisor)
  categories: Array<{
    category_id: string;
    name: string;
    level: number;               // 1, 2, or 3
  }>;

  // Groups/Tags
  tags: string[];                // cgrup_darti values

  // Technical Characteristics (from myartcar)
  technical_characteristics: Array<{
    label: string;               // FRET01-70 (e.g., "Colore", "Materiale")
    value: string;               // FREV01-70 (e.g., "GRIGIO", "PVC")
  }>;

  // Custom Metadata
  metadata: {
    model?: string;
    synonyms?: string[];
    display_title?: string;
    short_description?: string;
  };

  // Product Features (from supervisor)
  features: Array<{
    feature_id: number;
    label: string;
    value: string | number | boolean | Date;
    type: 'string' | 'numeric' | 'boolean' | 'date';
  }>;

  // Pricing
  pricing: {
    base_price: number;
    currency: string;
    list_type: string;
  };

  // Media
  images: Array<{
    cdn_key: string;
    url: string;
    position: number;
    is_primary: boolean;
    file_name?: string;
    size?: number;
  }>;

  // Identifiers
  barcodes: string[];

  // Promotions
  promotions: Array<{
    promo_code: string;
    promo_family: string;
    promo_type: string;
    start_date: string;
    end_date: string;
  }>;

  // Relations
  related_products: string[];    // oarti values

  // Inventory (optional - for future)
  inventory?: {
    quantity: number;
    warehouse_id?: string;
  };

  // Timestamps
  created_at: Date;              // dinse_ianag
  updated_at: Date;
  imported_at: Date;
  import_source: 'hidros';
}
```

---

## Import Strategy

### Phase 1: Data Extraction (Read-only)

1. **Connect to Hidros MySQL**
   - Use readonly_user credentials
   - Test connection to both databases

2. **Query Products**
   ```sql
   SELECT * FROM mymb_hidros.myartmag
   WHERE binse_inocl = 'S'  -- Only sellable products
   ORDER BY oarti
   LIMIT 100  -- Start with 100 for testing
   ```

3. **For Each Product, Fetch:**
   - Brand info (myprecod)
   - Product type (mytparti, mytptpar)
   - Categories (supervisor_hidros.submenu_product, channel_submenu)
   - Groups (myarxgru)
   - Technical features (myctarti, mycttpar)
   - Custom properties (supervisor_hidros.data)
   - Product features (supervisor_hidros.product_feature)
   - Price (mylisrig)
   - Barcodes (mybarcod)
   - Promotions (mypromor, mypromot)
   - Related products (myacxart)

### Phase 2: Data Transformation

1. **Transform field names** (Hidros → PIM schema)
2. **Handle parent-child relationships**
   - Parent products: aggregate data from children
   - Child products: include parent reference
3. **Normalize categories** (3-level hierarchy)
4. **Aggregate technical features** for parent products
5. **Format dates** (MySQL datetime → ISO 8601)
6. **Handle encodings** (latin1 → utf8)

### Phase 3: Data Loading

1. **Insert into MongoDB**
   - Collection: `products_pim`
   - Batch size: 100 products
   - Use bulk insert operations

2. **Create Indexes**
   ```javascript
   db.products_pim.createIndex({ sku: 1 }, { unique: true });
   db.products_pim.createIndex({ entity_code: 1 });
   db.products_pim.createIndex({ "brand.brand_id": 1 });
   db.products_pim.createIndex({ "product_type.type_id": 1 });
   db.products_pim.createIndex({ "product_type.subtype_id": 1 });
   db.products_pim.createIndex({ import_source: 1 });
   ```

3. **Validation**
   - Verify record counts match
   - Check for missing required fields
   - Validate relationships (parent-child)

### Phase 4: Testing & Verification

1. **Test with 100 products** first
2. **Verify data integrity:**
   - All brands exist
   - Product types match
   - Images accessible
   - Prices present
3. **Run full import** (~16,000 products)
4. **Generate import report:**
   - Total imported
   - Errors encountered
   - Missing data summary

---

## Import Script Structure

```javascript
// scripts/import-hidros-products.js

const mysql = require('mysql2/promise');
const mongoose = require('mongoose');

// Configuration
const HIDROS_CONFIG = {
  host: '161.156.172.254',
  port: 33088,
  user: 'readonly_user',
  password: 'SecurePassword123!',
  databases: {
    main: 'mymb_hidros',
    supervisor: 'supervisor_hidros'
  }
};

const MONGO_CONFIG = {
  url: 'mongodb://root:root@localhost:27017/?authSource=admin',
  database: 'hdr-api-it',
  collection: 'products_pim'
};

// Main import function
async function importHidrosProducts(options = {}) {
  const { limit = 100, offset = 0 } = options;

  // 1. Connect to databases
  const mysqlConn = await connectToHidros();
  const mongoDb = await connectToMongo();

  // 2. Fetch products
  const products = await fetchProducts(mysqlConn, { limit, offset });

  // 3. Transform & enrich each product
  const transformedProducts = [];
  for (const product of products) {
    const enriched = await enrichProduct(mysqlConn, product);
    const transformed = transformProduct(enriched);
    transformedProducts.push(transformed);
  }

  // 4. Insert into MongoDB
  await bulkInsert(mongoDb, transformedProducts);

  // 5. Generate report
  return {
    total: transformedProducts.length,
    success: transformedProducts.length,
    errors: []
  };
}

// Helper functions
async function fetchProducts(conn, { limit, offset }) {
  const [rows] = await conn.query(`
    SELECT * FROM myartmag
    WHERE binse_inocl = 'S'
    ORDER BY oarti
    LIMIT ? OFFSET ?
  `, [limit, offset]);
  return rows;
}

async function enrichProduct(conn, product) {
  // Fetch all related data in parallel
  const [brand, productType, categories, groups, features, ...] =
    await Promise.all([
      fetchBrand(conn, product.cprec_darti),
      fetchProductType(conn, product.ctipo_darti),
      fetchCategories(conn, product.oarti),
      fetchGroups(conn, product.oarti),
      fetchFeatures(conn, product.oarti),
      // ... more enrichment queries
    ]);

  return { ...product, brand, productType, categories, groups, features };
}

function transformProduct(enrichedProduct) {
  // Map Hidros fields to PIM schema
  return {
    entity_code: enrichedProduct.oarti,
    sku: enrichedProduct.carti,
    title: enrichedProduct.tarti,
    // ... complete mapping
  };
}
```

---

## Estimated Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| Setup | 30 min | Create import script, test connections |
| Test Import | 1 hour | Import 100 products, verify data |
| Debug & Fix | 1 hour | Fix any data issues, adjust mappings |
| Full Import | 2 hours | Import all ~16,000 products |
| Verification | 30 min | Run validation queries, generate report |
| **Total** | **5 hours** | Complete import process |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Missing data | Medium | Handle nulls gracefully, provide defaults |
| Encoding issues | Low | Convert latin1 → utf8 properly |
| Large dataset | Medium | Use batch processing, monitor memory |
| Slow queries | Medium | Add database indexes, optimize queries |
| Parent-child complexity | High | Process parents first, then children |

---

## Success Criteria

- ✅ All ~16,000 sellable products imported
- ✅ < 1% error rate on valid products
- ✅ All brands mapped correctly
- ✅ Product types/categories complete
- ✅ Parent-child relationships intact
- ✅ Technical features preserved
- ✅ Import completes in < 3 hours
- ✅ Data validated against source

---

## Next Steps (After Import)

1. **Associate products with collections/brands**
   - Use existing association system
   - Bulk import brand associations

2. **Set up sync job**
   - Daily sync from Hidros
   - Update prices, inventory, new products

3. **Image migration**
   - Copy product images to CDN
   - Update image paths in PIM

4. **Quality scoring**
   - Run quality check on imported products
   - Identify missing data

5. **Enable in B2B portal**
   - Make products searchable
   - Test product detail pages

---

**Ready to start:** Create the import script and test with 100 products!
