/**
 * Test Script: Insert 1000 products to test image optimization performance
 */

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const uri = process.env.VINC_MONGO_URL;
const dbName = process.env.VINC_MONGO_DB || "hdr-api-it";

// Sample images for testing (using placeholder service)
const sampleImages = [
  {
    id: "img_001",
    thumbnail: "https://via.placeholder.com/50x50/FF6B6B/FFFFFF?text=P1",
    medium: "https://via.placeholder.com/300x300/FF6B6B/FFFFFF?text=P1",
    large: "https://via.placeholder.com/1000x1000/FF6B6B/FFFFFF?text=P1",
    original: "https://via.placeholder.com/2000x2000/FF6B6B/FFFFFF?text=P1",
    blur: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAKAAoDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlbaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD5/ooooA//2Q=="
  },
  {
    id: "img_002",
    thumbnail: "https://via.placeholder.com/50x50/4ECDC4/FFFFFF?text=P2",
    medium: "https://via.placeholder.com/300x300/4ECDC4/FFFFFF?text=P2",
    large: "https://via.placeholder.com/1000x1000/4ECDC4/FFFFFF?text=P2",
    original: "https://via.placeholder.com/2000x2000/4ECDC4/FFFFFF?text=P2"
  },
  {
    id: "img_003",
    thumbnail: "https://via.placeholder.com/50x50/45B7D1/FFFFFF?text=P3",
    medium: "https://via.placeholder.com/300x300/45B7D1/FFFFFF?text=P3",
    large: "https://via.placeholder.com/1000x1000/45B7D1/FFFFFF?text=P3",
    original: "https://via.placeholder.com/2000x2000/45B7D1/FFFFFF?text=P3"
  },
  {
    id: "img_004",
    thumbnail: "https://via.placeholder.com/50x50/96CEB4/FFFFFF?text=P4",
    medium: "https://via.placeholder.com/300x300/96CEB4/FFFFFF?text=P4",
    large: "https://via.placeholder.com/1000x1000/96CEB4/FFFFFF?text=P4",
    original: "https://via.placeholder.com/2000x2000/96CEB4/FFFFFF?text=P4",
    blur: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAKAAoDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlbaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD5/ooooA//2Q=="
  },
  {
    id: "img_005",
    thumbnail: "https://via.placeholder.com/50x50/FFEAA7/333333?text=P5",
    medium: "https://via.placeholder.com/300x300/FFEAA7/333333?text=P5",
    large: "https://via.placeholder.com/1000x1000/FFEAA7/333333?text=P5",
    original: "https://via.placeholder.com/2000x2000/FFEAA7/333333?text=P5"
  }
];

const categories = ["Electronics", "Clothing", "Home & Garden", "Sports", "Books"];
const brands = ["Brand A", "Brand B", "Brand C", "Brand D", "Brand E"];
const statuses = ["draft", "published", "archived"];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateProduct(index) {
  const entityCode = `TEST-PROD-${String(index + 1).padStart(4, '0')}`;
  const sku = `SKU-${String(index + 1).padStart(4, '0')}`;

  return {
    entity_code: entityCode,
    sku: sku,
    name: `Test Product ${index + 1}`,
    slug: `test-product-${index + 1}`,
    description: `This is test product number ${index + 1} for performance testing`,
    long_description: `<p>Detailed description for <strong>Test Product ${index + 1}</strong>. This product is part of a performance test dataset.</p>`,

    // Pricing
    price: randomInt(10, 1000),
    sale_price: randomInt(5, 900),
    currency: "EUR",

    // Image (rotate through sample images)
    image: sampleImages[index % sampleImages.length],

    // Media
    gallery: [],

    // Categorization
    category: {
      id: `cat_${randomInt(1, 5)}`,
      name: randomElement(categories)
    },
    brand: {
      id: `brand_${randomInt(1, 5)}`,
      name: randomElement(brands)
    },
    tags: [`tag${randomInt(1, 10)}`, `tag${randomInt(1, 10)}`],

    // Inventory
    quantity: randomInt(0, 500),
    stock: randomInt(0, 500),
    stock_status: randomInt(0, 100) > 20 ? "in_stock" : "out_of_stock",
    uom: "PZ",

    // Physical Properties
    gross_weight: randomInt(100, 5000) / 1000,
    net_weight: randomInt(100, 4500) / 1000,
    weight_uom: "KG",
    length: randomInt(10, 100),
    width: randomInt(10, 100),
    height: randomInt(10, 100),
    dimension_uom: "CM",

    // Status
    status: index < 800 ? "published" : randomElement(statuses),
    completeness_score: randomInt(60, 100),
    critical_issues: [],

    // Analytics
    analytics: {
      views_30d: randomInt(0, 1000),
      priority_score: randomInt(0, 100)
    },

    // Timestamps
    created_at: new Date(Date.now() - randomInt(0, 365) * 24 * 60 * 60 * 1000),
    updated_at: new Date(Date.now() - randomInt(0, 30) * 24 * 60 * 60 * 1000)
  };
}

async function insertTestProducts() {
  console.log('🔌 Connecting to MongoDB...');
  console.log(`   Database: ${dbName}\n`);

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected!\n');

    const db = client.db(dbName);
    const collection = db.collection('pim_products');

    // Check if test products already exist
    const existingCount = await collection.countDocuments({
      entity_code: /^TEST-PROD-/
    });

    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing test products`);
      console.log('   Deleting them first...\n');
      const deleteResult = await collection.deleteMany({
        entity_code: /^TEST-PROD-/
      });
      console.log(`   ✅ Deleted ${deleteResult.deletedCount} products\n`);
    }

    console.log('📦 Generating 1000 test products...');
    const products = [];
    for (let i = 0; i < 1000; i++) {
      products.push(generateProduct(i));

      if ((i + 1) % 100 === 0) {
        process.stdout.write(`   Generated ${i + 1}/1000 products...\r`);
      }
    }
    console.log('\n   ✅ Generated 1000 products\n');

    console.log('💾 Inserting products into database...');
    const startTime = Date.now();

    // Insert in batches of 100
    for (let i = 0; i < products.length; i += 100) {
      const batch = products.slice(i, i + 100);
      await collection.insertMany(batch);
      process.stdout.write(`   Inserted ${Math.min(i + 100, products.length)}/1000 products...\r`);
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`\n   ✅ Inserted 1000 products in ${duration}s\n`);

    // Summary
    console.log('=' .repeat(60));
    console.log('📊 Summary:');
    console.log('=' .repeat(60));
    console.log(`   Total products: 1000`);
    console.log(`   Entity codes: TEST-PROD-0001 to TEST-PROD-1000`);
    console.log(`   Published: ~800`);
    console.log(`   Draft/Archived: ~200`);
    console.log(`   With blur placeholder: ~400 (every other product)`);
    console.log('=' .repeat(60));
    console.log('\n✅ Test data ready!');
    console.log('\n📝 Next steps:');
    console.log('   1. Visit http://localhost:3000/b2b/pim/products');
    console.log('   2. Open DevTools → Network → Filter: Img');
    console.log('   3. Observe image optimization in action:');
    console.log('      - First load: ~100-200ms per image');
    console.log('      - Cached: ~5-10ms per image');
    console.log('      - File size: 2-5KB instead of 500KB+');
    console.log('   4. Check first 5 images load with priority');
    console.log('   5. Scroll to see lazy loading in action\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB\n');
  }
}

insertTestProducts().catch(console.error);
