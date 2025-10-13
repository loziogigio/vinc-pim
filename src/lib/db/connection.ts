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
  if (globalForMongoose._mongoose?.conn) {
    return globalForMongoose._mongoose.conn;
  }

  if (!globalForMongoose._mongoose?.promise) {
    globalForMongoose._mongoose!.promise = mongoose.connect(mongoUri, {
      dbName: mongoDbName,
      minPoolSize: MIN_POOL,
      maxPoolSize: MAX_POOL,
      bufferCommands: false
    });
  }

  globalForMongoose._mongoose!.conn = await globalForMongoose._mongoose!.promise;

  return globalForMongoose._mongoose!.conn;
};
