import mongoose from "mongoose";

const MIN_POOL = Number(process.env.VINC_MONGO_MIN_POOL_SIZE ?? "0");
const MAX_POOL = Number(process.env.VINC_MONGO_MAX_POOL_SIZE ?? "50");

const mongoUri = process.env.VINC_MONGO_URL ?? "mongodb://admin:admin@localhost:27017/?authSource=admin";
const mongoDbName = process.env.VINC_MONGO_DB ?? "app";

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
    cache.promise = mongoose
      .connect(mongoUri, {
        dbName: mongoDbName,
        minPoolSize: MIN_POOL,
        maxPoolSize: MAX_POOL,
        bufferCommands: false
      })
      .then((m) => {
        cache.conn = m;
        return m;
      })
      .catch((error) => {
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
