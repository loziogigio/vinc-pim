require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.VINC_MONGO_URL, {
    dbName: process.env.VINC_MONGO_DB,
  });

  const B2BUser = mongoose.model('B2BUser', new mongoose.Schema({}, { strict: false }));

  const users = await B2BUser.find({})
    .select('_id username email role companyName wholesaler_id')
    .lean();

  console.log('\n=== B2B USERS ===\n');
  console.log('Found', users.length, 'users\n');

  users.forEach(user => {
    console.log('User:', user.username);
    console.log('  _id:', user._id.toString());
    console.log('  Email:', user.email);
    console.log('  Role:', user.role);
    console.log('  Company:', user.companyName);
    console.log('  wholesaler_id:', user.wholesaler_id || 'NOT SET');
    console.log('');
  });

  await mongoose.connection.close();
}

check().catch(console.error);
