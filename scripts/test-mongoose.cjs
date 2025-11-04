const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const mongoUri = process.env.VINC_MONGO_URL;
const mongoDbName = process.env.VINC_MONGO_DB || "hdr-api-it";

console.log('Testing Mongoose connection...');
console.log('URI:', mongoUri.replace(/\/\/.*@/, '//***@'));
console.log('DB:', mongoDbName);
console.log('');

mongoose
  .connect(mongoUri, {
    dbName: mongoDbName,
    minPoolSize: 0,
    maxPoolSize: 50,
    bufferCommands: false
  })
  .then(() => {
    console.log('✅ Mongoose connection successful!');
    console.log('Connection state:', mongoose.connection.readyState);
    console.log('DB name:', mongoose.connection.db.databaseName);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Mongoose connection failed:');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    console.error('CodeName:', error.codeName);
    process.exit(1);
  });
