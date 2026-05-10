import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

// ============================================
// IN-MEMORY DB SETUP
// ============================================

let mongod: MongoMemoryServer;
let tenantConn: mongoose.Connection;

const TEST_TENANT = "home-tpl-get-test";
const TEST_DB = `vinc-${TEST_TENANT}`;

// Mock connection-pool so connectWithModels uses tenantConn
vi.mock("@/lib/db/connection-pool", () => ({
  getPooledConnection: vi.fn(async () => tenantConn),
}));

// Mock build-guard
vi.mock("@/lib/db/build-guard", () => ({
  assertNotBuildPhase: vi.fn(),
}));

// Mock requireTenantAuth to always succeed with the test tenant
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

// Import modules AFTER mocks are set up
const { connectWithModels } = await import("@/lib/db/connection");
const { GET } = await import("@/app/api/b2b/b2b/portals/[slug]/home-template/route");

import { buildAuthedRequest } from "@/test/helpers/auth";

const ctx = { params: Promise.resolve({ slug: "default" }) };

// ============================================
// LIFECYCLE
// ============================================

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  tenantConn = await mongoose.createConnection(uri, { dbName: TEST_DB }).asPromise();
}, 30000);

afterAll(async () => {
  await tenantConn.dropDatabase();
  await tenantConn.close();
  await mongod.stop();
});

beforeEach(async () => {
  const { HomeTemplate } = await connectWithModels(TEST_DB);
  await HomeTemplate.deleteMany({});

  vi.clearAllMocks();

  // Re-apply mocks after clearAllMocks
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
// GET /api/b2b/b2b/portals/[slug]/home-template
// ============================================

describe("GET /api/b2b/b2b/portals/[slug]/home-template", () => {
  it("returns an empty template when none exist", async () => {
    const req = buildAuthedRequest("GET", `/api/b2b/b2b/portals/default/home-template`, TEST_TENANT);
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.versions).toEqual([]);
    expect(body.slug).toBe("home");
    expect(body.name).toBe("Home Page");
    expect(body.currentVersion).toBe(0);
    expect(body.currentPublishedVersion).toBeNull();
  });

  it("returns only versions for the requested portal_slug", async () => {
    const { HomeTemplate } = await connectWithModels(TEST_DB);
    await HomeTemplate.create({
      templateId: "home",
      name: "Home",
      portal_slug: "default",
      version: 1,
      blocks: [],
      isCurrent: true,
      isCurrentPublished: false,
      createdAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
    });
    await HomeTemplate.create({
      templateId: "home",
      name: "Home",
      portal_slug: "beta",
      version: 1,
      blocks: [],
      createdAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
    });

    const req = buildAuthedRequest("GET", `/api/b2b/b2b/portals/default/home-template`, TEST_TENANT);
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.versions.length).toBe(1);
    expect(body.versions[0].version).toBe(1);
    expect(body.versions[0].portal_slug).toBe("default");
  });

  it("returns 401 when not authenticated", async () => {
    const { requireTenantAuth } = await import("@/lib/auth/tenant-auth");
    vi.mocked(requireTenantAuth).mockResolvedValue({
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as any);

    const req = buildAuthedRequest("GET", `/api/b2b/b2b/portals/default/home-template`, TEST_TENANT);
    const res = await GET(req, ctx);
    expect(res.status).toBe(401);
  });

  it("uses the portal_slug from URL params, not a hardcoded default", async () => {
    const { HomeTemplate } = await connectWithModels(TEST_DB);
    await HomeTemplate.create({
      templateId: "home",
      name: "Home",
      portal_slug: "beta",
      version: 2,
      blocks: [],
      isCurrent: true,
      createdAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
    });

    const betaCtx = { params: Promise.resolve({ slug: "beta" }) };
    const req = buildAuthedRequest("GET", `/api/b2b/b2b/portals/beta/home-template`, TEST_TENANT);
    const res = await GET(req, betaCtx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.versions.length).toBe(1);
    expect(body.versions[0].version).toBe(2);
    expect(body.currentVersion).toBe(2);
  });
});
