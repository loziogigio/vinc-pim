import dotenv from "dotenv";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: ".env.local" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define minimal schema for products
const productSchema = new mongoose.Schema({}, { strict: false, collection: "pim_products" });
const PIMProduct = mongoose.model("PIMProduct", productSchema);

async function createSampleFiles() {
  try {
    console.log("🔌 Connecting to MongoDB...");

    const mongoUri = process.env.VINC_MONGO_URL || process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error("VINC_MONGO_URL, MONGO_URI or MONGODB_URI not found in environment variables");
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // First check total product count
    const totalCount = await PIMProduct.countDocuments({});
    console.log(`📊 Total products in database: ${totalCount}`);

    const currentCount = await PIMProduct.countDocuments({ isCurrent: true });
    console.log(`📊 Products with isCurrent=true: ${currentCount}\n`);

    // Query products (limit to 20 for sample)
    // Try with and without isCurrent filter
    let products = await PIMProduct.find({ isCurrent: true })
      .select("entity_code sku name")
      .limit(20)
      .lean();

    if (products.length === 0) {
      console.log("⚠️  No products with isCurrent=true, trying all products...");
      products = await PIMProduct.find({})
        .select("entity_code sku name")
        .limit(20)
        .lean();
    }

    console.log(`✓ Found ${products.length} products for sample files\n`);

    if (products.length === 0) {
      console.log("⚠️  No products found in database.");
      console.log("📝 Creating sample files with example data...\n");

      // Create example products
      products = Array.from({ length: 15 }, (_, i) => ({
        entity_code: `PROD-${String(i + 1).padStart(4, "0")}`,
        sku: `SKU-${String(i + 1).padStart(4, "0")}`,
        name: `Sample Product ${i + 1}`,
      }));
    }

    // Create output directory
    const outputDir = path.join(__dirname, "../sample-imports");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 1. Create TXT file (entity_code only, one per line)
    const txtContent = products.map(p => p.entity_code).join("\n");
    const txtPath = path.join(outputDir, "sample-products.txt");
    fs.writeFileSync(txtPath, txtContent);
    console.log(`✓ Created TXT file: ${txtPath}`);
    console.log(`  Contains ${products.length} entity codes`);

    // 2. Create CSV file (with headers)
    const csvHeader = "entity_code,sku,name\n";
    const csvRows = products.map(p => {
      const escapedName = (p.name || "").replace(/"/g, '""');
      return `${p.entity_code},${p.sku || ""},"${escapedName}"`;
    }).join("\n");
    const csvContent = csvHeader + csvRows;
    const csvPath = path.join(outputDir, "sample-products.csv");
    fs.writeFileSync(csvPath, csvContent);
    console.log(`✓ Created CSV file: ${csvPath}`);
    console.log(`  Contains ${products.length} products with entity_code, sku, and name`);

    // 3. Create README with instructions
    const readmeContent = `# Sample Import Files

These sample files can be used to test the bulk import functionality for:
- Brands
- Collections
- Categories
- Product Types

## Files

### 1. sample-products.txt
Plain text file with one entity_code per line.
Format:
\`\`\`
PROD-001
PROD-002
PROD-003
\`\`\`

### 2. sample-products.csv
CSV file with headers and product details.
Format:
\`\`\`
entity_code,sku,name
PROD-001,SKU-001,"Product Name 1"
PROD-002,SKU-002,"Product Name 2"
\`\`\`

## How to Use

### Brand Import
1. Go to /b2b/pim/brands/[brandId]
2. Click "Import Products"
3. Select either \`.txt\` or \`.csv\` file
4. Choose action: "Add to Brand" or "Remove from Brand"
5. Upload file - job will process in background

### Collection Import
1. Go to /b2b/pim/collections/[collectionId]
2. Click "Import Products"
3. Select either \`.txt\` or \`.csv\` file
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

This sample contains ${products.length} products:

${products.slice(0, 5).map((p, i) => `${i + 1}. ${p.entity_code} - ${p.name || "N/A"}`).join("\n")}
${products.length > 5 ? `... and ${products.length - 5} more` : ""}

**Note:** If you see generic product codes like PROD-0001, PROD-0002, etc., it means no products were found in your database yet. These are example entity_codes to demonstrate the file format. Replace them with your actual product entity_codes before importing.

## Background Job Processing

Import operations are processed asynchronously in batches of 100 items.
You can monitor job progress via the AssociationJob model.

## Notes

- Import only adds/removes associations - it does not create or delete products
- Invalid entity_codes are skipped (counted as failed items)
- Product counts are recalculated automatically after import completes
`;

    const readmePath = path.join(outputDir, "README.md");
    fs.writeFileSync(readmePath, readmeContent);
    console.log(`✓ Created README: ${readmePath}`);

    console.log("\n✅ Sample import files created successfully!");
    console.log(`\nLocation: ${outputDir}`);
    console.log("\nFiles created:");
    console.log("  - sample-products.txt");
    console.log("  - sample-products.csv");
    console.log("  - README.md");

  } catch (error) {
    console.error("Error creating sample files:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

createSampleFiles();
