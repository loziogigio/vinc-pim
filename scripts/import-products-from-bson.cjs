/**
 * Import Products from BSON dump
 * Reads BSON file and imports products into MongoDB
 */

const fs = require('fs');
const mongoose = require('mongoose');
const { BSON } = require('bson');

// MongoDB connection
const MONGO_URI = process.env.VINC_MONGO_URL || 'mongodb://root:root@localhost:27017/?authSource=admin';
const DB_NAME = process.env.VINC_MONGO_DB || 'hdr-api-it';

// BSON file path
const BSON_FILE = '/tmp/products.bson';

async function importProducts() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
    console.log(`Connected to MongoDB: ${DB_NAME}`);

    const db = mongoose.connection.db;
    const collection = db.collection('products');

    console.log('\nReading BSON file...');
    const bsonData = fs.readFileSync(BSON_FILE);
    console.log(`File size: ${(bsonData.length / 1024 / 1024).toFixed(2)} MB`);

    // Parse BSON documents
    const documents = [];
    let offset = 0;
    let count = 0;

    console.log('\nParsing documents...');
    while (offset < bsonData.length) {
      try {
        // Read document size (first 4 bytes, little endian)
        const docSize = bsonData.readInt32LE(offset);

        if (docSize < 5 || offset + docSize > bsonData.length) {
          break;
        }

        // Extract and deserialize document
        const docBuffer = bsonData.slice(offset, offset + docSize);
        const doc = BSON.deserialize(docBuffer);

        documents.push(doc);
        offset += docSize;
        count++;

        // Progress indicator
        if (count % 100 === 0) {
          process.stdout.write(`\rParsed ${count} documents...`);
        }
      } catch (e) {
        console.error(`\nError parsing document at offset ${offset}:`, e.message);
        break;
      }
    }

    console.log(`\n\n✓ Parsed ${documents.length} documents from BSON file`);

    if (documents.length === 0) {
      console.log('No documents to import');
      await mongoose.disconnect();
      return;
    }

    // Show sample structure
    console.log('\nSample product structure:');
    const sample = documents[0];
    console.log(JSON.stringify({
      _id: sample._id,
      sku: sample.sku,
      id: sample.id,
      title: sample.title,
      price: sample.price,
      keys: Object.keys(sample)
    }, null, 2));

    // Check existing products
    const existingCount = await collection.countDocuments();
    console.log(`\nExisting products in database: ${existingCount}`);

    // Ask for confirmation to proceed
    if (existingCount > 0) {
      console.log('\n⚠️  Products already exist in database!');
      console.log('This script will INSERT new documents (duplicates possible)');
      console.log('To avoid duplicates, drop the collection first or skip existing ones.');
    }

    console.log(`\nImporting ${documents.length} products...`);

    // Bulk insert in batches
    const BATCH_SIZE = 1000;
    let imported = 0;

    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);

      try {
        await collection.insertMany(batch, { ordered: false });
        imported += batch.length;
        process.stdout.write(`\rImported ${imported}/${documents.length} products...`);
      } catch (error) {
        // Handle duplicate key errors
        if (error.code === 11000) {
          const insertedCount = error.result?.nInserted || 0;
          imported += insertedCount;
          console.log(`\n⚠️  Batch had ${batch.length - insertedCount} duplicates (skipped)`);
        } else {
          throw error;
        }
      }
    }

    console.log(`\n\n✓ Import completed!`);
    console.log(`  Total documents: ${documents.length}`);
    console.log(`  Imported: ${imported}`);
    console.log(`  Skipped: ${documents.length - imported}`);

    // Final count
    const finalCount = await collection.countDocuments();
    console.log(`  Final count in DB: ${finalCount}`);

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');

  } catch (error) {
    console.error('\n❌ Import error:', error);
    process.exit(1);
  }
}

// Run import
importProducts();
