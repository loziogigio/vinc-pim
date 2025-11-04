require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.VINC_MONGO_URL, {
    dbName: process.env.VINC_MONGO_DB,
  });

  const Category = mongoose.model('Category', new mongoose.Schema({}, { strict: false }));

  const targetWholesalerId = '6900ac2364787f6f09231006';
  const categories = await Category.find({ wholesaler_id: targetWholesalerId })
    .select('name wholesaler_id parent_id')
    .sort('name');

  console.log('\n=== CATEGORIES FOR WHOLESALER:', targetWholesalerId, '===\n');
  console.log('Found', categories.length, 'categories\n');

  categories.forEach(cat => {
    const parentText = cat.parent_id ? cat.parent_id : 'ROOT';
    console.log('-', cat.name, '(parent:', parentText + ')');
  });

  await mongoose.connection.close();
}

check().catch(console.error);
