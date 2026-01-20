/**
 * Vitest Global Setup
 *
 * This file runs before all tests.
 * Sets up global mocks to prevent production connections.
 */

import "@testing-library/jest-dom/vitest";
import { vi, afterAll } from "vitest";
import mongoose from "mongoose";

// Set test environment variables BEFORE any imports
process.env.VINC_MONGO_URL = "mongodb://localhost:27017/test";
process.env.VINC_TENANT_ID = "test-tenant";
process.env.NODE_ENV = "test";

/**
 * Global mock for connection pool.
 * Returns the default mongoose connection (which is set up by setupTestDatabase in tests).
 * This prevents tests from connecting to production MongoDB.
 */
vi.mock("@/lib/db/connection-pool", () => ({
  getPooledConnection: vi.fn(async () => {
    // Return the default mongoose connection (set up by mongodb-memory-server in tests)
    // This connection has all the models registered via setupTestDatabase()
    if (mongoose.connection.readyState === 1) {
      // Return a wrapper that delegates to the default connection
      return {
        ...mongoose.connection,
        models: mongoose.models,
        model: (name: string, schema?: mongoose.Schema) => {
          if (mongoose.models[name]) {
            return mongoose.models[name];
          }
          if (schema) {
            return mongoose.model(name, schema);
          }
          throw new Error(`Model ${name} not found`);
        },
        db: mongoose.connection.db,
      };
    }
    // Return a mock connection with empty models for tests that don't set up DB
    return {
      models: {},
      model: vi.fn(() => ({
        findOneAndUpdate: vi.fn(() => Promise.resolve({ value: 1 })),
        findOne: vi.fn(() => Promise.resolve(null)),
        find: vi.fn(() => ({ lean: vi.fn(() => Promise.resolve([])) })),
        create: vi.fn((data) => Promise.resolve(data)),
      })),
      db: {
        collection: vi.fn(() => ({
          findOne: vi.fn(),
          find: vi.fn(() => ({ toArray: vi.fn(() => []) })),
          insertOne: vi.fn(),
          updateOne: vi.fn(),
          deleteOne: vi.fn(),
        })),
      },
    };
  }),
  closeAllConnections: vi.fn(),
}));

// Clean up mongoose connections after all tests
afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});
