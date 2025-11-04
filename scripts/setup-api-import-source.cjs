#!/usr/bin/env node
/**
 * Setup API Import Source with Auto-Publish Configuration
 */

require('dotenv').config();
const mongoose = require('mongoose');

const WHOLESALER_ID = '6900ac2364787f6f09231006';
const SOURCE_ID = 'api-produc-fl';

async function main() {
  await mongoose.connect(process.env.VINC_MONGO_URL, {
    dbName: process.env.VINC_MONGO_DB,
  });

  const ImportSource = mongoose.models.ImportSource || mongoose.model(
    'ImportSource',
    new mongoose.Schema({}, { strict: false })
  );

  // Delete existing source if it exists
  await ImportSource.deleteOne({
    wholesaler_id: WHOLESALER_ID,
    source_id: SOURCE_ID,
  });

  // Create new API import source with auto-publish
  const source = await ImportSource.create({
    wholesaler_id: WHOLESALER_ID,
    source_id: SOURCE_ID,
    source_name: 'API Product Feed (Auto-Publish Enabled)',
    source_type: 'api',

    // API configuration
    api_config: {
      endpoint: 'http://localhost:3000/products-with-errors',
      method: 'GET',
      auth_type: 'none',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    },

    // Field mapping (source → PIM)
    field_mapping: [
      { source_field: 'entity_code', pim_field: 'entity_code' },
      { source_field: 'sku', pim_field: 'sku' },
      { source_field: 'name', pim_field: 'name' },
      { source_field: 'description', pim_field: 'description' },
      { source_field: 'short_description', pim_field: 'short_description' },
      { source_field: 'quantity', pim_field: 'quantity' },
      { source_field: 'price', pim_field: 'price' },
      { source_field: 'special_price', pim_field: 'special_price' },
      { source_field: 'image', pim_field: 'image' },
      { source_field: 'gallery', pim_field: 'gallery' },
      { source_field: 'brand', pim_field: 'brand' },
      { source_field: 'category', pim_field: 'category' },
      { source_field: 'categories', pim_field: 'categories' },
      { source_field: 'features', pim_field: 'features' },
      { source_field: 'stock_status', pim_field: 'stock_status' },
      { source_field: 'weight', pim_field: 'weight' },
      { source_field: 'dimensions', pim_field: 'dimensions' },
    ],

    // Limits
    limits: {
      max_batch_size: 10000,
      warn_batch_size: 500,
      chunk_size: 500,  // Optimized chunk size
      timeout_minutes: 60,
    },

    // Auto-publish ENABLED for testing
    auto_publish_enabled: true,
    min_score_threshold: 70,  // Products with score >= 70 will be auto-published
    required_fields: ['name', 'sku', 'image'],  // Required fields for auto-publish

    // Stats
    stats: {
      total_imports: 0,
      total_products: 0,
      avg_completeness_score: 0,
    },

    // Metadata
    created_by: 'test-script',
    created_at: new Date(),
    updated_at: new Date(),
    is_active: true,
  });

  console.log('\n✅ API Import Source Created:');
  console.log('========================');
  console.log('   Source ID:', source.source_id);
  console.log('   Wholesaler ID:', source.wholesaler_id);
  console.log('   Type:', source.source_type);
  console.log('   API Endpoint:', source.api_config.endpoint);
  console.log('\n🤖 Auto-Publish Settings:');
  console.log('   Enabled:', source.auto_publish_enabled);
  console.log('   Min Score Threshold:', source.min_score_threshold + '%');
  console.log('   Required Fields:', source.required_fields.join(', '));
  console.log('\n⚙️  Import Settings:');
  console.log('   Chunk Size:', source.limits.chunk_size);
  console.log('   Batch Size:', source.limits.warn_batch_size);
  console.log('   Field Mappings:', source.field_mapping.length, 'configured');
  console.log('');

  await mongoose.connection.close();
}

main().catch(console.error);
