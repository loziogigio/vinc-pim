# Sample Import Files

These sample files can be used to test the bulk import functionality for:
- Brands
- Collections
- Categories
- Product Types

## Files

### 1. sample-products.txt
Plain text file with one entity_code per line.
Format:
```
PROD-001
PROD-002
PROD-003
```

### 2. sample-products.csv
CSV file with headers and product details.
Format:
```
entity_code,sku,name
PROD-001,SKU-001,"Product Name 1"
PROD-002,SKU-002,"Product Name 2"
```

## How to Use

### Brand Import
1. Go to /b2b/pim/brands/[brandId]
2. Click "Import Products"
3. Select either `.txt` or `.csv` file
4. Choose action: "Add to Brand" or "Remove from Brand"
5. Upload file - job will process in background

### Collection Import
1. Go to /b2b/pim/collections/[collectionId]
2. Click "Import Products"
3. Select either `.txt` or `.csv` file
4. Choose action: "Add to Collection" or "Remove from Collection"
5. Upload file - job will process in background

### Category/Product Type Import
Same process as Brands and Collections.

## File Format Rules

### TXT Format
- One entity_code per line
- No headers
- Empty lines are ignored
- Whitespace is trimmed

### CSV Format
- First line should be headers (optional but recommended)
- Columns: entity_code, sku, name
- Only entity_code is required
- Names with commas should be quoted
- To include quotes in name, use double quotes ("")

## Sample Data

This sample contains 15 products:

1. PROD-0001 - Sample Product 1
2. PROD-0002 - Sample Product 2
3. PROD-0003 - Sample Product 3
4. PROD-0004 - Sample Product 4
5. PROD-0005 - Sample Product 5
... and 10 more

**Note:** If you see generic product codes like PROD-0001, PROD-0002, etc., it means no products were found in your database yet. These are example entity_codes to demonstrate the file format. Replace them with your actual product entity_codes before importing.

## Background Job Processing

Import operations are processed asynchronously in batches of 100 items.
You can monitor job progress via the AssociationJob model.

## Notes

- Import only adds/removes associations - it does not create or delete products
- Invalid entity_codes are skipped (counted as failed items)
- Product counts are recalculated automatically after import completes
