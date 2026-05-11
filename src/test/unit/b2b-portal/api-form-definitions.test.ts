import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { TenantSchema } from "@/lib/db/models/admin-tenant";
import { buildAuthedRequest } from "@/test/helpers/auth";

// ============================================
// IN-MEMORY DB SETUP — two connections:
//   - adminConn: for the Tenant model (migration flag)
//   - tenantConn: for B2BFormDefinition
// ============================================

let mongod: MongoMemoryServer;
let tenantConn: mongoose.Connection;
let adminConn: mongoose.Connection;
let TenantModel: mongoose.Model<any>;

const TEST_TENANT = "api-form-defs-test";
const TEST_DB = `vinc-${TEST_TENANT}`;
const PORTAL_SLUG = "default";

// Mock connection-pool so connectWithModels uses tenantConn
vi.mock("@/lib/db/connection-pool", () => ({
  getPooledConnection: vi.fn(async () => tenantConn),
}));

// Mock build-guard
vi.mock("@/lib/db/build-guard", () => ({
  assertNotBuildPhase: vi.fn(),
}));

// Mock getTenantModel to use adminConn in-memory Tenant model
vi.mock("@/lib/db/models/admin-tenant", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/db/models/admin-tenant")>();
  return {
    ...original,
    getTenantModel: vi.fn(async () => TenantModel),
  };
});

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
const { GET: listDefsRoute, POST: createDefRoute } = await import(
  "@/app/api/b2b/b2b/portals/[slug]/form-definitions/route"
);
const {
  GET: getDefRoute,
  PUT: updateDefRoute,
  DELETE: deleteDefRoute,
} = await import(
  "@/app/api/b2b/b2b/portals/[slug]/form-definitions/[defSlug]/route"
);
const {
  markTenantMigrated,
  clearTenantMigrationFlag,
} = await import("@/lib/services/b2b-portal-migration-flag.service");

const listCtx = { params: Promise.resolve({ slug: PORTAL_SLUG }) };

// ============================================
// LIFECYCLE
// ============================================

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  tenantConn = await mongoose.createConnection(uri, { dbName: TEST_DB }).asPromise();
  adminConn = await mongoose.createConnection(uri, { dbName: "vinc-admin-form-defs-test" }).asPromise();
  TenantModel = adminConn.model("Tenant", TenantSchema);

  // Seed tenant record
  await TenantModel.create({
    tenant_id: TEST_TENANT,
    name: "Form Defs Test Tenant",
    status: "active",
    admin_email: "formdefs@example.com",
    solr_core: `vinc-${TEST_TENANT}`,
    mongo_db: TEST_DB,
    created_by: "test",
    domains: [],
    b2b_portal_migrated_at: null,
  });

  // Ensure indexes are built before running tests
  const { B2BFormDefinition } = await connectWithModels(TEST_DB);
  await B2BFormDefinition.init();
}, 30000);

afterAll(async () => {
  await tenantConn.dropDatabase();
  await adminConn.dropDatabase();
  await tenantConn.close();
  await adminConn.close();
  await mongod.stop();
});

beforeEach(async () => {
  const { B2BFormDefinition } = await connectWithModels(TEST_DB);
  await B2BFormDefinition.deleteMany({});
  await clearTenantMigrationFlag(TEST_TENANT);

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

  const { getTenantModel } = await import("@/lib/db/models/admin-tenant");
  vi.mocked(getTenantModel).mockResolvedValue(TenantModel);
});

// ============================================
// GET /api/b2b/b2b/portals/[slug]/form-definitions
// ============================================

describe("GET /api/b2b/b2b/portals/[slug]/form-definitions", () => {
  it("returns empty list when no definitions exist", async () => {
    const req = buildAuthedRequest(
      "GET",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/form-definitions`,
      TEST_TENANT
    );
    const res = await listDefsRoute(req, listCtx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toEqual([]);
    expect(body.data.pagination.total).toBe(0);
  });

  it("sorts system definitions first, then by created_at descending", async () => {
    const { B2BFormDefinition } = await connectWithModels(TEST_DB);
    const t1 = new Date("2024-01-01T10:00:00Z");
    const t2 = new Date("2024-01-02T10:00:00Z");
    // Non-system created first
    await B2BFormDefinition.create({
      portal_slug: PORTAL_SLUG,
      slug: "contact",
      name: "Contact Form",
      config: { variant: "form", fields: [] },
      is_system: false,
      enabled: true,
      created_at: t1,
    });
    // System definition created later
    await B2BFormDefinition.create({
      portal_slug: PORTAL_SLUG,
      slug: "order-note",
      name: "Order Note",
      config: { variant: "form", fields: [] },
      is_system: true,
      enabled: true,
      created_at: t2,
    });

    const req = buildAuthedRequest(
      "GET",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/form-definitions`,
      TEST_TENANT
    );
    const res = await listDefsRoute(req, listCtx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(2);
    // System definition must come first regardless of created_at
    expect(body.data.items[0].is_system).toBe(true);
    expect(body.data.items[0].slug).toBe("order-note");
    expect(body.data.items[1].is_system).toBe(false);
    expect(body.data.items[1].slug).toBe("contact");
  });

  it("paginates results", async () => {
    const { B2BFormDefinition } = await connectWithModels(TEST_DB);
    for (let i = 0; i < 5; i++) {
      await B2BFormDefinition.create({
        portal_slug: PORTAL_SLUG,
        slug: `form-${i}`,
        name: `Form ${i}`,
        config: { variant: "form", fields: [] },
        is_system: false,
        enabled: true,
      });
    }

    const req = buildAuthedRequest(
      "GET",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/form-definitions?page=1&limit=3`,
      TEST_TENANT
    );
    const res = await listDefsRoute(req, listCtx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(3);
    expect(body.data.pagination.total).toBe(5);
    expect(body.data.pagination.totalPages).toBe(2);
  });

  it("does not return definitions from other portals", async () => {
    const { B2BFormDefinition } = await connectWithModels(TEST_DB);
    await B2BFormDefinition.create({
      portal_slug: PORTAL_SLUG,
      slug: "my-form",
      name: "My Form",
      config: { variant: "form", fields: [] },
      is_system: false,
      enabled: true,
    });
    await B2BFormDefinition.create({
      portal_slug: "other-portal",
      slug: "other-form",
      name: "Other Form",
      config: { variant: "form", fields: [] },
      is_system: false,
      enabled: true,
    });

    const req = buildAuthedRequest(
      "GET",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/form-definitions`,
      TEST_TENANT
    );
    const res = await listDefsRoute(req, listCtx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].portal_slug).toBe(PORTAL_SLUG);
  });

  it("returns 401 when not authenticated", async () => {
    const { requireTenantAuth } = await import("@/lib/auth/tenant-auth");
    vi.mocked(requireTenantAuth).mockResolvedValue({
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as any);

    const req = buildAuthedRequest(
      "GET",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/form-definitions`,
      TEST_TENANT
    );
    const res = await listDefsRoute(req, listCtx);
    expect(res.status).toBe(401);
  });
});

// ============================================
// POST /api/b2b/b2b/portals/[slug]/form-definitions
// ============================================

describe("POST /api/b2b/b2b/portals/[slug]/form-definitions", () => {
  it("returns 409 NOT_MIGRATED when tenant is not migrated", async () => {
    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/form-definitions`,
      TEST_TENANT,
      { name: "Contact Form" }
    );
    const res = await createDefRoute(req, listCtx);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NOT_MIGRATED");
  });

  it("returns 400 when name is missing", async () => {
    await markTenantMigrated(TEST_TENANT);
    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/form-definitions`,
      TEST_TENANT,
      { slug: "contact" }
    );
    const res = await createDefRoute(req, listCtx);
    expect(res.status).toBe(400);
  });

  it("creates a definition and returns 201 with auto-generated slug", async () => {
    await markTenantMigrated(TEST_TENANT);
    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/form-definitions`,
      TEST_TENANT,
      { name: "Contact Form" }
    );
    const res = await createDefRoute(req, listCtx);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    // Slug auto-generated from name
    expect(body.data.slug).toBe("contact-form");
    expect(body.data.name).toBe("Contact Form");
    expect(body.data.portal_slug).toBe(PORTAL_SLUG);
  });

  it("uses provided slug when given", async () => {
    await markTenantMigrated(TEST_TENANT);
    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/form-definitions`,
      TEST_TENANT,
      { name: "My Form", slug: "custom-slug" }
    );
    const res = await createDefRoute(req, listCtx);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.data.slug).toBe("custom-slug");
  });

  it("sets is_system to false on created document", async () => {
    await markTenantMigrated(TEST_TENANT);
    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/form-definitions`,
      TEST_TENANT,
      { name: "Newsletter" }
    );
    const res = await createDefRoute(req, listCtx);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.data.is_system).toBe(false);
  });

  it("returns 409 on duplicate slug within the same portal", async () => {
    await markTenantMigrated(TEST_TENANT);
    const { B2BFormDefinition } = await connectWithModels(TEST_DB);
    await B2BFormDefinition.create({
      portal_slug: PORTAL_SLUG,
      slug: "contact-form",
      name: "Existing Contact",
      config: { variant: "form", fields: [] },
      is_system: false,
      enabled: true,
    });

    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/form-definitions`,
      TEST_TENANT,
      { name: "Contact Form" }
    );
    const res = await createDefRoute(req, listCtx);
    expect(res.status).toBe(409);
  });

  it("allows same slug in a different portal", async () => {
    await markTenantMigrated(TEST_TENANT);
    const { B2BFormDefinition } = await connectWithModels(TEST_DB);
    await B2BFormDefinition.create({
      portal_slug: "other-portal",
      slug: "contact-form",
      name: "Contact Form",
      config: { variant: "form", fields: [] },
      is_system: false,
      enabled: true,
    });

    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/form-definitions`,
      TEST_TENANT,
      { name: "Contact Form" }
    );
    const res = await createDefRoute(req, listCtx);
    expect(res.status).toBe(201);
  });

  it("returns 401 when not authenticated", async () => {
    const { requireTenantAuth } = await import("@/lib/auth/tenant-auth");
    vi.mocked(requireTenantAuth).mockResolvedValue({
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as any);

    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/form-definitions`,
      TEST_TENANT,
      { name: "Contact Form" }
    );
    const res = await createDefRoute(req, listCtx);
    expect(res.status).toBe(401);
  });
});

// ============================================
// GET /api/b2b/b2b/portals/[slug]/form-definitions/[defSlug]
// ============================================

describe("GET /api/b2b/b2b/portals/[slug]/form-definitions/[defSlug]", () => {
  it("returns 404 when definition does not exist", async () => {
    const ctx = { params: Promise.resolve({ slug: PORTAL_SLUG, defSlug: "nonexistent" }) };
    const req = buildAuthedRequest(
      "GET",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/form-definitions/nonexistent`,
      TEST_TENANT
    );
    const res = await getDefRoute(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns the definition when it exists", async () => {
    const { B2BFormDefinition } = await connectWithModels(TEST_DB);
    await B2BFormDefinition.create({
      portal_slug: PORTAL_SLUG,
      slug: "newsletter",
      name: "Newsletter Signup",
      config: { variant: "form", fields: [] },
      is_system: false,
      enabled: true,
    });

    const ctx = { params: Promise.resolve({ slug: PORTAL_SLUG, defSlug: "newsletter" }) };
    const req = buildAuthedRequest(
      "GET",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/form-definitions/newsletter`,
      TEST_TENANT
    );
    const res = await getDefRoute(req, ctx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.slug).toBe("newsletter");
    expect(body.data.portal_slug).toBe(PORTAL_SLUG);
  });

  it("returns 401 when not authenticated", async () => {
    const { requireTenantAuth } = await import("@/lib/auth/tenant-auth");
    vi.mocked(requireTenantAuth).mockResolvedValue({
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as any);

    const ctx = { params: Promise.resolve({ slug: PORTAL_SLUG, defSlug: "newsletter" }) };
    const req = buildAuthedRequest(
      "GET",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/form-definitions/newsletter`,
      TEST_TENANT
    );
    const res = await getDefRoute(req, ctx);
    expect(res.status).toBe(401);
  });
});

// ============================================
// PUT /api/b2b/b2b/portals/[slug]/form-definitions/[defSlug]
// ============================================

describe("PUT /api/b2b/b2b/portals/[slug]/form-definitions/[defSlug]", () => {
  it("returns 409 NOT_MIGRATED when tenant is not migrated", async () => {
    const { B2BFormDefinition } = await connectWithModels(TEST_DB);
    await B2BFormDefinition.create({
      portal_slug: PORTAL_SLUG,
      slug: "contact",
      name: "Contact",
      config: { variant: "form", fields: [] },
      is_system: false,
      enabled: true,
    });

    const ctx = { params: Promise.resolve({ slug: PORTAL_SLUG, defSlug: "contact" }) };
    const req = buildAuthedRequest(
      "PUT",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/form-definitions/contact`,
      TEST_TENANT,
      { name: "Updated Contact" }
    );
    const res = await updateDefRoute(req, ctx);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NOT_MIGRATED");
  });

  it("updates allowed fields after migration", async () => {
    await markTenantMigrated(TEST_TENANT);
    const { B2BFormDefinition } = await connectWithModels(TEST_DB);
    await B2BFormDefinition.create({
      portal_slug: PORTAL_SLUG,
      slug: "contact",
      name: "Contact",
      config: { variant: "form", fields: [] },
      notification_emails: [],
      send_submitter_copy: false,
      is_system: false,
      enabled: true,
    });

    const ctx = { params: Promise.resolve({ slug: PORTAL_SLUG, defSlug: "contact" }) };
    const req = buildAuthedRequest(
      "PUT",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/form-definitions/contact`,
      TEST_TENANT,
      {
        name: "Updated Contact",
        notification_emails: ["admin@example.com"],
        send_submitter_copy: true,
        enabled: false,
      }
    );
    const res = await updateDefRoute(req, ctx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.name).toBe("Updated Contact");
    expect(body.data.notification_emails).toEqual(["admin@example.com"]);
    expect(body.data.send_submitter_copy).toBe(true);
    expect(body.data.enabled).toBe(false);
  });

  it("does not allow modifying is_system via PUT", async () => {
    await markTenantMigrated(TEST_TENANT);
    const { B2BFormDefinition } = await connectWithModels(TEST_DB);
    await B2BFormDefinition.create({
      portal_slug: PORTAL_SLUG,
      slug: "my-form",
      name: "My Form",
      config: { variant: "form", fields: [] },
      is_system: false,
      enabled: true,
    });

    const ctx = { params: Promise.resolve({ slug: PORTAL_SLUG, defSlug: "my-form" }) };
    const req = buildAuthedRequest(
      "PUT",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/form-definitions/my-form`,
      TEST_TENANT,
      { is_system: true, name: "My Form Updated" }
    );
    const res = await updateDefRoute(req, ctx);
    const body = await res.json();
    expect(res.status).toBe(200);
    // is_system must remain false — the route ignores it
    expect(body.data.is_system).toBe(false);
  });

  it("returns 404 when definition does not exist (migrated)", async () => {
    await markTenantMigrated(TEST_TENANT);
    const ctx = { params: Promise.resolve({ slug: PORTAL_SLUG, defSlug: "nonexistent" }) };
    const req = buildAuthedRequest(
      "PUT",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/form-definitions/nonexistent`,
      TEST_TENANT,
      { name: "Updated" }
    );
    const res = await updateDefRoute(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 401 when not authenticated", async () => {
    const { requireTenantAuth } = await import("@/lib/auth/tenant-auth");
    vi.mocked(requireTenantAuth).mockResolvedValue({
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as any);

    const ctx = { params: Promise.resolve({ slug: PORTAL_SLUG, defSlug: "contact" }) };
    const req = buildAuthedRequest(
      "PUT",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/form-definitions/contact`,
      TEST_TENANT,
      { name: "Updated" }
    );
    const res = await updateDefRoute(req, ctx);
    expect(res.status).toBe(401);
  });
});

// ============================================
// DELETE /api/b2b/b2b/portals/[slug]/form-definitions/[defSlug]
// ============================================

describe("DELETE /api/b2b/b2b/portals/[slug]/form-definitions/[defSlug]", () => {
  it("returns 409 NOT_MIGRATED when tenant is not migrated", async () => {
    const { B2BFormDefinition } = await connectWithModels(TEST_DB);
    await B2BFormDefinition.create({
      portal_slug: PORTAL_SLUG,
      slug: "contact",
      name: "Contact",
      config: { variant: "form", fields: [] },
      is_system: false,
      enabled: true,
    });

    const ctx = { params: Promise.resolve({ slug: PORTAL_SLUG, defSlug: "contact" }) };
    const req = buildAuthedRequest(
      "DELETE",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/form-definitions/contact`,
      TEST_TENANT
    );
    const res = await deleteDefRoute(req, ctx);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NOT_MIGRATED");
  });

  it("returns 403 when trying to delete a system definition", async () => {
    await markTenantMigrated(TEST_TENANT);
    const { B2BFormDefinition } = await connectWithModels(TEST_DB);
    // Seed a system definition directly via model (bypassing the POST route)
    await B2BFormDefinition.create({
      portal_slug: PORTAL_SLUG,
      slug: "order-note",
      name: "Order Note",
      config: { variant: "form", fields: [] },
      is_system: true,
      enabled: true,
    });

    const ctx = { params: Promise.resolve({ slug: PORTAL_SLUG, defSlug: "order-note" }) };
    const req = buildAuthedRequest(
      "DELETE",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/form-definitions/order-note`,
      TEST_TENANT
    );
    const res = await deleteDefRoute(req, ctx);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/system/i);
  });

  it("deletes a non-system definition after migration", async () => {
    await markTenantMigrated(TEST_TENANT);
    const { B2BFormDefinition } = await connectWithModels(TEST_DB);
    await B2BFormDefinition.create({
      portal_slug: PORTAL_SLUG,
      slug: "feedback",
      name: "Feedback",
      config: { variant: "form", fields: [] },
      is_system: false,
      enabled: true,
    });

    const ctx = { params: Promise.resolve({ slug: PORTAL_SLUG, defSlug: "feedback" }) };
    const req = buildAuthedRequest(
      "DELETE",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/form-definitions/feedback`,
      TEST_TENANT
    );
    const res = await deleteDefRoute(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify removed from DB
    const gone = await B2BFormDefinition.findOne({ portal_slug: PORTAL_SLUG, slug: "feedback" }).lean();
    expect(gone).toBeNull();
  });

  it("returns 404 when definition does not exist (migrated)", async () => {
    await markTenantMigrated(TEST_TENANT);
    const ctx = { params: Promise.resolve({ slug: PORTAL_SLUG, defSlug: "nonexistent" }) };
    const req = buildAuthedRequest(
      "DELETE",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/form-definitions/nonexistent`,
      TEST_TENANT
    );
    const res = await deleteDefRoute(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 401 when not authenticated", async () => {
    const { requireTenantAuth } = await import("@/lib/auth/tenant-auth");
    vi.mocked(requireTenantAuth).mockResolvedValue({
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as any);

    const ctx = { params: Promise.resolve({ slug: PORTAL_SLUG, defSlug: "contact" }) };
    const req = buildAuthedRequest(
      "DELETE",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/form-definitions/contact`,
      TEST_TENANT
    );
    const res = await deleteDefRoute(req, ctx);
    expect(res.status).toBe(401);
  });
});
