import mongoose from "mongoose";
import { projectConfig } from "@/config/project.config";

interface TenantConnection {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  dbName: string;
}

interface MongooseGlobal {
  connections: Map<string, TenantConnection>;
}

const globalForMongoose = globalThis as typeof globalThis & {
  _mongoose?: MongooseGlobal;
};

if (!globalForMongoose._mongoose) {
  globalForMongoose._mongoose = { connections: new Map() };
}

/**
 * Connect to a tenant-specific database
 * Each tenant gets its own connection pool for isolation
 */
export const connectToDatabase = async (tenantDbName?: string) => {
  // Read env vars inside function, not at module level!
  const MIN_POOL = Number(process.env.VINC_MONGO_MIN_POOL_SIZE ?? "0");
  const MAX_POOL = Number(process.env.VINC_MONGO_MAX_POOL_SIZE ?? "50");

  // Use projectConfig as single source of truth
  const mongoUri = projectConfig.mongoUrl;
  const mongoDbName = tenantDbName || projectConfig.mongoDatabase;

  const cache = globalForMongoose._mongoose!;
  let tenantCache = cache.connections.get(mongoDbName);

  // Initialize cache for this database if it doesn't exist
  if (!tenantCache) {
    tenantCache = {
      conn: null,
      promise: null,
      dbName: mongoDbName,
    };
    cache.connections.set(mongoDbName, tenantCache);
  }

  // Check if we have an active connection for this database
  if (tenantCache.conn) {
    const state = mongoose.connection.readyState;
    // Verify the connection is to the correct database
    const currentDb = mongoose.connection.db?.databaseName;

    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (state === 0 || state === 3 || currentDb !== mongoDbName) {
      console.log(
        `⚠️  Mongoose disconnected or wrong DB (current: ${currentDb}, needed: ${mongoDbName}), reconnecting...`
      );
      tenantCache.conn = null;
      tenantCache.promise = null;
    } else {
      // Connection is good and to the right database
      return tenantCache.conn;
    }
  }

  // Create new connection if needed
  if (!tenantCache.promise) {
    console.log(
      `🔌 Connecting to MongoDB database: ${mongoDbName} (${mongoUri.replace(/\/\/.*@/, "//***@")})`
    );

    tenantCache.promise = mongoose
      .connect(mongoUri, {
        dbName: mongoDbName,
        minPoolSize: MIN_POOL,
        maxPoolSize: MAX_POOL,
        bufferCommands: false,
      })
      .then((m) => {
        console.log(`✅ MongoDB connected to database: ${mongoDbName}`);
        tenantCache!.conn = m;
        return m;
      })
      .catch((error) => {
        console.error(`❌ MongoDB connection failed for ${mongoDbName}:`, error.message);
        tenantCache!.promise = null;
        tenantCache!.conn = null;
        throw error;
      });
  }

  try {
    tenantCache.conn = await tenantCache.promise;
  } catch (error) {
    tenantCache.conn = null;
    tenantCache.promise = null;
    throw error;
  }

  return tenantCache.conn;
};

/**
 * Get current database name
 */
export const getCurrentDatabase = (): string | undefined => {
  return mongoose.connection.db?.databaseName;
};

/**
 * Disconnect from all tenant databases
 */
export const disconnectAll = async () => {
  const cache = globalForMongoose._mongoose!;
  cache.connections.clear();
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from all MongoDB databases");
  }
};
