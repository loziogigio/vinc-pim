/**
 * Shared Database Connection Utility for Scripts
 * Provides consistent tenant-based database connections for all scripts
 *
 * Usage:
 *   import { connectToTenantDb, disconnectDb } from "./lib/db-connect.js";
 *
 *   const tenantId = process.argv[2] || process.env.VINC_TENANT_ID;
 *   await connectToTenantDb(tenantId);
 *   // ... do your work
 *   await disconnectDb();
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

let currentConnection: typeof mongoose | null = null;
let currentDatabase: string | null = null;

/**
 * Connect to a tenant-specific database
 * @param tenantId - The tenant identifier (e.g., "hidros-it")
 * @param options - Optional connection options
 */
export async function connectToTenantDb(
  tenantId?: string,
  options: {
    dbNameOverride?: string;
    showLogs?: boolean;
  } = {}
): Promise<void> {
  const { dbNameOverride, showLogs = true } = options;

  // Determine tenant ID
  const resolvedTenantId = tenantId || process.env.VINC_TENANT_ID;

  if (!resolvedTenantId && !dbNameOverride) {
    throw new Error(
      "Tenant ID is required. Provide as argument or set VINC_TENANT_ID in .env"
    );
  }

  // Build database name
  const dbName = dbNameOverride || `vinc-${resolvedTenantId}`;

  // Check if already connected to this database
  if (currentConnection && currentDatabase === dbName) {
    if (showLogs) {
      console.log(`✓ Already connected to: ${dbName}`);
    }
    return;
  }

  // Get MongoDB URI
  const mongoUri =
    process.env.VINC_MONGO_URL || process.env.VINC_MONGO_URI;

  if (!mongoUri) {
    throw new Error(
      "VINC_MONGO_URL environment variable is required.\n" +
        "Example: mongodb://username:password@localhost:27017/?authSource=admin"
    );
  }

  // Disconnect if connected to different database
  if (currentConnection) {
    if (showLogs) {
      console.log(`Switching from ${currentDatabase} to ${dbName}...`);
    }
    await mongoose.disconnect();
  }

  // Connect to tenant database
  if (showLogs) {
    console.log(`\n🔌 Connecting to MongoDB...`);
    console.log(`   Database: ${dbName}`);
    console.log(`   URI: ${mongoUri.replace(/\/\/.*@/, "//***@")}\n`);
  }

  currentConnection = await mongoose.connect(mongoUri, {
    dbName,
    minPoolSize: Number(process.env.VINC_MONGO_MIN_POOL_SIZE ?? "0"),
    maxPoolSize: Number(process.env.VINC_MONGO_MAX_POOL_SIZE ?? "50"),
  });

  currentDatabase = dbName;

  if (showLogs) {
    console.log(`✅ Connected to database: ${dbName}\n`);
  }
}

/**
 * Disconnect from the database
 */
export async function disconnectDb(showLogs = true): Promise<void> {
  if (currentConnection) {
    await mongoose.disconnect();
    if (showLogs) {
      console.log(`\n🔌 Disconnected from MongoDB (${currentDatabase})`);
    }
    currentConnection = null;
    currentDatabase = null;
  }
}

/**
 * Get the current database name
 */
export function getCurrentDatabase(): string | null {
  return currentDatabase;
}

/**
 * Helper to run a script with automatic connection/disconnection
 *
 * @example
 * runScript(async (tenantId) => {
 *   const users = await B2BUserModel.find({});
 *   console.log(`Found ${users.length} users`);
 * });
 */
export async function runScript(
  fn: (tenantId: string) => Promise<void>,
  options: {
    tenantRequired?: boolean;
    showLogs?: boolean;
  } = {}
): Promise<void> {
  const { tenantRequired = true, showLogs = true } = options;

  try {
    // Get tenant from CLI argument or env var
    const tenantId = process.argv[2] || process.env.VINC_TENANT_ID;

    if (tenantRequired && !tenantId) {
      console.error("❌ Error: Tenant ID is required");
      console.error("\n📋 Usage:");
      console.error("   npx tsx scripts/<script-name>.ts <tenant-id>");
      console.error("\n📝 Examples:");
      console.error("   npx tsx scripts/<script-name>.ts hidros-it");
      console.error("   npx tsx scripts/<script-name>.ts acme-corp");
      console.error("\n💡 Or set VINC_TENANT_ID in .env file");
      process.exit(1);
    }

    // Connect to database
    await connectToTenantDb(tenantId!, { showLogs });

    // Run the script function
    await fn(tenantId!);
  } catch (error) {
    console.error("\n❌ Script error:", error);
    process.exit(1);
  } finally {
    // Always disconnect
    await disconnectDb(showLogs);
  }
}
