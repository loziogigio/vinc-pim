#!/usr/bin/env node
/**
 * Cleanup script to drop the old 'features' collection
 * after migration to 'technicalspecifications'
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const mongoUrl = process.env.VINC_MONGO_URL;
  const dbName = process.env.VINC_MONGO_DB || 'vinc-hidros-it';
  
  if (!mongoUrl) {
    console.error('Error: VINC_MONGO_URL not set');
    process.exit(1);
  }

  console.log(`Connecting to database: ${dbName}`);
  
  await mongoose.connect(mongoUrl, { dbName });
  const db = mongoose.connection.db;

  // List all collections
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);
  
  console.log('\nExisting collections:');
  collectionNames.forEach(name => console.log(`  - ${name}`));

  // Check for old 'features' collection
  if (collectionNames.includes('features')) {
    const featuresCount = await db.collection('features').countDocuments();
    console.log(`\n⚠️  Found old 'features' collection with ${featuresCount} documents`);
    
    // Drop the old features collection
    await db.collection('features').drop();
    console.log('✅ Dropped old "features" collection');
  } else {
    console.log('\n✅ No old "features" collection found (already cleaned)');
  }

  // Check for new 'technicalspecifications' collection
  if (collectionNames.includes('technicalspecifications')) {
    const techSpecCount = await db.collection('technicalspecifications').countDocuments();
    console.log(`✅ New "technicalspecifications" collection exists with ${techSpecCount} documents`);
  } else {
    console.log('ℹ️  "technicalspecifications" collection does not exist yet (will be created on first use)');
  }

  // Check producttypes collection for old 'features' field
  if (collectionNames.includes('producttypes')) {
    const productTypesWithOldFeatures = await db.collection('producttypes').countDocuments({
      features: { $exists: true }
    });
    
    if (productTypesWithOldFeatures > 0) {
      console.log(`\n⚠️  Found ${productTypesWithOldFeatures} product types with old 'features' field`);
      
      // Rename features to technical_specifications in product types
      const result = await db.collection('producttypes').updateMany(
        { features: { $exists: true } },
        { $rename: { 'features': 'technical_specifications' } }
      );
      console.log(`✅ Renamed 'features' to 'technical_specifications' in ${result.modifiedCount} product types`);
    } else {
      console.log('✅ No product types with old "features" field');
    }
  }

  await mongoose.connection.close();
  console.log('\n✅ Cleanup complete!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
