import mongoose from "mongoose";

interface MongooseGlobal {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const globalForMongoose = globalThis as typeof globalThis & { _mongoose?: MongooseGlobal };

if (!globalForMongoose._mongoose) {
  globalForMongoose._mongoose = { conn: null, promise: null };
}

export const connectToDatabase = async () => {
  // Read env vars inside function, not at module level!
  // This ensures dotenv has loaded before we read the values
  const MIN_POOL = Number(process.env.VINC_MONGO_MIN_POOL_SIZE ?? "0");
  const MAX_POOL = Number(process.env.VINC_MONGO_MAX_POOL_SIZE ?? "50");
  const mongoUri = process.env.VINC_MONGO_URL ?? "mongodb://admin:admin@localhost:27017/?authSource=admin";
  const mongoDbName = process.env.VINC_MONGO_DB ?? "app";

  const cache = globalForMongoose._mongoose!;

  // Force reconnect if connection failed or disconnected
  if (cache.conn) {
    const state = mongoose.connection.readyState;
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (state === 0 || state === 3) {
      console.log('⚠️  Mongoose disconnected, forcing reconnect...');
      cache.conn = null;
      cache.promise = null;
    } else {
      return cache.conn;
    }
  }

  if (!cache.promise) {
    console.log(`🔌 Connecting to MongoDB: ${mongoUri.replace(/\/\/.*@/, '//***@')}`);
    cache.promise = mongoose
      .connect(mongoUri, {
        dbName: mongoDbName,
        minPoolSize: MIN_POOL,
        maxPoolSize: MAX_POOL,
        bufferCommands: false
      })
      .then((m) => {
        console.log(`✅ MongoDB connected to database: ${mongoDbName}`);
        cache.conn = m;
        return m;
      })
      .catch((error) => {
        console.error('❌ MongoDB connection failed:', error.message);
        cache.promise = null;
        cache.conn = null;
        throw error;
      });
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.conn = null;
    cache.promise = null;
    throw error;
  }

  return cache.conn;
};
