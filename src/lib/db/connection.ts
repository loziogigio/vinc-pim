import mongoose from "mongoose";

// Configuration - same pattern as vinc-b2b
const MIN_POOL = Number(process.env.VINC_MONGO_MIN_POOL_SIZE ?? "0");
const MAX_POOL = Number(process.env.VINC_MONGO_MAX_POOL_SIZE ?? "50");
const mongoUri = process.env.VINC_MONGO_URL ?? "mongodb://admin:admin@localhost:27017/?authSource=admin";
// Use env var for database name (fallback to hidros-it)
const mongoDbName = process.env.VINC_TENANT_ID ? `vinc-${process.env.VINC_TENANT_ID}` : "vinc-hidros-it";
console.log(`🔧 DB: mongoDbName="${mongoDbName}", VINC_TENANT_ID="${process.env.VINC_TENANT_ID}"`);

interface MongooseGlobal {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const globalForMongoose = globalThis as typeof globalThis & { _mongoose?: MongooseGlobal };

if (!globalForMongoose._mongoose) {
  globalForMongoose._mongoose = { conn: null, promise: null };
}

export const connectToDatabase = async () => {
  const cache = globalForMongoose._mongoose!;

  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    console.log(`🔌 Connecting to MongoDB database: ${mongoDbName}`);

    cache.promise = mongoose
      .connect(mongoUri, {
        dbName: mongoDbName,
        minPoolSize: MIN_POOL,
        maxPoolSize: MAX_POOL,
        bufferCommands: false,
      })
      .then((m) => {
        console.log(`✅ MongoDB connected to database: ${mongoDbName}`);
        cache.conn = m;
        return m;
      })
      .catch((error) => {
        console.error(`❌ MongoDB connection failed:`, error.message);
        cache.promise = null;
        cache.conn = null;
        throw error;
      });
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.conn = null;
    throw error;
  }

  return cache.conn;
};

export const getCurrentDatabase = (): string | undefined => {
  return mongoose.connection.db?.databaseName;
};

export const disconnectAll = async () => {
  const cache = globalForMongoose._mongoose!;
  cache.conn = null;
  cache.promise = null;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
};
