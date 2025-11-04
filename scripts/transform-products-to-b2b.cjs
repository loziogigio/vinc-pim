/**
 * Transform imported products to B2B format
 * Maps MongoDB product structure to RawProduct interface
 */

const mongoose = require('mongoose');

// MongoDB connection
const MONGO_URI = process.env.VINC_MONGO_URL || 'mongodb://root:root@localhost:27017/?authSource=admin';
const DB_NAME = process.env.VINC_MONGO_DB || 'hdr-api-it';

/**
 * Transform a single product from MongoDB format to RawProduct format
 */
function transformToRawProduct(mongoProduct) {
  // Extract images
  const images = (mongoProduct.media || []).map(media => ({
    original: media.cdn || `${media.path}/${media.filename}`,
    main: media.cdn || `${media.path}/${media.filename}`,
    gallery: media.cdn || `${media.path}/${media.filename}`,
    thumb: media.cdn || `${media.path}/${media.filename}`
  }));

  // Extract docs
  const docs = (mongoProduct.docs || []).map(doc => ({
    media_area_id: doc.media_area_id || 'documents',
    url: doc.url || `${doc.path}/${doc.filename}`
  }));

  // Extract short and long description from data array
  let short_description = mongoProduct.description || '';
  let long_description = '';

  if (Array.isArray(mongoProduct.data)) {
    const shortDescData = mongoProduct.data.find(d => d.property_id === 'short_description');
    const longDescData = mongoProduct.data.find(d => d.property_id === 'long_description');

    if (shortDescData) short_description = shortDescData.value;
    if (longDescData) long_description = longDescData.value;
  }

  // Transform technical features (handle both object and array)
  let features = [];
  if (mongoProduct.technical_features) {
    if (Array.isArray(mongoProduct.technical_features)) {
      features = mongoProduct.technical_features;
    } else if (typeof mongoProduct.technical_features === 'object') {
      features = Object.entries(mongoProduct.technical_features).map(([key, value]) => ({
        label: key,
        value: value
      }));
    }
  }

  // Get brand information
  const brand = mongoProduct.brand ? {
    cprec_darti: mongoProduct.brand.cprec_darti,
    tprec_darti: mongoProduct.brand.tprec_darti
  } : undefined;

  // Get brand image
  let brand_image = [];
  if (mongoProduct.brand_media && mongoProduct.brand_media.length > 0) {
    brand_image = mongoProduct.brand_media.map(bm => ({
      original: bm.cdn || `${bm.path}/${bm.filename}`,
      main: bm.cdn || `${bm.path}/${bm.filename}`,
      gallery: bm.cdn || `${bm.path}/${bm.filename}`,
      thumb: bm.cdn || `${bm.path}/${bm.filename}`
    }));
  }

  // Get category from family_type and family_subtype
  const category_code = mongoProduct.family_subtype?.ctipo_darti || mongoProduct.family_type?.ctipo_dtpar || '';
  const category_name = mongoProduct.family_subtype?.ttipo_darti || mongoProduct.family_type?.ttipo_dtpar || '';

  return {
    id: mongoProduct._id.toString(),
    entity_code: mongoProduct.entity_code,
    sku: mongoProduct.sku,
    id_parent: mongoProduct.id_parent || null,
    parent_sku: mongoProduct.parent_sku || null,
    product_status: mongoProduct.status || '',
    product_status_description: mongoProduct.status_description || '',
    title: mongoProduct.title,
    short_description,
    long_description,
    unit: mongoProduct.weight?.um || '',
    price: mongoProduct.price || 0,
    sale_price: mongoProduct.sale_price || null,
    quantity: mongoProduct.quantity || 0,
    sold: mongoProduct.sold || 0,
    model: mongoProduct.model || '',
    features,
    docs,
    images,
    brand,
    brand_image,
    category: {
      id: category_code,
      name: category_name,
      code: category_code
    },
    tag: mongoProduct.tags || [],
    children_items: [], // Will be populated if needed
    // Additional fields from MongoDB
    _source: {
      weight: mongoProduct.weight,
      volume: mongoProduct.volume,
      family_type: mongoProduct.family_type,
      family_subtype: mongoProduct.family_subtype,
      created_date: mongoProduct.created_date,
      last_updated: mongoProduct.last_updated
    }
  };
}

async function transformProducts() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
    console.log(`Connected to MongoDB: ${DB_NAME}`);

    const db = mongoose.connection.db;
    const productsCollection = db.collection('products');
    const transformedCollection = db.collection('products_b2b');

    // Count source products
    const totalProducts = await productsCollection.countDocuments();
    console.log(`\nTotal products to transform: ${totalProducts}`);

    // Check if transformed collection already exists
    const existingTransformed = await transformedCollection.countDocuments();
    if (existingTransformed > 0) {
      console.log(`\n⚠️  Warning: ${existingTransformed} products already exist in products_b2b collection`);
      console.log('Do you want to drop and recreate? (Edit script to confirm)');
      // Uncomment to drop: await transformedCollection.drop();
    }

    console.log('\nTransforming products...');

    // Process in batches
    const BATCH_SIZE = 100;
    let processed = 0;
    let cursor = productsCollection.find({});

    let batch = [];

    while (await cursor.hasNext()) {
      const mongoProduct = await cursor.next();

      try {
        const rawProduct = transformToRawProduct(mongoProduct);
        batch.push(rawProduct);

        if (batch.length >= BATCH_SIZE) {
          await transformedCollection.insertMany(batch, { ordered: false });
          processed += batch.length;
          process.stdout.write(`\rTransformed ${processed}/${totalProducts} products...`);
          batch = [];
        }
      } catch (error) {
        console.error(`\nError transforming product ${mongoProduct.sku}:`, error.message);
      }
    }

    // Insert remaining batch
    if (batch.length > 0) {
      await transformedCollection.insertMany(batch, { ordered: false });
      processed += batch.length;
    }

    console.log(`\n\n✓ Transformation completed!`);
    console.log(`  Total transformed: ${processed}`);

    // Create indexes on transformed collection
    console.log('\nCreating indexes...');
    await transformedCollection.createIndex({ sku: 1 }, { unique: true });
    await transformedCollection.createIndex({ entity_code: 1 });
    await transformedCollection.createIndex({ 'brand.cprec_darti': 1 });
    await transformedCollection.createIndex({ 'category.code': 1 });
    await transformedCollection.createIndex({ title: 'text', short_description: 'text' });
    console.log('✓ Indexes created');

    // Sample transformed product
    console.log('\n=== SAMPLE TRANSFORMED PRODUCT ===\n');
    const sample = await transformedCollection.findOne({ images: { $exists: true, $ne: [] } });
    console.log(JSON.stringify(sample, null, 2).substring(0, 2000) + '...');

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');

  } catch (error) {
    console.error('\n❌ Transformation error:', error);
    process.exit(1);
  }
}

// Run transformation
transformProducts();
