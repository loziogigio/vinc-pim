require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.VINC_MONGO_URL, {
    dbName: process.env.VINC_MONGO_DB,
  });

  const PIMProduct = mongoose.models.PIMProduct || mongoose.model(
    'PIMProduct',
    new mongoose.Schema({}, { strict: false, collection: 'pimproducts' })
  );

  const batchId = 'api-batch-1762165054151';
  
  console.log('\nChecking products for batch:', batchId, '\n');
  
  const productsWithBatch = await PIMProduct.find({
    'source.batch_id': batchId,
    isCurrent: true
  }).limit(5).lean();

  console.log('Found', productsWithBatch.length, 'products with batch_id');
  
  if (productsWithBatch.length > 0) {
    console.log('\nSample product:');
    console.log('- Entity Code:', productsWithBatch[0].entity_code);
    console.log('- Status:', productsWithBatch[0].status);
    console.log('- Batch ID:', productsWithBatch[0].source?.batch_id);
    console.log('- Source ID:', productsWithBatch[0].source?.source_id);
  }
  
  const totalWithSource = await PIMProduct.countDocuments({
    'source.source_id': 'api-produc-fl',
    isCurrent: true
  });
  
  console.log('\nTotal products with source api-produc-fl:', totalWithSource);
  
  const withBatchId = await PIMProduct.countDocuments({
    'source.batch_id': { $exists: true, $ne: null },
    isCurrent: true
  });
  
  console.log('Total products with any batch_id:', withBatchId);
  
  const published = await PIMProduct.countDocuments({
    'source.batch_id': batchId,
    isCurrent: true,
    status: 'published'
  });
  
  const draft = await PIMProduct.countDocuments({
    'source.batch_id': batchId,
    isCurrent: true,
    status: 'draft'
  });
  
  console.log('\nFor batch', batchId + ':');
  console.log('- Published:', published);
  console.log('- Draft:', draft);
  console.log('- Total:', published + draft);

  await mongoose.connection.close();
}

main().catch(console.error);
