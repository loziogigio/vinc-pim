/**
 * Multi-Tenant Connection Pool
 *
 * Maintains separate persistent connections per tenant database.
 * Uses mongoose's useDb() for efficient database switching without disconnecting.
 * Uses LRU eviction when pool is full.
 */

import mongoose from "mongoose";
import { LRUCache } from "lru-cache";

const MONGO_URI =
  process.env.VINC_MONGO_URL ||
  "mongodb://admin:admin@localhost:27017/?authSource=admin";
const MAX_CONNECTIONS = parseInt(process.env.VINC_POOL_MAX_CONNECTIONS ?? "50");
const PER_DB_POOL_SIZE = parseInt(process.env.VINC_POOL_PER_DB_SIZE ?? "10");
const TTL_MS = parseInt(process.env.VINC_POOL_TTL_MS ?? "1800000"); // 30 min

interface PoolEntry {
  connection: mongoose.Connection;
  dbName: string;
}

// Base connection (shared pool)
let baseConnection: mongoose.Connection | null = null;
let baseConnectionPromise: Promise<mongoose.Connection> | null = null;

// Pending connections to prevent duplicate attempts
const connecting = new Map<string, Promise<mongoose.Connection>>();

// LRU cache with automatic eviction
const pool = new LRUCache<string, PoolEntry>({
  max: MAX_CONNECTIONS,
  ttl: TTL_MS,
  dispose: (entry: PoolEntry) => {
    console.log(`[Pool] Evicting connection: ${entry.dbName}`);
    // useDb connections share the base pool, so we don't close them individually
    // They will be garbage collected when no longer referenced
  },
});

/**
 * Get or create the base MongoDB connection
 */
async function getBaseConnection(): Promise<mongoose.Connection> {
  if (baseConnection?.readyState === 1) {
    return baseConnection;
  }

  if (baseConnectionPromise) {
    return baseConnectionPromise;
  }

  console.log("[Pool] Creating base connection");
  baseConnectionPromise = mongoose
    .createConnection(MONGO_URI, {
      minPoolSize: 0,
      maxPoolSize: PER_DB_POOL_SIZE,
      bufferCommands: false,
    })
    .asPromise();

  baseConnection = await baseConnectionPromise;
  baseConnectionPromise = null;

  baseConnection.on("error", (err) => {
    console.error("[Pool] Base connection error:", err.message);
    baseConnection = null;
  });

  baseConnection.on("disconnected", () => {
    console.log("[Pool] Base connection disconnected");
    baseConnection = null;
    pool.clear(); // Clear all useDb connections since base is gone
  });

  console.log("[Pool] Base connection established");
  return baseConnection;
}

/**
 * Get or create a connection for a tenant database.
 * Uses useDb() for efficient database switching without creating new TCP connections.
 * Concurrent-safe: multiple requests for same DB share pending promise.
 */
export async function getPooledConnection(
  dbName: string
): Promise<mongoose.Connection> {
  // 1. Check cache (hit = return immediately)
  const cached = pool.get(dbName);
  if (cached && cached.connection.readyState === 1) {
    return cached.connection;
  }

  // 2. Check if already connecting (deduplicate)
  const pending = connecting.get(dbName);
  if (pending) {
    return pending;
  }

  // 3. Create new connection using useDb
  const promise = createDbConnection(dbName);
  connecting.set(dbName, promise);

  try {
    const connection = await promise;
    pool.set(dbName, { connection, dbName });
    return connection;
  } finally {
    connecting.delete(dbName);
  }
}

/**
 * Create a new database connection using useDb()
 */
async function createDbConnection(
  dbName: string
): Promise<mongoose.Connection> {
  console.log(`[Pool] Creating connection: ${dbName}`);

  const base = await getBaseConnection();

  // useDb creates a new connection to a different database sharing the same pool
  // This is much more efficient than creating a new TCP connection
  const connection = base.useDb(dbName, {
    useCache: true, // Reuse existing connection if available
  });

  console.log(`[Pool] Connected: ${dbName}`);
  return connection;
}

/**
 * Get a model registered on the connection for a specific database.
 * Models are cached per connection.
 */
export async function getPooledModel<T extends mongoose.Document>(
  dbName: string,
  modelName: string,
  schema: mongoose.Schema
): Promise<mongoose.Model<T>> {
  const connection = await getPooledConnection(dbName);

  // Return existing model or register new one
  if (connection.models[modelName]) {
    return connection.models[modelName] as mongoose.Model<T>;
  }

  return connection.model<T>(modelName, schema);
}

/**
 * Close all pooled connections (for graceful shutdown)
 */
export async function closeAllConnections(): Promise<void> {
  console.log(`[Pool] Closing all connections (${pool.size} active)`);

  // Close base connection (which closes all useDb connections)
  if (baseConnection) {
    await baseConnection.close();
    baseConnection = null;
    baseConnectionPromise = null;
  }

  pool.clear();
  connecting.clear();
}

/**
 * Get pool statistics for monitoring
 */
export function getPoolStats() {
  return {
    active: pool.size,
    max: MAX_CONNECTIONS,
    pending: connecting.size,
    baseConnected: baseConnection?.readyState === 1,
  };
}

/**
 * Remove a specific database from the pool (for tenant deletion).
 * This ensures no stale connections remain after a tenant is deleted.
 */
export function removeFromPool(dbName: string): boolean {
  const deleted = pool.delete(dbName);
  if (deleted) {
    console.log(`[Pool] Removed connection from pool: ${dbName}`);
  }
  return deleted;
}
