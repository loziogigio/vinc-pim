/**
 * Customer Tag E2E Integration Tests
 *
 * Tests the full tag lifecycle through API routes:
 * - Tag CRUD (create, list, filter by prefix)
 * - Customer tag assignment (PUT/DELETE/GET)
 * - Address tag overrides (PUT/DELETE/GET with effective tag resolution)
 * - Duplicate tag rejection
 * - Validation (prefix/code format)
 *
 * Uses in-memory MongoDB with direct route handler invocation.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
  createParams,
} from "../conftest";

// ============================================
// MOCKS (must be at module level, before imports)
// ============================================

vi.mock("@/lib/db/connection", async () => {
  const { CustomerModel } = await import("@/lib/db/models/customer");
  const { OrderModel } = await import("@/lib/db/models/order");
  const { CustomerTagModel } = await import("@/lib/db/models/customer-tag");
  const mongoose = await import("mongoose");
  return {
    connectToDatabase: vi.fn(() => Promise.resolve()),
    connectWithModels: vi.fn(() =>
      Promise.resolve({
        Customer: CustomerModel,
        Order: OrderModel,
        CustomerTag: CustomerTagModel,
      })
    ),
    getPooledConnection: vi.fn(() => Promise.resolve(mongoose.default.connection)),
  };
});

vi.mock("@/lib/auth/b2b-session", () => ({
  getB2BSession: vi.fn(() =>
    Promise.resolve({
      isLoggedIn: true,
      userId: "test-user",
      tenantId: "test-tenant",
    })
  ),
}));

vi.mock("@/lib/auth/api-key-auth", () => ({
  verifyAPIKeyFromRequest: vi.fn(() =>
    Promise.resolve({
      authenticated: true,
      tenantId: "test-tenant",
      tenantDb: "vinc-test-tenant",
    })
  ),
}));

vi.mock("@/lib/auth/portal-user-token", () => ({
  getPortalUserFromRequest: vi.fn(() => Promise.resolve(null)),
  getAccessibleCustomerIds: vi.fn(() => Promise.resolve(null)),
  hasCustomerAccess: vi.fn(() => true),
}));

// Mock counter model — getNextCartNumber uses connection-pool internally
let cartNumberCounter = 0;
vi.mock("@/lib/db/models/counter", () => ({
  getNextCartNumber: vi.fn(() => Promise.resolve(++cartNumberCounter)),
  getNextOrderNumber: vi.fn(() => Promise.resolve(1)),
  getNextCustomerPublicCode: vi.fn(() => Promise.resolve("C-00001")),
}));

// ============================================
// IMPORTS (after mocks)
// ============================================

import {
  GET as listTags,
  POST as createTag,
} from "@/app/api/b2b/customer-tags/route";
import {
  GET as getCustomerTags,
  PUT as assignCustomerTag,
  DELETE as removeCustomerTag,
} from "@/app/api/b2b/customers/[id]/tags/route";
import {
  GET as getAddressTags,
  PUT as assignAddressTag,
  DELETE as removeAddressTag,
} from "@/app/api/b2b/customers/[id]/addresses/[address_id]/tags/route";
import { POST as createActiveCart } from "@/app/api/b2b/cart/active/route";
import { CustomerModel } from "@/lib/db/models/customer";
import { CustomerTagModel } from "@/lib/db/models/customer-tag";
import { OrderModel } from "@/lib/db/models/order";

// ============================================
// HELPERS
// ============================================

function makeReq(
  method: string,
  url: string,
  body?: unknown
): NextRequest {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "Content-Type": "application/json" } : undefined,
  });
}

async function seedTag(prefix: string, code: string, description: string) {
  const req = makeReq("POST", "http://localhost/api/b2b/customer-tags", {
    prefix,
    code,
    description,
  });
  const res = await createTag(req);
  return res.json();
}

async function seedCustomerWithAddresses() {
  return CustomerModel.create({
    customer_id: "cust-tag-test",
    tenant_id: "test-tenant",
    customer_type: "business",
    email: "tag-test@example.com",
    company_name: "Tag Test Company",
    tags: [],
    addresses: [
      {
        address_id: "addr-main",
        address_type: "delivery",
        recipient_name: "Main Warehouse",
        street_address: "Via Roma 1",
        city: "Milano",
        province: "MI",
        postal_code: "20100",
        country: "IT",
        is_default: true,
        tag_overrides: [],
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        address_id: "addr-branch",
        address_type: "delivery",
        recipient_name: "Branch Office",
        street_address: "Via Napoli 5",
        city: "Napoli",
        province: "NA",
        postal_code: "80100",
        country: "IT",
        is_default: false,
        tag_overrides: [],
        created_at: new Date(),
        updated_at: new Date(),
      },
    ],
    default_shipping_address_id: "addr-main",
  });
}

// ============================================
// TESTS
// ============================================

describe("integration: Customer Tags E2E", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    cartNumberCounter = 0;
  });

  // ============================================
  // TAG CRUD
  // ============================================

  describe("POST /api/b2b/customer-tags — Create Tag", () => {
    it("should create a new customer tag", async () => {
      const res = await createTag(
        makeReq("POST", "http://localhost/api/b2b/customer-tags", {
          prefix: "categoria-di-sconto",
          code: "sconto-45",
          description: "Sconto base 45%",
        })
      );
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.tag.full_tag).toBe("categoria-di-sconto:sconto-45");
      expect(data.tag.tag_id).toMatch(/^ctag_/);
      expect(data.tag.is_active).toBe(true);
    });

    it("should reject duplicate full_tag", async () => {
      await seedTag("categoria-di-sconto", "sconto-45", "Sconto 45%");

      const res = await createTag(
        makeReq("POST", "http://localhost/api/b2b/customer-tags", {
          prefix: "categoria-di-sconto",
          code: "sconto-45",
          description: "Duplicate",
        })
      );
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.error).toContain("already exists");
    });

    it("should reject invalid prefix format", async () => {
      const res = await createTag(
        makeReq("POST", "http://localhost/api/b2b/customer-tags", {
          prefix: "INVALID PREFIX",
          code: "sconto-45",
          description: "Bad prefix",
        })
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("prefix");
    });

    it("should reject invalid code format", async () => {
      const res = await createTag(
        makeReq("POST", "http://localhost/api/b2b/customer-tags", {
          prefix: "categoria-di-sconto",
          code: "INVALID CODE",
          description: "Bad code",
        })
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("code");
    });

    it("should reject missing required fields", async () => {
      const res = await createTag(
        makeReq("POST", "http://localhost/api/b2b/customer-tags", {
          prefix: "test",
        })
      );

      expect(res.status).toBe(400);
    });

    it("should store optional color field", async () => {
      const res = await createTag(
        makeReq("POST", "http://localhost/api/b2b/customer-tags", {
          prefix: "categoria-clienti",
          code: "idraulico",
          description: "Idraulico",
          color: "#3B82F6",
        })
      );
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.tag.color).toBe("#3B82F6");
    });
  });

  describe("GET /api/b2b/customer-tags — List Tags", () => {
    it("should list all active tags", async () => {
      await seedTag("categoria-di-sconto", "sconto-45", "Sconto 45%");
      await seedTag("categoria-di-sconto", "sconto-50", "Sconto 50%");
      await seedTag("categoria-clienti", "idraulico", "Idraulico");

      const res = await listTags(
        makeReq("GET", "http://localhost/api/b2b/customer-tags")
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tags).toHaveLength(3);
    });

    it("should filter by prefix", async () => {
      await seedTag("categoria-di-sconto", "sconto-45", "Sconto 45%");
      await seedTag("categoria-di-sconto", "sconto-50", "Sconto 50%");
      await seedTag("categoria-clienti", "idraulico", "Idraulico");

      const res = await listTags(
        makeReq(
          "GET",
          "http://localhost/api/b2b/customer-tags?prefix=categoria-di-sconto"
        )
      );
      const data = await res.json();

      expect(data.tags).toHaveLength(2);
      expect(data.tags.every((t: { prefix: string }) => t.prefix === "categoria-di-sconto")).toBe(true);
    });

    it("should return empty array when no tags match prefix", async () => {
      await seedTag("categoria-di-sconto", "sconto-45", "Sconto 45%");

      const res = await listTags(
        makeReq("GET", "http://localhost/api/b2b/customer-tags?prefix=nonexistent")
      );
      const data = await res.json();

      expect(data.tags).toHaveLength(0);
    });

    it("should sort by prefix then code", async () => {
      await seedTag("b-prefix", "z-code", "Z");
      await seedTag("a-prefix", "b-code", "B");
      await seedTag("a-prefix", "a-code", "A");

      const res = await listTags(
        makeReq("GET", "http://localhost/api/b2b/customer-tags")
      );
      const data = await res.json();

      expect(data.tags[0].full_tag).toBe("a-prefix:a-code");
      expect(data.tags[1].full_tag).toBe("a-prefix:b-code");
      expect(data.tags[2].full_tag).toBe("b-prefix:z-code");
    });
  });

  // ============================================
  // CUSTOMER TAG ASSIGNMENT
  // ============================================

  describe("Customer-level Tag Assignment", () => {
    it("PUT should assign a tag to a customer", async () => {
      await seedTag("categoria-di-sconto", "sconto-45", "Sconto 45%");
      await seedCustomerWithAddresses();

      const res = await assignCustomerTag(
        makeReq("PUT", "http://localhost/api/b2b/customers/cust-tag-test/tags", {
          full_tag: "categoria-di-sconto:sconto-45",
        }),
        createParams({ id: "cust-tag-test" })
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tags).toHaveLength(1);
      expect(data.tags[0].full_tag).toBe("categoria-di-sconto:sconto-45");
      expect(data.tags[0].prefix).toBe("categoria-di-sconto");
      expect(data.tags[0].code).toBe("sconto-45");
    });

    it("PUT should reject assigning nonexistent tag", async () => {
      await seedCustomerWithAddresses();

      const res = await assignCustomerTag(
        makeReq("PUT", "http://localhost/api/b2b/customers/cust-tag-test/tags", {
          full_tag: "nonexistent:tag",
        }),
        createParams({ id: "cust-tag-test" })
      );

      expect(res.status).toBe(404);
    });

    it("PUT should allow multiple tags from different prefixes", async () => {
      await seedTag("categoria-di-sconto", "sconto-45", "Sconto 45%");
      await seedTag("categoria-clienti", "idraulico", "Idraulico");
      await seedCustomerWithAddresses();

      await assignCustomerTag(
        makeReq("PUT", "http://localhost/api/b2b/customers/cust-tag-test/tags", {
          full_tag: "categoria-di-sconto:sconto-45",
        }),
        createParams({ id: "cust-tag-test" })
      );

      const res = await assignCustomerTag(
        makeReq("PUT", "http://localhost/api/b2b/customers/cust-tag-test/tags", {
          full_tag: "categoria-clienti:idraulico",
        }),
        createParams({ id: "cust-tag-test" })
      );
      const data = await res.json();

      expect(data.tags).toHaveLength(2);
    });

    it("GET should return customer tags", async () => {
      await seedTag("categoria-di-sconto", "sconto-45", "Sconto 45%");
      await seedCustomerWithAddresses();

      await assignCustomerTag(
        makeReq("PUT", "http://localhost/api/b2b/customers/cust-tag-test/tags", {
          full_tag: "categoria-di-sconto:sconto-45",
        }),
        createParams({ id: "cust-tag-test" })
      );

      const res = await getCustomerTags(
        makeReq("GET", "http://localhost/api/b2b/customers/cust-tag-test/tags"),
        createParams({ id: "cust-tag-test" })
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.tags).toHaveLength(1);
      expect(data.tags[0].full_tag).toBe("categoria-di-sconto:sconto-45");
    });

    it("DELETE should remove a tag from customer", async () => {
      await seedTag("categoria-di-sconto", "sconto-45", "Sconto 45%");
      await seedTag("categoria-clienti", "idraulico", "Idraulico");
      await seedCustomerWithAddresses();

      // Assign two tags
      await assignCustomerTag(
        makeReq("PUT", "http://localhost/api/b2b/customers/cust-tag-test/tags", {
          full_tag: "categoria-di-sconto:sconto-45",
        }),
        createParams({ id: "cust-tag-test" })
      );
      await assignCustomerTag(
        makeReq("PUT", "http://localhost/api/b2b/customers/cust-tag-test/tags", {
          full_tag: "categoria-clienti:idraulico",
        }),
        createParams({ id: "cust-tag-test" })
      );

      // Remove one
      const res = await removeCustomerTag(
        makeReq("DELETE", "http://localhost/api/b2b/customers/cust-tag-test/tags", {
          full_tag: "categoria-di-sconto:sconto-45",
        }),
        createParams({ id: "cust-tag-test" })
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.tags).toHaveLength(1);
      expect(data.tags[0].full_tag).toBe("categoria-clienti:idraulico");
    });

    it("should return 404 for nonexistent customer", async () => {
      const res = await getCustomerTags(
        makeReq("GET", "http://localhost/api/b2b/customers/nonexistent/tags"),
        createParams({ id: "nonexistent" })
      );

      expect(res.status).toBe(404);
    });
  });

  // ============================================
  // ADDRESS TAG OVERRIDES
  // ============================================

  describe("Address-level Tag Overrides", () => {
    it("PUT should assign a tag override to an address", async () => {
      await seedTag("categoria-di-sconto", "sconto-50", "Sconto 50%");
      await seedCustomerWithAddresses();

      const res = await assignAddressTag(
        makeReq(
          "PUT",
          "http://localhost/api/b2b/customers/cust-tag-test/addresses/addr-branch/tags",
          { full_tag: "categoria-di-sconto:sconto-50" }
        ),
        createParams({ id: "cust-tag-test", address_id: "addr-branch" })
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.address_overrides).toHaveLength(1);
      expect(data.address_overrides[0].full_tag).toBe("categoria-di-sconto:sconto-50");
    });

    it("GET should return effective tags (customer defaults + address overrides)", async () => {
      await seedTag("categoria-di-sconto", "sconto-45", "Sconto 45%");
      await seedTag("categoria-di-sconto", "sconto-50", "Sconto 50%");
      await seedTag("categoria-clienti", "idraulico", "Idraulico");
      await seedCustomerWithAddresses();

      // Assign customer-level tags
      await assignCustomerTag(
        makeReq("PUT", "http://localhost/api/b2b/customers/cust-tag-test/tags", {
          full_tag: "categoria-di-sconto:sconto-45",
        }),
        createParams({ id: "cust-tag-test" })
      );
      await assignCustomerTag(
        makeReq("PUT", "http://localhost/api/b2b/customers/cust-tag-test/tags", {
          full_tag: "categoria-clienti:idraulico",
        }),
        createParams({ id: "cust-tag-test" })
      );

      // Override sconto on branch address
      await assignAddressTag(
        makeReq(
          "PUT",
          "http://localhost/api/b2b/customers/cust-tag-test/addresses/addr-branch/tags",
          { full_tag: "categoria-di-sconto:sconto-50" }
        ),
        createParams({ id: "cust-tag-test", address_id: "addr-branch" })
      );

      // Check main address — no overrides, customer defaults apply
      const resMain = await getAddressTags(
        makeReq(
          "GET",
          "http://localhost/api/b2b/customers/cust-tag-test/addresses/addr-main/tags"
        ),
        createParams({ id: "cust-tag-test", address_id: "addr-main" })
      );
      const dataMain = await resMain.json();

      expect(dataMain.effective_tags).toContain("categoria-di-sconto:sconto-45");
      expect(dataMain.effective_tags).toContain("categoria-clienti:idraulico");
      expect(dataMain.address_overrides).toHaveLength(0);

      // Check branch address — sconto overridden to 50, clienti kept
      const resBranch = await getAddressTags(
        makeReq(
          "GET",
          "http://localhost/api/b2b/customers/cust-tag-test/addresses/addr-branch/tags"
        ),
        createParams({ id: "cust-tag-test", address_id: "addr-branch" })
      );
      const dataBranch = await resBranch.json();

      expect(dataBranch.effective_tags).toContain("categoria-di-sconto:sconto-50");
      expect(dataBranch.effective_tags).toContain("categoria-clienti:idraulico");
      expect(dataBranch.effective_tags).not.toContain("categoria-di-sconto:sconto-45");
      expect(dataBranch.address_overrides).toHaveLength(1);
    });

    it("DELETE should remove address tag override and restore customer default", async () => {
      await seedTag("categoria-di-sconto", "sconto-45", "Sconto 45%");
      await seedTag("categoria-di-sconto", "sconto-50", "Sconto 50%");
      await seedCustomerWithAddresses();

      // Assign customer tag
      await assignCustomerTag(
        makeReq("PUT", "http://localhost/api/b2b/customers/cust-tag-test/tags", {
          full_tag: "categoria-di-sconto:sconto-45",
        }),
        createParams({ id: "cust-tag-test" })
      );

      // Add address override
      await assignAddressTag(
        makeReq(
          "PUT",
          "http://localhost/api/b2b/customers/cust-tag-test/addresses/addr-branch/tags",
          { full_tag: "categoria-di-sconto:sconto-50" }
        ),
        createParams({ id: "cust-tag-test", address_id: "addr-branch" })
      );

      // Remove override
      const res = await removeAddressTag(
        makeReq(
          "DELETE",
          "http://localhost/api/b2b/customers/cust-tag-test/addresses/addr-branch/tags",
          { full_tag: "categoria-di-sconto:sconto-50" }
        ),
        createParams({ id: "cust-tag-test", address_id: "addr-branch" })
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.address_overrides).toHaveLength(0);
      // Effective tags should fall back to customer defaults
      expect(data.effective_tags).toContain("categoria-di-sconto:sconto-45");
    });

    it("GET should include effective_tags_detailed with source info", async () => {
      await seedTag("categoria-di-sconto", "sconto-45", "Sconto 45%");
      await seedTag("categoria-di-sconto", "sconto-50", "Sconto 50%");
      await seedTag("categoria-clienti", "idraulico", "Idraulico");
      await seedCustomerWithAddresses();

      // Assign customer tags
      await assignCustomerTag(
        makeReq("PUT", "http://localhost/api/b2b/customers/cust-tag-test/tags", {
          full_tag: "categoria-di-sconto:sconto-45",
        }),
        createParams({ id: "cust-tag-test" })
      );
      await assignCustomerTag(
        makeReq("PUT", "http://localhost/api/b2b/customers/cust-tag-test/tags", {
          full_tag: "categoria-clienti:idraulico",
        }),
        createParams({ id: "cust-tag-test" })
      );

      // Override sconto on branch address
      await assignAddressTag(
        makeReq(
          "PUT",
          "http://localhost/api/b2b/customers/cust-tag-test/addresses/addr-branch/tags",
          { full_tag: "categoria-di-sconto:sconto-50" }
        ),
        createParams({ id: "cust-tag-test", address_id: "addr-branch" })
      );

      // Check branch address — should have detailed entries with source
      const res = await getAddressTags(
        makeReq(
          "GET",
          "http://localhost/api/b2b/customers/cust-tag-test/addresses/addr-branch/tags"
        ),
        createParams({ id: "cust-tag-test", address_id: "addr-branch" })
      );
      const data = await res.json();

      // effective_tags should be string[] (backward compat)
      expect(data.effective_tags).toContain("categoria-di-sconto:sconto-50");
      expect(data.effective_tags).toContain("categoria-clienti:idraulico");
      expect(data.effective_tags).not.toContain("categoria-di-sconto:sconto-45");

      // effective_tags_detailed should have source info
      expect(data.effective_tags_detailed).toHaveLength(2);

      const scontoEntry = data.effective_tags_detailed.find(
        (e: any) => e.prefix === "categoria-di-sconto"
      );
      expect(scontoEntry).toBeDefined();
      expect(scontoEntry.source).toBe("address_override");
      expect(scontoEntry.tag.full_tag).toBe("categoria-di-sconto:sconto-50");

      const clientiEntry = data.effective_tags_detailed.find(
        (e: any) => e.prefix === "categoria-clienti"
      );
      expect(clientiEntry).toBeDefined();
      expect(clientiEntry.source).toBe("customer");
      expect(clientiEntry.tag.full_tag).toBe("categoria-clienti:idraulico");
    });

    it("should return 404 for nonexistent address", async () => {
      await seedCustomerWithAddresses();

      const res = await getAddressTags(
        makeReq(
          "GET",
          "http://localhost/api/b2b/customers/cust-tag-test/addresses/nonexistent/tags"
        ),
        createParams({ id: "cust-tag-test", address_id: "nonexistent" })
      );

      expect(res.status).toBe(404);
    });
  });

  // ============================================
  // FULL LIFECYCLE E2E
  // ============================================

  describe("Full Tag Lifecycle — Hidros Scenario", () => {
    it("should support the complete Hidros pricing flow", async () => {
      // 1. Create tag definitions
      await seedTag("categoria-di-sconto", "sconto-45", "Sconto base 45%");
      await seedTag("categoria-di-sconto", "sconto-50", "Sconto base 50%");
      await seedTag("categoria-clienti", "idraulico", "Idraulico");
      await seedTag("categoria-clienti", "ferramenta", "Ferramenta");

      // Verify all tags created
      const listRes = await listTags(
        makeReq("GET", "http://localhost/api/b2b/customer-tags")
      );
      const listData = await listRes.json();
      expect(listData.tags).toHaveLength(4);

      // 2. Create customer with two addresses
      await seedCustomerWithAddresses();

      // 3. Assign default tags to customer (sconto-45 + idraulico)
      await assignCustomerTag(
        makeReq("PUT", "http://localhost/api/b2b/customers/cust-tag-test/tags", {
          full_tag: "categoria-di-sconto:sconto-45",
        }),
        createParams({ id: "cust-tag-test" })
      );
      await assignCustomerTag(
        makeReq("PUT", "http://localhost/api/b2b/customers/cust-tag-test/tags", {
          full_tag: "categoria-clienti:idraulico",
        }),
        createParams({ id: "cust-tag-test" })
      );

      // 4. Override sconto for branch address (sconto-50)
      await assignAddressTag(
        makeReq(
          "PUT",
          "http://localhost/api/b2b/customers/cust-tag-test/addresses/addr-branch/tags",
          { full_tag: "categoria-di-sconto:sconto-50" }
        ),
        createParams({ id: "cust-tag-test", address_id: "addr-branch" })
      );

      // 5. Verify main address gets customer defaults
      const mainRes = await getAddressTags(
        makeReq(
          "GET",
          "http://localhost/api/b2b/customers/cust-tag-test/addresses/addr-main/tags"
        ),
        createParams({ id: "cust-tag-test", address_id: "addr-main" })
      );
      const mainData = await mainRes.json();

      expect(mainData.effective_tags).toEqual(
        expect.arrayContaining([
          "categoria-di-sconto:sconto-45",
          "categoria-clienti:idraulico",
        ])
      );
      expect(mainData.effective_tags).toHaveLength(2);

      // 6. Verify branch address gets overridden sconto but keeps clienti
      const branchRes = await getAddressTags(
        makeReq(
          "GET",
          "http://localhost/api/b2b/customers/cust-tag-test/addresses/addr-branch/tags"
        ),
        createParams({ id: "cust-tag-test", address_id: "addr-branch" })
      );
      const branchData = await branchRes.json();

      expect(branchData.effective_tags).toEqual(
        expect.arrayContaining([
          "categoria-di-sconto:sconto-50",
          "categoria-clienti:idraulico",
        ])
      );
      expect(branchData.effective_tags).not.toContain("categoria-di-sconto:sconto-45");
      expect(branchData.effective_tags).toHaveLength(2);

      // 7. Remove the address override — should fall back to customer default
      await removeAddressTag(
        makeReq(
          "DELETE",
          "http://localhost/api/b2b/customers/cust-tag-test/addresses/addr-branch/tags",
          { full_tag: "categoria-di-sconto:sconto-50" }
        ),
        createParams({ id: "cust-tag-test", address_id: "addr-branch" })
      );

      const branchAfterRes = await getAddressTags(
        makeReq(
          "GET",
          "http://localhost/api/b2b/customers/cust-tag-test/addresses/addr-branch/tags"
        ),
        createParams({ id: "cust-tag-test", address_id: "addr-branch" })
      );
      const branchAfterData = await branchAfterRes.json();

      expect(branchAfterData.effective_tags).toContain("categoria-di-sconto:sconto-45");
      expect(branchAfterData.effective_tags).toContain("categoria-clienti:idraulico");

      // 8. Remove customer-level tag — both addresses should lose it
      await removeCustomerTag(
        makeReq("DELETE", "http://localhost/api/b2b/customers/cust-tag-test/tags", {
          full_tag: "categoria-di-sconto:sconto-45",
        }),
        createParams({ id: "cust-tag-test" })
      );

      const finalMainRes = await getAddressTags(
        makeReq(
          "GET",
          "http://localhost/api/b2b/customers/cust-tag-test/addresses/addr-main/tags"
        ),
        createParams({ id: "cust-tag-test", address_id: "addr-main" })
      );
      const finalMainData = await finalMainRes.json();

      expect(finalMainData.effective_tags).toHaveLength(1);
      expect(finalMainData.effective_tags).toContain("categoria-clienti:idraulico");
      expect(finalMainData.effective_tags).not.toContain("categoria-di-sconto:sconto-45");
    });
  });

  // ============================================
  // CUSTOMER_COUNT TRACKING
  // ============================================

  describe("Customer Count Tracking", () => {
    it("should update customer_count on tag when assigned", async () => {
      await seedTag("categoria-di-sconto", "sconto-45", "Sconto 45%");
      await seedCustomerWithAddresses();

      // Assign tag
      await assignCustomerTag(
        makeReq("PUT", "http://localhost/api/b2b/customers/cust-tag-test/tags", {
          full_tag: "categoria-di-sconto:sconto-45",
        }),
        createParams({ id: "cust-tag-test" })
      );

      // Check the tag definition's customer_count
      const tagDoc = await CustomerTagModel.findOne({
        full_tag: "categoria-di-sconto:sconto-45",
      }).lean();
      expect(tagDoc).toBeDefined();
      expect((tagDoc as { customer_count: number }).customer_count).toBe(1);
    });

    it("should decrement customer_count when tag is removed", async () => {
      await seedTag("categoria-di-sconto", "sconto-45", "Sconto 45%");
      await seedCustomerWithAddresses();

      // Assign then remove
      await assignCustomerTag(
        makeReq("PUT", "http://localhost/api/b2b/customers/cust-tag-test/tags", {
          full_tag: "categoria-di-sconto:sconto-45",
        }),
        createParams({ id: "cust-tag-test" })
      );
      await removeCustomerTag(
        makeReq("DELETE", "http://localhost/api/b2b/customers/cust-tag-test/tags", {
          full_tag: "categoria-di-sconto:sconto-45",
        }),
        createParams({ id: "cust-tag-test" })
      );

      const tagDoc = await CustomerTagModel.findOne({
        full_tag: "categoria-di-sconto:sconto-45",
      }).lean();
      expect((tagDoc as { customer_count: number }).customer_count).toBe(0);
    });
  });

  // ============================================
  // CART CYCLE WITH EFFECTIVE TAGS
  // ============================================

  describe("Cart Cycle — Effective Tags on Cart Creation", () => {
    /**
     * Seed a customer with external_code and addresses with external_code,
     * so the cart/active route can find them by external codes.
     */
    async function seedCustomerForCart() {
      return CustomerModel.create({
        customer_id: "cust-cart-test",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "cart-test@example.com",
        company_name: "Cart Test Company",
        external_code: "EXT-CUST-001",
        public_code: "C-00100",
        tags: [],
        addresses: [
          {
            address_id: "addr-main",
            address_type: "delivery",
            recipient_name: "Main Warehouse",
            street_address: "Via Roma 1",
            city: "Milano",
            province: "MI",
            postal_code: "20100",
            country: "IT",
            is_default: true,
            external_code: "EXT-ADDR-MAIN",
            tag_overrides: [],
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            address_id: "addr-branch",
            address_type: "delivery",
            recipient_name: "Branch Office",
            street_address: "Via Napoli 5",
            city: "Napoli",
            province: "NA",
            postal_code: "80100",
            country: "IT",
            is_default: false,
            external_code: "EXT-ADDR-BRANCH",
            tag_overrides: [],
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        default_shipping_address_id: "addr-main",
      });
    }

    it("should store customer default tags as effective_tags on cart", async () => {
      // 1. Create tags
      await seedTag("categoria-di-sconto", "sconto-45", "Sconto 45%");
      await seedTag("categoria-clienti", "idraulico", "Idraulico");

      // 2. Create customer with external codes
      await seedCustomerForCart();

      // 3. Assign customer-level tags
      await assignCustomerTag(
        makeReq("PUT", "http://localhost/api/b2b/customers/cust-cart-test/tags", {
          full_tag: "categoria-di-sconto:sconto-45",
        }),
        createParams({ id: "cust-cart-test" })
      );
      await assignCustomerTag(
        makeReq("PUT", "http://localhost/api/b2b/customers/cust-cart-test/tags", {
          full_tag: "categoria-clienti:idraulico",
        }),
        createParams({ id: "cust-cart-test" })
      );

      // 4. Create cart for main address (no overrides → customer defaults)
      const res = await createActiveCart(
        makeReq("POST", "http://localhost/api/b2b/cart/active", {
          customer_code: "EXT-CUST-001",
          address_code: "EXT-ADDR-MAIN",
        })
      );
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.is_new).toBe(true);
      expect(data.order.effective_tags).toBeDefined();
      expect(data.order.effective_tags).toContain("categoria-di-sconto:sconto-45");
      expect(data.order.effective_tags).toContain("categoria-clienti:idraulico");
      expect(data.order.effective_tags).toHaveLength(2);
    });

    it("should resolve address overrides into effective_tags on cart", async () => {
      // 1. Create tags
      await seedTag("categoria-di-sconto", "sconto-45", "Sconto 45%");
      await seedTag("categoria-di-sconto", "sconto-50", "Sconto 50%");
      await seedTag("categoria-clienti", "idraulico", "Idraulico");

      // 2. Create customer
      await seedCustomerForCart();

      // 3. Assign customer-level defaults
      await assignCustomerTag(
        makeReq("PUT", "http://localhost/api/b2b/customers/cust-cart-test/tags", {
          full_tag: "categoria-di-sconto:sconto-45",
        }),
        createParams({ id: "cust-cart-test" })
      );
      await assignCustomerTag(
        makeReq("PUT", "http://localhost/api/b2b/customers/cust-cart-test/tags", {
          full_tag: "categoria-clienti:idraulico",
        }),
        createParams({ id: "cust-cart-test" })
      );

      // 4. Override sconto on branch address
      await assignAddressTag(
        makeReq(
          "PUT",
          "http://localhost/api/b2b/customers/cust-cart-test/addresses/addr-branch/tags",
          { full_tag: "categoria-di-sconto:sconto-50" }
        ),
        createParams({ id: "cust-cart-test", address_id: "addr-branch" })
      );

      // 5. Create cart for branch address → override applied
      const res = await createActiveCart(
        makeReq("POST", "http://localhost/api/b2b/cart/active", {
          customer_code: "EXT-CUST-001",
          address_code: "EXT-ADDR-BRANCH",
        })
      );
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.order.effective_tags).toContain("categoria-di-sconto:sconto-50");
      expect(data.order.effective_tags).toContain("categoria-clienti:idraulico");
      expect(data.order.effective_tags).not.toContain("categoria-di-sconto:sconto-45");
      expect(data.order.effective_tags).toHaveLength(2);
    });

    it("should persist effective_tags in the Order document", async () => {
      await seedTag("categoria-di-sconto", "sconto-45", "Sconto 45%");
      await seedCustomerForCart();

      await assignCustomerTag(
        makeReq("PUT", "http://localhost/api/b2b/customers/cust-cart-test/tags", {
          full_tag: "categoria-di-sconto:sconto-45",
        }),
        createParams({ id: "cust-cart-test" })
      );

      // Create cart
      const res = await createActiveCart(
        makeReq("POST", "http://localhost/api/b2b/cart/active", {
          customer_code: "EXT-CUST-001",
          address_code: "EXT-ADDR-MAIN",
        })
      );
      const data = await res.json();

      // Verify effective_tags persisted in DB
      const savedOrder = await OrderModel.findOne({
        order_id: data.order_id,
      }).lean();

      expect(savedOrder).toBeDefined();
      expect((savedOrder as { effective_tags: string[] }).effective_tags).toContain(
        "categoria-di-sconto:sconto-45"
      );
    });

    it("should return existing cart on second call with same customer+address", async () => {
      await seedTag("categoria-di-sconto", "sconto-45", "Sconto 45%");
      await seedCustomerForCart();

      await assignCustomerTag(
        makeReq("PUT", "http://localhost/api/b2b/customers/cust-cart-test/tags", {
          full_tag: "categoria-di-sconto:sconto-45",
        }),
        createParams({ id: "cust-cart-test" })
      );

      // First call → new cart
      const res1 = await createActiveCart(
        makeReq("POST", "http://localhost/api/b2b/cart/active", {
          customer_code: "EXT-CUST-001",
          address_code: "EXT-ADDR-MAIN",
        })
      );
      const data1 = await res1.json();

      expect(res1.status).toBe(201);
      expect(data1.is_new).toBe(true);

      // Second call → same cart returned
      const res2 = await createActiveCart(
        makeReq("POST", "http://localhost/api/b2b/cart/active", {
          customer_code: "EXT-CUST-001",
          address_code: "EXT-ADDR-MAIN",
        })
      );
      const data2 = await res2.json();

      expect(res2.status).toBe(200);
      expect(data2.is_new).toBe(false);
      expect(data2.order_id).toBe(data1.order_id);
    });

    it("should create different carts with different effective_tags per address", async () => {
      await seedTag("categoria-di-sconto", "sconto-45", "Sconto 45%");
      await seedTag("categoria-di-sconto", "sconto-50", "Sconto 50%");
      await seedTag("categoria-clienti", "idraulico", "Idraulico");
      await seedCustomerForCart();

      // Assign customer defaults
      await assignCustomerTag(
        makeReq("PUT", "http://localhost/api/b2b/customers/cust-cart-test/tags", {
          full_tag: "categoria-di-sconto:sconto-45",
        }),
        createParams({ id: "cust-cart-test" })
      );
      await assignCustomerTag(
        makeReq("PUT", "http://localhost/api/b2b/customers/cust-cart-test/tags", {
          full_tag: "categoria-clienti:idraulico",
        }),
        createParams({ id: "cust-cart-test" })
      );

      // Override sconto on branch address
      await assignAddressTag(
        makeReq(
          "PUT",
          "http://localhost/api/b2b/customers/cust-cart-test/addresses/addr-branch/tags",
          { full_tag: "categoria-di-sconto:sconto-50" }
        ),
        createParams({ id: "cust-cart-test", address_id: "addr-branch" })
      );

      // Cart for main address → customer defaults (sconto-45 + idraulico)
      const resMain = await createActiveCart(
        makeReq("POST", "http://localhost/api/b2b/cart/active", {
          customer_code: "EXT-CUST-001",
          address_code: "EXT-ADDR-MAIN",
        })
      );
      const dataMain = await resMain.json();

      // Cart for branch address → overridden tags (sconto-50 + idraulico)
      const resBranch = await createActiveCart(
        makeReq("POST", "http://localhost/api/b2b/cart/active", {
          customer_code: "EXT-CUST-001",
          address_code: "EXT-ADDR-BRANCH",
        })
      );
      const dataBranch = await resBranch.json();

      // Both carts created
      expect(resMain.status).toBe(201);
      expect(resBranch.status).toBe(201);
      expect(dataMain.order_id).not.toBe(dataBranch.order_id);

      // Main address → sconto-45 (customer default)
      expect(dataMain.order.effective_tags).toContain("categoria-di-sconto:sconto-45");
      expect(dataMain.order.effective_tags).toContain("categoria-clienti:idraulico");
      expect(dataMain.order.effective_tags).not.toContain("categoria-di-sconto:sconto-50");

      // Branch address → sconto-50 (address override)
      expect(dataBranch.order.effective_tags).toContain("categoria-di-sconto:sconto-50");
      expect(dataBranch.order.effective_tags).toContain("categoria-clienti:idraulico");
      expect(dataBranch.order.effective_tags).not.toContain("categoria-di-sconto:sconto-45");
    });

    it("should create cart with empty effective_tags when customer has no tags", async () => {
      await seedCustomerForCart();

      const res = await createActiveCart(
        makeReq("POST", "http://localhost/api/b2b/cart/active", {
          customer_code: "EXT-CUST-001",
          address_code: "EXT-ADDR-MAIN",
        })
      );
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.order.effective_tags).toBeDefined();
      expect(data.order.effective_tags).toHaveLength(0);
    });
  });
});
