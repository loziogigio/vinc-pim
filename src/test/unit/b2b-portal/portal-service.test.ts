import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
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

// Import connectWithModels and service AFTER mocks are set up
const { connectWithModels } = await import("@/lib/db/connection");
const {
  listPortals,
  getPortalBySlug,
  createPortal,
  updatePortal,
  deletePortal,
} = await import("@/lib/services/b2b-portal.service");
import { DEFAULT_PORTAL_SLUG } from "@/lib/types/b2b-portal";

const TEST_DB = "vinc-portal-service-test";

async function clean() {
  const { B2BPortal, HomeSettings } = await connectWithModels(TEST_DB);
  await B2BPortal.deleteMany({});
  await HomeSettings.deleteMany({});
}

describe("b2b-portal.service", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    conn = await mongoose.createConnection(mongod.getUri()).asPromise();
  }, 30000);

  afterAll(async () => {
    await conn.dropDatabase();
    await conn.close();
    await mongod.stop();
  });

  beforeEach(clean);

  it("createPortal inserts a new portal", async () => {
    const p = await createPortal(TEST_DB, {
      slug: "default",
      name: "Main",
      channel: "default",
    });
    expect(p.slug).toBe("default");
  });

  it("createPortal rejects duplicate slug with 'already exists'", async () => {
    await createPortal(TEST_DB, { slug: "default", name: "A", channel: "default" });
    await expect(
      createPortal(TEST_DB, { slug: "default", name: "B", channel: "default" }),
    ).rejects.toThrow(/already exists/i);
  });

  it("listPortals paginates", async () => {
    await createPortal(TEST_DB, { slug: "default", name: "A", channel: "a" });
    const result = await listPortals(TEST_DB, { page: 1, limit: 10 });
    expect(result.items.length).toBe(1);
    expect(result.pagination.total).toBe(1);
  });

  it("getPortalBySlug returns a portal when present", async () => {
    await createPortal(TEST_DB, { slug: "default", name: "A", channel: "default" });
    const p = await getPortalBySlug(TEST_DB, "default", "Tenant");
    expect(p?.slug).toBe("default");
    expect((p as any)?.synthesized).toBeUndefined();
  });

  it("getPortalBySlug synthesizes from homesettings when b2bportals is empty", async () => {
    const { HomeSettings } = await connectWithModels(TEST_DB);
    await HomeSettings.create({
      customerId: "test-synth-customer",
      branding: { title: "Synth" },
      header_config: { rows: [] },
      footer: {},
      meta_tags: {},
      custom_scripts: [],
    });

    const p = await getPortalBySlug(TEST_DB, DEFAULT_PORTAL_SLUG, "Tenant");
    expect(p?.slug).toBe(DEFAULT_PORTAL_SLUG);
    expect(p?.branding.title).toBe("Synth");
    expect((p as any)?.synthesized).toBe(true);
  });

  it("getPortalBySlug returns null when nothing exists", async () => {
    const p = await getPortalBySlug(TEST_DB, "default", "Tenant");
    expect(p).toBeNull();
  });

  it("getPortalBySlug returns null for non-default slug when no portal exists", async () => {
    const p = await getPortalBySlug(TEST_DB, "other-slug", "Tenant");
    expect(p).toBeNull();
  });

  it("updatePortal patches fields", async () => {
    await createPortal(TEST_DB, { slug: "default", name: "Old", channel: "default" });
    const p = await updatePortal(TEST_DB, "default", { name: "New" });
    expect(p?.name).toBe("New");
  });

  it("deletePortal removes the row", async () => {
    await createPortal(TEST_DB, { slug: "default", name: "X", channel: "default" });
    await deletePortal(TEST_DB, "default");
    const p = await getPortalBySlug(TEST_DB, "default", "Tenant");
    expect(p).toBeNull();
  });
});
