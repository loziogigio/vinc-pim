require('dotenv').config();
const mongoose = require('mongoose');

async function cleanup() {
  await mongoose.connect(process.env.VINC_MONGO_URL, {
    dbName: process.env.VINC_MONGO_DB,
  });

  const Category = mongoose.model('Category', new mongoose.Schema({}, { strict: false }));

  console.log('\n=== Cleaning up old demo categories ===\n');

  const oldWholesalerId = 'demo-wholesaler-001';
  const result = await Category.deleteMany({ wholesaler_id: oldWholesalerId });

  console.log(`Deleted ${result.deletedCount} categories with wholesaler_id: ${oldWholesalerId}`);

  const remaining = await Category.countDocuments({});
  console.log(`\nRemaining categories in database: ${remaining}`);

  await mongoose.connection.close();
  console.log('\nCleanup complete!');
}

cleanup().catch(console.error);
