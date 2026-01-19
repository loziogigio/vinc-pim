/**
 * Admin Database Connection
 *
 * Dedicated connection to vinc-admin database for super admin operations.
 * This is separate from the tenant-specific connections.
 */

import mongoose from "mongoose";

const ADMIN_DB = "vinc-admin";

let adminConnection: mongoose.Connection | null = null;
let connectionPromise: Promise<mongoose.Connection> | null = null;

/**
 * Get or create a connection to the admin database.
 * Uses singleton pattern to reuse connections.
 */
export async function connectToAdminDatabase(): Promise<mongoose.Connection> {
  // Return existing connection if ready
  if (adminConnection?.readyState === 1) {
    return adminConnection;
  }

  // Return pending connection promise if connecting
  if (connectionPromise) {
    return connectionPromise;
  }

  const mongoUrl = process.env.VINC_MONGO_URL;
  if (!mongoUrl) {
    throw new Error("VINC_MONGO_URL environment variable is not set");
  }

  // Create new connection
  connectionPromise = mongoose
    .createConnection(mongoUrl, {
      dbName: ADMIN_DB,
      minPoolSize: 0,
      maxPoolSize: 10,
    })
    .asPromise();

  adminConnection = await connectionPromise;
  connectionPromise = null;

  console.log(`Connected to admin database: ${ADMIN_DB}`);

  // Handle connection errors
  adminConnection.on("error", (err) => {
    console.error("Admin database connection error:", err);
    adminConnection = null;
  });

  adminConnection.on("disconnected", () => {
    console.log("Admin database disconnected");
    adminConnection = null;
  });

  adminConnection.on("close", () => {
    console.log("Admin database connection closed");
    adminConnection = null;
    connectionPromise = null;
  });

  return adminConnection;
}

/**
 * Get the admin database connection (must be connected first).
 */
export function getAdminConnection(): mongoose.Connection | null {
  return adminConnection;
}

/**
 * Close the admin database connection.
 */
export async function closeAdminConnection(): Promise<void> {
  if (adminConnection) {
    await adminConnection.close();
    adminConnection = null;
    connectionPromise = null;
  }
}
