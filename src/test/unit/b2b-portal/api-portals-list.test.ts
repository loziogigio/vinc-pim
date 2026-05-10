import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { GET, POST } from "@/app/api/b2b/b2b/portals/route";
import { buildAuthedRequest } from "@/test/helpers/auth";

const TEST_TENANT = "api-portals-test";
const TEST_DB = `vinc-${TEST_TENANT}`;

// ============================================
// IN-MEMORY DB SETUP
// ============================================

let mongod: MongoMemoryServer;
let conn: mongoose.Connection;

// Mock the pool so connectWithModels uses our in-memory connection
vi.mock("@/lib/db/connection-pool", () => ({
  getPooledConnection: vi.fn(async () => conn),
}));

// Mock build-guard (connection-pool imports it)
vi.mock("@/lib/db/build-guard", () => ({
  assertNotBuildPhase: vi.fn(),
}));

// Mock auth — requireTenantAuth always succeeds with the test tenant
vi.mock("@/lib/auth/tenant-auth", () => ({
  requireTenantAuth: vi.fn(() =>
    Promise.resolve({
      success: true,
      tenantId: TEST_TENANT,
      tenantDb: TEST_DB,
      userId: "test-user",
      authMethod: "session",
    })
  ),
}));

// Import connectWithModels AFTER mocks are set up
const { connectWithModels } = await import("@/lib/db/connection");

// ============================================
// HELPERS
// ============================================

async function clean() {
  const { B2BPortal } = await connectWithModels(TEST_DB);
  await B2BPortal.deleteMany({});
}

// ============================================
// LIFECYCLE
// ============================================

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  conn = await mongoose.createConnection(mongod.getUri()).asPromise();
}, 30000);

afterAll(async () => {
  await conn.dropDatabase();
  await conn.close();
  await mongod.stop();
});

beforeEach(async () => {
  await clean();
  vi.clearAllMocks();
  // Re-apply the auth mock after clearAllMocks
  const { requireTenantAuth } = await import("@/lib/auth/tenant-auth");
  vi.mocked(requireTenantAuth).mockResolvedValue({
    success: true,
    tenantId: TEST_TENANT,
    tenantDb: TEST_DB,
    userId: "test-user",
    authMethod: "session",
  });
});

// ============================================
// GET /api/b2b/b2b/portals
// ============================================

describe("GET /api/b2b/b2b/portals", () => {
  it("returns an empty list when no portals exist", async () => {
    const req = buildAuthedRequest("GET", `/api/b2b/b2b/portals`, TEST_TENANT);
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.pagination.total).toBe(0);
  });

  it("returns portals after one is created", async () => {
    const { B2BPortal } = await connectWithModels(TEST_DB);
    await B2BPortal.create({ slug: "default", name: "Main", channel: "default" });

    const req = buildAuthedRequest("GET", `/api/b2b/b2b/portals`, TEST_TENANT);
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.items[0].slug).toBe("default");
  });
});

// ============================================
// POST /api/b2b/b2b/portals
// ============================================

describe("POST /api/b2b/b2b/portals", () => {
  it("creates a portal", async () => {
    const req = buildAuthedRequest("POST", `/api/b2b/b2b/portals`, TEST_TENANT, {
      name: "Main",
      slug: "default",
      channel: "default",
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.data.slug).toBe("default");
  });

  it("returns 400 when name or slug missing", async () => {
    const req = buildAuthedRequest("POST", `/api/b2b/b2b/portals`, TEST_TENANT, {
      name: "",
      slug: "",
      channel: "default",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 409 when slug already exists", async () => {
    const { B2BPortal } = await connectWithModels(TEST_DB);
    await B2BPortal.create({ slug: "default", name: "A", channel: "default" });

    const req = buildAuthedRequest("POST", `/api/b2b/b2b/portals`, TEST_TENANT, {
      name: "B",
      slug: "default",
      channel: "default",
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});
