import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

// Provision an in-memory connection and expose it before the module loads
let mongod: MongoMemoryServer;
let conn: mongoose.Connection;

// Mock the pool so connectWithModels uses our in-memory connection
vi.mock("@/lib/db/connection-pool", () => ({
  getPooledConnection: vi.fn(async () => conn),
}));

// Also mock build-guard (connection-pool imports it)
vi.mock("@/lib/db/build-guard", () => ({
  assertNotBuildPhase: vi.fn(),
}));

// Import connectWithModels AFTER mocks are set up
const { connectWithModels } = await import("@/lib/db/connection");

const TEST_DB = "vinc-registry-test";

describe("model registry includes B2B portal models", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    conn = await mongoose.createConnection(mongod.getUri()).asPromise();
  }, 30000);

  afterAll(async () => {
    await conn.close();
    await mongod.stop();
  });

  it("exposes B2BPortal, B2BPage, B2BSitemap, B2BFormDefinition, B2BFormSubmission", async () => {
    const models = await connectWithModels(TEST_DB);
    expect(models.B2BPortal).toBeDefined();
    expect(models.B2BPage).toBeDefined();
    expect(models.B2BSitemap).toBeDefined();
    expect(models.B2BFormDefinition).toBeDefined();
    expect(models.B2BFormSubmission).toBeDefined();
  });
});
