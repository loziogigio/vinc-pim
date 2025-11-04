require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const mongoose = require('mongoose');

const mongoUri = process.env.VINC_MONGO_URL;
const mongoDbName = process.env.VINC_MONGO_DB || "hdr-api-it";

async function updateFieldMappings() {
  await mongoose.connect(mongoUri, { dbName: mongoDbName });

  const ImportSource = mongoose.connection.collection('importsources');

  // Define field mappings that transform CSV flat structure to nested PIM structure
  const fieldMappings = [
    // Basic fields
    { source_field: 'entity_code', pim_field: 'entity_code' },
    { source_field: 'sku', pim_field: 'sku' },
    { source_field: 'name', pim_field: 'name' },
    { source_field: 'description', pim_field: 'description' },

    // Inventory
    { source_field: 'quantity', pim_field: 'quantity', transform: 'parseInt(value) || 0' },
    { source_field: 'unit', pim_field: 'unit' },

    // Image - main product image (nested object)
    { source_field: 'image', pim_field: 'image.original' },
    { source_field: 'image', pim_field: 'image.thumbnail' },
    { source_field: 'image', pim_field: 'image.id', transform: 'value.split("/").pop()' },

    // Gallery images (array of nested objects)
    { source_field: 'gallery_image_1', pim_field: 'gallery.0.original' },
    { source_field: 'gallery_image_1', pim_field: 'gallery.0.thumbnail' },
    { source_field: 'gallery_image_1', pim_field: 'gallery.0.id', transform: 'value.split("/").pop()' },

    { source_field: 'gallery_image_2', pim_field: 'gallery.1.original' },
    { source_field: 'gallery_image_2', pim_field: 'gallery.1.thumbnail' },
    { source_field: 'gallery_image_2', pim_field: 'gallery.1.id', transform: 'value.split("/").pop()' },

    // Brand (nested object)
    { source_field: 'brand_id', pim_field: 'brand.id' },
    { source_field: 'brand_name', pim_field: 'brand.name' },
    { source_field: 'brand_name', pim_field: 'brand.slug', transform: 'value.toLowerCase().replace(/[^a-z0-9]+/g, "-")' },

    // Category (nested object)
    { source_field: 'category_id', pim_field: 'category.id' },
    { source_field: 'category_name', pim_field: 'category.name' },
    { source_field: 'category_name', pim_field: 'category.slug', transform: 'value.toLowerCase().replace(/[^a-z0-9]+/g, "-")' },

    // Features (array of objects)
    { source_field: 'feature_1_label', pim_field: 'features.0.label' },
    { source_field: 'feature_1_value', pim_field: 'features.0.value' },
    { source_field: 'feature_2_label', pim_field: 'features.1.label' },
    { source_field: 'feature_2_value', pim_field: 'features.1.value' },
    { source_field: 'feature_3_label', pim_field: 'features.2.label' },
    { source_field: 'feature_3_value', pim_field: 'features.2.value' },
  ];

  // Convert array format to Record format for field_mappings
  const fieldMappingsRecord = {};
  fieldMappings.forEach(mapping => {
    // For simple 1:1 mappings, use the pim_field as value
    // Skip complex multi-mappings (same source_field to multiple pim_fields)
    if (!fieldMappingsRecord[mapping.source_field]) {
      fieldMappingsRecord[mapping.source_field] = mapping.pim_field;
    }
  });

  const result = await ImportSource.updateOne(
    { source_id: 'test-csv' },
    { $set: { field_mappings: fieldMappingsRecord } }
  );

  console.log('✅ Field mappings updated!');
  console.log('Matched:', result.matchedCount);
  console.log('Modified:', result.modifiedCount);
  console.log('');
  console.log('📋 Total mappings:', fieldMappings.length);
  console.log('');
  console.log('You can now re-upload the CSV and it should import correctly!');

  process.exit(0);
}

updateFieldMappings().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
