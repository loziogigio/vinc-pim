import dotenv from 'dotenv';
import { resolve } from 'path';
import { connectToDatabase } from '../src/lib/db/connection';
import mongoose from 'mongoose';

// Load env vars
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

console.log('Testing connection.ts...');
console.log('');

// First, clear any existing mongoose connections
if (mongoose.connection.readyState !== 0) {
  console.log('⚠️  Closing existing Mongoose connection...');
  await mongoose.disconnect();
}

connectToDatabase()
  .then(() => {
    console.log('✅ Connection successful!');
    console.log('State:', mongoose.connection.readyState);
    console.log('DB:', mongoose.connection.db?.databaseName);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  });
