import mongoose from "mongoose";
import { getPooledConnection, closeAllConnections } from "./connection-pool";

// Re-export pool utilities
export {
  getPooledConnection,
  getPooledModel,
  closeAllConnections,
  getPoolStats,
} from "./connection-pool";

// Re-export model registry utilities for multi-tenant model access
export {
  getModel,
  getTenantModels,
  connectWithModels,
} from "./model-registry";

/**
 * Try to detect tenant database from request headers
 * @returns Database name or null if not available
 */
export async function detectTenantDbFromHeaders(): Promise<string | null> {
  try {
    const { headers } = await import("next/headers");
    const headersList = await headers();

    // Check for tenant database name set by middleware
    const tenantDb = headersList.get("x-resolved-tenant-db");
    if (tenantDb) {
      return tenantDb;
    }

    // Check for tenant ID and build database name
    const tenantId = headersList.get("x-resolved-tenant-id");
    if (tenantId) {
      return `vinc-${tenantId}`;
    }
  } catch {
    // Headers not available (e.g., in non-request context)
  }
  return null;
}

/**
 * Try to detect tenant database from session
 * @returns Database name or null if not available
 */
export async function detectTenantDbFromSession(): Promise<string | null> {
  try {
    const { getB2BSession } = await import("@/lib/auth/b2b-session");
    const session = await getB2BSession();
    if (session.isLoggedIn && session.tenantId) {
      return `vinc-${session.tenantId}`;
    }
  } catch {
    // Session not available (non-request context or no cookies)
  }
  return null;
}

/**
 * Auto-detect tenant database name from headers or session.
 * Throws if tenant cannot be determined.
 * @returns Database name (e.g., "vinc-hidros-it")
 */
export async function autoDetectTenantDb(): Promise<string> {
  // Try headers first (set by middleware)
  const fromHeaders = await detectTenantDbFromHeaders();
  if (fromHeaders) {
    return fromHeaders;
  }

  // Fall back to session
  const fromSession = await detectTenantDbFromSession();
  if (fromSession) {
    return fromSession;
  }

  throw new Error(
    "Could not auto-detect tenant database. Ensure middleware sets x-resolved-tenant-db header or user is logged in."
  );
}

/**
 * Connect to a tenant-specific database using connection pool.
 *
 * IMPORTANT: This function uses the connection pool for multi-tenant support.
 * It does NOT use the default mongoose connection to avoid race conditions
 * when switching between tenant databases.
 *
 * For Mongoose models, use connectWithModels() instead which provides
 * properly bound models for the tenant connection.
 *
 * @param dbName - Database name (e.g., "vinc-hidros-it"). If not provided, auto-detects from headers/session.
 * @returns A mongoose-compatible object with connection.db for raw collection access
 */
export const connectToDatabase = async (
  dbName?: string
): Promise<typeof mongoose> => {
  let targetDb: string;

  if (dbName) {
    targetDb = dbName;
  } else {
    // Try to auto-detect tenant from headers (set by middleware)
    const fromHeaders = await detectTenantDbFromHeaders();
    if (fromHeaders) {
      targetDb = fromHeaders;
    } else {
      // Try session if headers didn't have tenant info
      const fromSession = await detectTenantDbFromSession();
      if (fromSession) {
        targetDb = fromSession;
      } else {
        throw new Error(
          "No tenant database specified and could not auto-detect from headers or session."
        );
      }
    }
  }

  // Use connection pool - no disconnect/reconnect needed
  const connection = await getPooledConnection(targetDb);

  // Return mongoose-compatible object for backward compatibility
  // Routes using connection.connection.db will work
  return {
    connection: {
      db: connection.db,
      readyState: connection.readyState,
    },
    models: connection.models,
  } as unknown as typeof mongoose;
};

export const getCurrentDatabase = (): string | undefined => {
  // With pooling, there's no single "current" database
  return undefined;
};

export const disconnectAll = async () => {
  await closeAllConnections();
  console.log("🔌 Disconnected all pooled connections");
};

/**
 * Connect to tenant database, auto-detecting tenant from headers or session
 * For use in Server Components and API routes
 * @deprecated Use connectToDatabase() directly - it now auto-detects tenant
 */
export const connectToTenantDb = async (): Promise<typeof mongoose> => {
  return connectToDatabase();
};
