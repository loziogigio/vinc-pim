# PIM Import Test Data

This directory contains test data for testing the PIM import functionality.

## Test CSV File

**File:** `pim-import-sample.csv`

**Contents:** 10 realistic products based on actual data from `products_b2b` collection

### Products Included

1. **F10000** - Ball Valve Female/Female (BUGATTI) - €39.50
2. **F10018** - Ball Valve Male/Female (BUGATTI) - €42.00
3. **F10036** - Ball Valve Butterfly Handle (BUGATTI) - €45.00
4. **F20001** - 3-Way Ball Valve L-Port (CALEFFI) - €67.50
5. **F20002** - 3-Way Ball Valve T-Port (CALEFFI) - €72.00
6. **M30001** - Circulation Pump 60W (GRUNDFOS) - €245.00
7. **M30002** - Circulation Pump 80W (GRUNDFOS) - €289.00
8. **H40001** - Radiator Valve Angled (OVENTROP) - €28.50
9. **H40002** - Radiator Valve Straight (OVENTROP) - €32.00
10. **T50001** - Expansion Tank 18L (ZILMET) - €89.00

### CSV Structure

**22 Columns:**
- Basic fields: `entity_code`, `sku`, `name`, `description`
- Pricing: `price`, `sale_price`, `currency`
- Inventory: `quantity`, `unit`
- Brand: `brand_id`, `brand_name`
- Category: `category_id`, `category_name`
- Images: `image`, `gallery_image_1`, `gallery_image_2`
- Features: `feature_1_label`, `feature_1_value`, `feature_2_label`, `feature_2_value`, `feature_3_label`, `feature_3_value`

### Image URLs

All images are properly formatted with the correct base URL:
```
https://b2b.hidros.com/sites/default/files/product_images/{entity_code}/{filename}.jpg
```

## Import Source

**Import source created:** `test-csv-import`

**Configuration:**
- Source ID: `test-csv-import`
- Source Name: `Test CSV Import`
- Source Type: `manual_upload`
- Auto-publish: `enabled`
- Auto-publish threshold: `80`
- Status: `active`

## How to Test

### Prerequisites

Make sure you have:
1. ✅ Dev server running (`pnpm dev`)
2. ✅ Worker running (`pnpm worker:pim`)
3. ✅ Redis running (port 6379)
4. ✅ MongoDB running (port 27017)

### Step 1: Start All Services

**Terminal 1 - Dev Server:**
```bash
cd vinc-apps/vinc-storefront
pnpm dev
```

**Terminal 2 - Worker:**
```bash
cd vinc-apps/vinc-storefront
pnpm worker:pim
```

### Step 2: Navigate to Import Page

Open your browser and go to:
```
http://localhost:3001/admin/pim/import
```

### Step 3: Select Import Source

From the dropdown, select:
```
Test CSV Import
```

### Step 4: Upload CSV File

1. Click the upload area or drag-and-drop the file
2. Select: `test-data/pim-import-sample.csv`
3. Click "Start Import"

### Step 5: Monitor Import Progress

**Option 1 - PIM Jobs Page (Recommended):**
```
http://localhost:3001/admin/pim/jobs
```
- Auto-refreshes every 5 seconds
- Shows real-time progress
- Displays errors if any

**Option 2 - Worker Terminal:**
Watch the worker terminal for processing logs

### Step 6: Verify Results

**View Imported Products:**
```
http://localhost:3001/admin/pim/products
```

**Expected Results:**
- 10 products created
- Quality scores: 85-95 range
- All products have:
  - ✅ Name (English)
  - ✅ Description
  - ✅ Brand (BUGATTI, CALEFFI, GRUNDFOS, OVENTROP, ZILMET)
  - ✅ Category (Valves, Pumps, Radiator Valves, Expansion Tanks)
  - ✅ Primary image
  - ✅ Price and sale price
  - ✅ Stock quantity
  - ✅ 2-3 technical features

### Step 7: Check Individual Product

Click on any product to view details:
```
http://localhost:3001/admin/pim/products/{entity_code}
```

**Verify:**
- Quality dashboard shows completeness score
- All fields populated correctly
- Images load properly (with correct URL prepending)
- Features displayed in table
- Brand and category linked

### Step 8: Test Auto-Publish

Products with quality score ≥ 80 should be auto-published:

1. Check product status badge (should be "published")
2. Products with score < 80 should remain "draft"

## Expected Quality Scores

Based on the PIM scoring system (0-100):

| Product | Expected Score | Auto-Publish | Reason |
|---------|---------------|--------------|--------|
| F10000 | 90 | ✅ Yes | Has all fields + 3 features |
| F10018 | 90 | ✅ Yes | Has all fields + 3 features |
| F10036 | 90 | ✅ Yes | Has all fields + 3 features |
| F20001 | 90 | ✅ Yes | Has all fields + 3 features |
| F20002 | 90 | ✅ Yes | Has all fields + 3 features |
| M30001 | 95 | ✅ Yes | Has all fields + 3 features + gallery |
| M30002 | 95 | ✅ Yes | Has all fields + 3 features + gallery |
| H40001 | 90 | ✅ Yes | Has all fields + 3 features |
| H40002 | 90 | ✅ Yes | Has all fields + 3 features |
| T50001 | 95 | ✅ Yes | Has all fields + 3 features + gallery |

**Scoring breakdown:**
- Name (10+ chars): 15 points
- Description: 10 points
- Brand: 10 points
- Category: 10 points
- Primary image: 15 points
- Gallery (2+ images): 5 points
- Price: 10 points
- Features (3+): 15 points
- Inventory: 5 points

## Troubleshooting

### Import doesn't start

**Check:**
1. Worker is running in Terminal 2
2. Redis is accessible: `redis-cli ping` should return `PONG`
3. Check browser console for errors

### Products not created

**Check:**
1. Worker terminal for error messages
2. MongoDB connection: verify database is accessible
3. Jobs page for error details

### Images not loading

**Check:**
1. Image URLs in CSV are correct
2. Base URL prepending logic in file parser
3. CDN/S3 configuration in `.env`

### Quality scores incorrect

**Check:**
1. Scorer logic in `src/lib/pim/scorer.ts`
2. Field mapping in import source
3. Product data completeness

### Auto-publish not working

**Check:**
1. Import source has `auto_publish_enabled: true`
2. Threshold is set (default: 80)
3. Product quality score meets threshold
4. No critical issues present

## Cleanup

To remove test data and start fresh:

```bash
# Connect to MongoDB
cd vinc-apps/vinc-storefront

# Remove test products
node scripts/cleanup-test-data.js

# Or manually via MongoDB shell
mongo hdr-api-it
db.pim_products.deleteMany({ entity_code: /^(F1|F2|M3|H4|T5)/ })
db.import_jobs.deleteMany({ source_id: 'test-csv-import' })
```

## Next Steps

After successful testing:

1. **Create Production Import Sources**
   - Configure real supplier connections
   - Set up field mappings for each source
   - Adjust auto-publish thresholds

2. **Schedule Regular Imports**
   - Set up cron jobs for automated imports
   - Configure webhooks for real-time updates

3. **Monitor Quality Trends**
   - Use dashboard to track avg completeness
   - Identify products needing manual review
   - Optimize auto-publish thresholds

4. **Integrate with Analytics**
   - Connect PostHog for view tracking
   - Use priority scoring to focus efforts
   - A/B test product descriptions

## Files in This Directory

```
test-data/
├── README.md                 # This file
└── pim-import-sample.csv     # Test CSV with 10 products
```

## Related Documentation

- [PIM README](../doc/pim/README.md) - PIM system overview
- [Worker Setup](../doc/pim/WORKER_SETUP.md) - BullMQ worker configuration
- [Implementation Status](../doc/pim/IMPLEMENTATION_STATUS.md) - Current progress
- [Structure Standard](../doc/pim/STRUCTURE_STANDARD.md) - Data conventions
