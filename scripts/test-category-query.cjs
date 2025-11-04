require('dotenv').config();
const mongoose = require('mongoose');

async function testQuery() {
  await mongoose.connect(process.env.VINC_MONGO_URL, {
    dbName: process.env.VINC_MONGO_DB,
  });

  const Category = mongoose.model('Category', new mongoose.Schema({}, { strict: false }));

  const targetWholesalerId = '6900ac2364787f6f09231006';

  console.log('\n=== TEST 1: Query with wholesaler_id (string) ===');
  const query1 = { wholesaler_id: targetWholesalerId };
  console.log('Query:', JSON.stringify(query1));
  const result1 = await Category.find(query1).lean();
  console.log('Found:', result1.length, 'categories');

  if (result1.length > 0) {
    console.log('\nSample category:');
    console.log('  name:', result1[0].name);
    console.log('  wholesaler_id:', result1[0].wholesaler_id);
    console.log('  wholesaler_id type:', typeof result1[0].wholesaler_id);
  }

  console.log('\n=== TEST 2: Check all categories ===');
  const allCategories = await Category.find({}).lean();
  console.log('Total categories in DB:', allCategories.length);

  if (allCategories.length > 0) {
    console.log('\nFirst category wholesaler_id:');
    console.log('  Value:', allCategories[0].wholesaler_id);
    console.log('  Type:', typeof allCategories[0].wholesaler_id);
    console.log('  Equals target?:', allCategories[0].wholesaler_id === targetWholesalerId);
  }

  console.log('\n=== TEST 3: Query with include_inactive=true logic ===');
  const query3 = {
    wholesaler_id: targetWholesalerId,
    // Not filtering by is_active since include_inactive=true
  };
  console.log('Query:', JSON.stringify(query3));
  const result3 = await Category.find(query3).lean();
  console.log('Found:', result3.length, 'categories');

  await mongoose.connection.close();
}

testQuery().catch(console.error);
