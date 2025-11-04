/**
 * Check what environment variables the worker sees
 */

import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local first, then .env as fallback (same as worker)
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

console.log('🔍 Environment variables the worker sees:\n');
console.log('VINC_MONGO_URL:', process.env.VINC_MONGO_URL);
console.log('VINC_MONGO_DB:', process.env.VINC_MONGO_DB);
console.log('VINC_MONGO_MIN_POOL_SIZE:', process.env.VINC_MONGO_MIN_POOL_SIZE);
console.log('VINC_MONGO_MAX_POOL_SIZE:', process.env.VINC_MONGO_MAX_POOL_SIZE);
console.log('\nREDIS_HOST:', process.env.REDIS_HOST);
console.log('REDIS_PORT:', process.env.REDIS_PORT);
