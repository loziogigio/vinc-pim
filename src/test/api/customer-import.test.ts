/**
 * Customer Import API + Worker Tests
 *
 * Tests the bulk customer import API route and worker logic:
 * - API route validation (empty array, missing external_code, max batch)
 * - Worker: create new customers, replace mode, partial merge mode
 * - Worker: tag upsert and address tag_overrides
 * - Worker: error collection and progress tracking
 * - E2E: POST API -> worker processing -> GET status -> verify DB
 *
 * Uses in-memory MongoDB with direct route handler invocation.
 * Worker tests call the real processCustomerImportData (no duplicated logic).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
} from "../conftest";
import { NextRequest } from "next/server";

// ============================================
// MOCKS (must be at module level, before imports)
// ============================================

// Mock BullMQ so the worker module doesn't try to connect to Redis
vi.mock("bullmq", () => ({
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn(),
  })),
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
  })),
  Job: vi.fn(),
}));

vi.mock("@/lib/db/connection", async () => {
  const { CustomerModel } = await import("@/lib/db/models/customer");
  const { OrderModel } = await import("@/lib/db/models/order");
  const { CustomerTagModel } = await import("@/lib/db/models/customer-tag");
  const { ImportJobModel } = await import("@/lib/db/models/import-job");
  const mongoose = await import("mongoose");
  return {
    connectToDatabase: vi.fn(() => Promise.resolve()),
    connectWithModels: vi.fn(() =>
      Promise.resolve({
        Customer: CustomerModel,
        Order: OrderModel,
        CustomerTag: CustomerTagModel,
        ImportJob: ImportJobModel,
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

// Mock the BullMQ queue to capture queued jobs
const queuedJobs: any[] = [];
vi.mock("@/lib/queue/queues", () => ({
  customerImportQueue: {
    add: vi.fn((name: string, data: any) => {
      queuedJobs.push({ name, data });
      return Promise.resolve({ id: "mock-bullmq-id" });
    }),
  },
}));

// Mock counter model
let publicCodeCounter = 0;
vi.mock("@/lib/db/models/counter", () => ({
  getNextCustomerPublicCode: vi.fn(() => {
    publicCodeCounter++;
    return Promise.resolve(`C-${String(publicCodeCounter).padStart(5, "0")}`);
  }),
  getNextOrderNumber: vi.fn(() => Promise.resolve(1)),
  getNextCartNumber: vi.fn(() => Promise.resolve(1)),
}));

// ============================================
// IMPORTS (after mocks)
// ============================================

import { POST as importCustomers } from "@/app/api/b2b/customers/import/api/route";
import { GET as getImportJobStatus } from "@/app/api/b2b/customers/import/api/[job_id]/route";
import { processCustomerImportData } from "@/lib/queue/customer-import-worker";
import { CustomerModel } from "@/lib/db/models/customer";
import { CustomerTagModel } from "@/lib/db/models/customer-tag";
import { ImportJobModel } from "@/lib/db/models/import-job";

// ============================================
// HELPERS
// ============================================

function makeReq(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "Content-Type": "application/json" } : undefined,
  });
}

async function seedTag(prefix: string, code: string, description: string) {
  return CustomerTagModel.create({
    tag_id: `ctag_${prefix}_${code}`,
    prefix,
    code,
    full_tag: `${prefix}:${code}`,
    description,
    is_active: true,
    customer_count: 0,
  });
}

async function createImportJob(jobId: string, totalRows: number) {
  return ImportJobModel.create({
    job_id: jobId,
    job_type: "customer_import",
    source_id: "customer-import-api",
    status: "pending",
    total_rows: totalRows,
  });
}

async function getJobStatus(jobId: string) {
  const req = makeReq("GET", `http://localhost/api/b2b/customers/import/api/${jobId}`);
  return getImportJobStatus(req, { params: Promise.resolve({ job_id: jobId }) });
}

// ============================================
// TESTS
// ============================================

describe("integration: Customer Import API", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    queuedJobs.length = 0;
    publicCodeCounter = 0;
  });

  // ============================================
  // API ROUTE VALIDATION
  // ============================================

  describe("POST /api/b2b/customers/import/api — Validation", () => {
    it("should accept valid import request and return 202", async () => {
      const res = await importCustomers(
        makeReq("POST", "http://localhost/api/b2b/customers/import/api", {
          customers: [
            { external_code: "ERP-001", customer_type: "business", email: "a@test.com" },
            { external_code: "ERP-002", customer_type: "private", email: "b@test.com" },
          ],
        }),
      );
      const data = await res.json();

      expect(res.status).toBe(202);
      expect(data.success).toBe(true);
      expect(data.job_id).toBeDefined();
      expect(data.total).toBe(2);
      expect(data.merge_mode).toBe("replace");
    });

    it("should create ImportJob document", async () => {
      await importCustomers(
        makeReq("POST", "http://localhost/api/b2b/customers/import/api", {
          customers: [{ external_code: "ERP-001", email: "a@test.com" }],
        }),
      );

      const jobs = await ImportJobModel.find({ job_type: "customer_import" });
      expect(jobs).toHaveLength(1);
      expect(jobs[0].status).toBe("pending");
      expect(jobs[0].total_rows).toBe(1);
    });

    it("should queue job to BullMQ", async () => {
      await importCustomers(
        makeReq("POST", "http://localhost/api/b2b/customers/import/api", {
          customers: [{ external_code: "ERP-001", email: "a@test.com" }],
          merge_mode: "partial",
        }),
      );

      expect(queuedJobs).toHaveLength(1);
      expect(queuedJobs[0].name).toBe("customer-import");
      expect(queuedJobs[0].data.merge_mode).toBe("partial");
      expect(queuedJobs[0].data.tenant_id).toBe("test-tenant");
      expect(queuedJobs[0].data.customers).toHaveLength(1);
    });

    it("should reject empty customers array", async () => {
      const res = await importCustomers(
        makeReq("POST", "http://localhost/api/b2b/customers/import/api", {
          customers: [],
        }),
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("empty");
    });

    it("should reject missing customers array", async () => {
      const res = await importCustomers(
        makeReq("POST", "http://localhost/api/b2b/customers/import/api", {}),
      );

      expect(res.status).toBe(400);
    });

    it("should reject customer without external_code", async () => {
      const res = await importCustomers(
        makeReq("POST", "http://localhost/api/b2b/customers/import/api", {
          customers: [
            { external_code: "ERP-001", email: "a@test.com" },
            { email: "b@test.com" }, // Missing external_code
          ],
        }),
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("index 1");
      expect(data.error).toContain("external_code");
    });

    it("should reject exceeding max batch size", async () => {
      const customers = Array.from({ length: 5001 }, (_, i) => ({
        external_code: `ERP-${i}`,
        email: `e${i}@test.com`,
      }));

      const res = await importCustomers(
        makeReq("POST", "http://localhost/api/b2b/customers/import/api", {
          customers,
        }),
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("5000");
    });

    it("should reject invalid merge_mode", async () => {
      const res = await importCustomers(
        makeReq("POST", "http://localhost/api/b2b/customers/import/api", {
          customers: [{ external_code: "ERP-001" }],
          merge_mode: "invalid",
        }),
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("merge_mode");
    });

    it("should pass batch_metadata to ImportJob", async () => {
      await importCustomers(
        makeReq("POST", "http://localhost/api/b2b/customers/import/api", {
          customers: [{ external_code: "ERP-001" }],
          batch_metadata: {
            batch_id: "erp-sync-001",
            batch_part: 1,
            batch_total_parts: 3,
            batch_total_items: 300,
          },
        }),
      );

      const job = await ImportJobModel.findOne({ job_type: "customer_import" });
      expect(job).toBeDefined();
      expect(job!.batch_id).toBe("erp-sync-001");
      expect(job!.batch_part).toBe(1);
      expect(job!.batch_total_parts).toBe(3);
    });
  });

  // ============================================
  // WORKER LOGIC — CREATE (uses real processCustomerImportData)
  // ============================================

  describe("Worker — Create New Customers", () => {
    it("should create new customer with basic fields", async () => {
      await createImportJob("test-job-1", 1);

      const result = await processCustomerImportData({
        job_id: "test-job-1",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        customers: [{
          external_code: "ERP-001",
          customer_type: "business",
          email: "client@example.com",
          company_name: "Client SpA",
          phone: "+39 02 123456",
        }],
      });

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(0);

      const customer = await CustomerModel.findOne({
        tenant_id: "test-tenant",
        external_code: "ERP-001",
      });
      expect(customer).toBeDefined();
      expect(customer!.email).toBe("client@example.com");
      expect(customer!.company_name).toBe("Client SpA");
      expect(customer!.customer_type).toBe("business");
      expect(customer!.public_code).toMatch(/^C-/);
    });

    it("should create customer with addresses", async () => {
      await createImportJob("test-job-2", 1);

      await processCustomerImportData({
        job_id: "test-job-2",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        customers: [{
          external_code: "ERP-002",
          email: "client2@example.com",
          addresses: [
            {
              external_code: "ADDR-HQ",
              recipient_name: "HQ Office",
              street_address: "Via Roma 1",
              city: "Milano",
              province: "MI",
              postal_code: "20100",
            },
            {
              external_code: "ADDR-WH",
              recipient_name: "Warehouse",
              street_address: "Via Napoli 5",
              city: "Napoli",
              province: "NA",
              postal_code: "80100",
            },
          ],
        }],
      });

      const customer = await CustomerModel.findOne({
        tenant_id: "test-tenant",
        external_code: "ERP-002",
      });
      expect(customer!.addresses).toHaveLength(2);
      expect(customer!.addresses[0].external_code).toBe("ADDR-HQ");
      expect(customer!.addresses[0].city).toBe("Milano");
      expect(customer!.addresses[1].external_code).toBe("ADDR-WH");
    });

    it("should create customer with tags", async () => {
      await seedTag("categoria-di-sconto", "sconto-45", "Sconto 45%");
      await seedTag("categoria-clienti", "idraulico", "Idraulico");
      await createImportJob("test-job-tags", 1);

      await processCustomerImportData({
        job_id: "test-job-tags",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        customers: [{
          external_code: "ERP-TAG-001",
          email: "tagged@example.com",
          tags: ["categoria-di-sconto:sconto-45", "categoria-clienti:idraulico"],
        }],
      });

      const customer = await CustomerModel.findOne({
        tenant_id: "test-tenant",
        external_code: "ERP-TAG-001",
      });
      expect(customer!.tags).toHaveLength(2);
      expect(customer!.tags.map((t: any) => t.full_tag)).toContain("categoria-di-sconto:sconto-45");
      expect(customer!.tags.map((t: any) => t.full_tag)).toContain("categoria-clienti:idraulico");
    });

    it("should skip unknown tags silently", async () => {
      await seedTag("categoria-di-sconto", "sconto-45", "Sconto 45%");
      await createImportJob("test-job-unknown-tag", 1);

      const result = await processCustomerImportData({
        job_id: "test-job-unknown-tag",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        customers: [{
          external_code: "ERP-SKIP-001",
          email: "skip@example.com",
          tags: ["categoria-di-sconto:sconto-45", "nonexistent:tag"],
        }],
      });

      expect(result.successful).toBe(1);

      const customer = await CustomerModel.findOne({
        tenant_id: "test-tenant",
        external_code: "ERP-SKIP-001",
      });
      // Only the valid tag should be applied
      expect(customer!.tags).toHaveLength(1);
      expect(customer!.tags[0].full_tag).toBe("categoria-di-sconto:sconto-45");
    });

    it("should create customer with address tag_overrides", async () => {
      await seedTag("categoria-di-sconto", "sconto-45", "Sconto 45%");
      await seedTag("categoria-di-sconto", "sconto-50", "Sconto 50%");
      await createImportJob("test-job-addr-tags", 1);

      await processCustomerImportData({
        job_id: "test-job-addr-tags",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        customers: [{
          external_code: "ERP-ADDRTAG-001",
          email: "addrtag@example.com",
          tags: ["categoria-di-sconto:sconto-45"],
          addresses: [
            {
              external_code: "ADDR-BRANCH",
              recipient_name: "Branch",
              street_address: "Via Test 1",
              city: "Roma",
              province: "RM",
              postal_code: "00100",
              tag_overrides: ["categoria-di-sconto:sconto-50"],
            },
          ],
        }],
      });

      const customer = await CustomerModel.findOne({
        tenant_id: "test-tenant",
        external_code: "ERP-ADDRTAG-001",
      });

      // Customer-level tag
      expect(customer!.tags).toHaveLength(1);
      expect(customer!.tags[0].full_tag).toBe("categoria-di-sconto:sconto-45");

      // Address-level override
      expect(customer!.addresses[0].tag_overrides).toHaveLength(1);
      expect(customer!.addresses[0].tag_overrides[0].full_tag).toBe("categoria-di-sconto:sconto-50");
    });
  });

  // ============================================
  // WORKER LOGIC — UPDATE (REPLACE MODE)
  // ============================================

  describe("Worker — Replace Mode", () => {
    it("should update existing customer fields in replace mode", async () => {
      await CustomerModel.create({
        customer_id: "cust-existing-001",
        external_code: "ERP-EXIST-001",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "old@example.com",
        company_name: "Old Company",
        phone: "+39 old",
        tags: [],
        addresses: [],
      });
      await createImportJob("test-replace-1", 1);

      await processCustomerImportData({
        job_id: "test-replace-1",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        customers: [{
          external_code: "ERP-EXIST-001",
          email: "new@example.com",
          company_name: "New Company",
          phone: "+39 new",
        }],
      });

      const updated = await CustomerModel.findOne({
        tenant_id: "test-tenant",
        external_code: "ERP-EXIST-001",
      });
      expect(updated!.email).toBe("new@example.com");
      expect(updated!.company_name).toBe("New Company");
      expect(updated!.phone).toBe("+39 new");
    });

    it("should replace addresses in replace mode", async () => {
      await CustomerModel.create({
        customer_id: "cust-replace-addr",
        external_code: "ERP-ADDR-REPLACE",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "addr@example.com",
        tags: [],
        addresses: [{
          address_id: "old-addr-1",
          external_code: "OLD-ADDR",
          address_type: "delivery",
          recipient_name: "Old Address",
          street_address: "Old Street",
          city: "OldCity",
          province: "OC",
          postal_code: "00000",
          country: "IT",
          is_default: true,
          tag_overrides: [],
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });
      await createImportJob("test-replace-addr", 1);

      await processCustomerImportData({
        job_id: "test-replace-addr",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        customers: [{
          external_code: "ERP-ADDR-REPLACE",
          addresses: [{
            external_code: "NEW-ADDR",
            recipient_name: "New Address",
            street_address: "New Street",
            city: "NewCity",
            province: "NC",
            postal_code: "11111",
          }],
        }],
      });

      const updated = await CustomerModel.findOne({
        tenant_id: "test-tenant",
        external_code: "ERP-ADDR-REPLACE",
      });
      expect(updated!.addresses).toHaveLength(1);
      expect(updated!.addresses[0].external_code).toBe("NEW-ADDR");
      expect(updated!.addresses[0].city).toBe("NewCity");
    });

    it("should replace same-prefix tag on re-import", async () => {
      await seedTag("categoria-di-sconto", "sconto-45", "Sconto 45%");
      await seedTag("categoria-di-sconto", "sconto-50", "Sconto 50%");

      await CustomerModel.create({
        customer_id: "cust-tag-replace",
        external_code: "ERP-TAG-REPLACE",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "tagreplace@example.com",
        tags: [],
        addresses: [],
      });

      // First import: assign sconto-45
      await createImportJob("test-tag-replace-1", 1);
      await processCustomerImportData({
        job_id: "test-tag-replace-1",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        customers: [{
          external_code: "ERP-TAG-REPLACE",
          tags: ["categoria-di-sconto:sconto-45"],
        }],
      });

      let customer = await CustomerModel.findOne({
        tenant_id: "test-tenant",
        external_code: "ERP-TAG-REPLACE",
      });
      expect(customer!.tags).toHaveLength(1);
      expect(customer!.tags[0].full_tag).toBe("categoria-di-sconto:sconto-45");

      // Second import: change to sconto-50 (same prefix)
      await createImportJob("test-tag-replace-2", 1);
      await processCustomerImportData({
        job_id: "test-tag-replace-2",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        customers: [{
          external_code: "ERP-TAG-REPLACE",
          tags: ["categoria-di-sconto:sconto-50"],
        }],
      });

      customer = await CustomerModel.findOne({
        tenant_id: "test-tenant",
        external_code: "ERP-TAG-REPLACE",
      });
      // Should have replaced sconto-45 with sconto-50 (same prefix)
      expect(customer!.tags).toHaveLength(1);
      expect(customer!.tags[0].full_tag).toBe("categoria-di-sconto:sconto-50");
    });
  });

  // ============================================
  // WORKER LOGIC — PARTIAL MERGE
  // ============================================

  describe("Worker — Partial Merge Mode", () => {
    it("should only update provided fields in partial mode", async () => {
      await CustomerModel.create({
        customer_id: "cust-partial-001",
        external_code: "ERP-PARTIAL-001",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "original@example.com",
        company_name: "Original Company",
        phone: "+39 original",
        tags: [],
        addresses: [],
      });
      await createImportJob("test-partial-1", 1);

      await processCustomerImportData({
        job_id: "test-partial-1",
        tenant_id: "test-tenant",
        merge_mode: "partial",
        customers: [{
          external_code: "ERP-PARTIAL-001",
          phone: "+39 updated", // Only update phone
        }],
      });

      const updated = await CustomerModel.findOne({
        tenant_id: "test-tenant",
        external_code: "ERP-PARTIAL-001",
      });
      expect(updated!.phone).toBe("+39 updated");
      // Other fields should remain unchanged
      expect(updated!.email).toBe("original@example.com");
      expect(updated!.company_name).toBe("Original Company");
    });

    it("should deep merge legal_info in partial mode", async () => {
      await CustomerModel.create({
        customer_id: "cust-partial-legal",
        external_code: "ERP-PARTIAL-LEGAL",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "legal@example.com",
        legal_info: {
          vat_number: "IT12345678901",
          pec_email: "old@pec.it",
        },
        tags: [],
        addresses: [],
      });
      await createImportJob("test-partial-legal", 1);

      await processCustomerImportData({
        job_id: "test-partial-legal",
        tenant_id: "test-tenant",
        merge_mode: "partial",
        customers: [{
          external_code: "ERP-PARTIAL-LEGAL",
          legal_info: {
            sdi_code: "ABC1234", // Add new field
          },
        }],
      });

      const updated = await CustomerModel.findOne({
        tenant_id: "test-tenant",
        external_code: "ERP-PARTIAL-LEGAL",
      });
      // Both old and new fields should be present
      expect(updated!.legal_info!.vat_number).toBe("IT12345678901");
      expect(updated!.legal_info!.pec_email).toBe("old@pec.it");
      expect(updated!.legal_info!.sdi_code).toBe("ABC1234");
    });
  });

  // ============================================
  // WORKER LOGIC — ERROR HANDLING
  // ============================================

  describe("Worker — Error Handling and Progress", () => {
    it("should collect errors for invalid rows", async () => {
      await createImportJob("test-errors", 3);

      const result = await processCustomerImportData({
        job_id: "test-errors",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        customers: [
          { external_code: "GOOD-001", email: "good@example.com" },
          { external_code: "", email: "bad@example.com" } as any, // Empty external_code
          { external_code: "GOOD-002", email: "good2@example.com" },
        ],
      });

      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);

      // Errors are stored in ImportJob document
      const job = await ImportJobModel.findOne({ job_id: "test-errors" });
      expect(job!.import_errors).toHaveLength(1);
      expect(job!.import_errors[0].row).toBe(2);
      expect(job!.import_errors[0].error).toContain("external_code");
    });

    it("should track progress in ImportJob document", async () => {
      await createImportJob("test-progress", 2);

      await processCustomerImportData({
        job_id: "test-progress",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        customers: [
          { external_code: "PROG-001", email: "p1@example.com" },
          { external_code: "PROG-002", email: "p2@example.com" },
        ],
      });

      const job = await ImportJobModel.findOne({ job_id: "test-progress" });
      expect(job!.status).toBe("completed");
      expect(job!.processed_rows).toBe(2);
      expect(job!.successful_rows).toBe(2);
      expect(job!.failed_rows).toBe(0);
      expect(job!.completed_at).toBeDefined();
    });

    it("should validate legal info and reject invalid entries", async () => {
      await createImportJob("test-legal-invalid", 1);

      const result = await processCustomerImportData({
        job_id: "test-legal-invalid",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        customers: [{
          external_code: "ERP-BAD-LEGAL",
          email: "badlegal@example.com",
          legal_info: {
            vat_number: "INVALID-VAT", // Bad format
          },
        }],
      });

      expect(result.failed).toBe(1);

      const job = await ImportJobModel.findOne({ job_id: "test-legal-invalid" });
      expect(job!.import_errors[0].error).toContain("legal info");
    });

    it("should handle batch of mixed valid and invalid customers", async () => {
      await seedTag("categoria-di-sconto", "sconto-45", "Sconto 45%");
      await createImportJob("test-mixed", 4);

      const result = await processCustomerImportData({
        job_id: "test-mixed",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        customers: [
          { external_code: "MIX-001", email: "mix1@example.com", tags: ["categoria-di-sconto:sconto-45"] },
          { email: "no-code@example.com" } as any, // Missing external_code
          { external_code: "MIX-003", email: "mix3@example.com" },
          { external_code: "MIX-004", email: "mix4@example.com", legal_info: { vat_number: "BAD" } },
        ],
      });

      expect(result.processed).toBe(4);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(2);

      // Verify successful ones are in DB
      const customers = await CustomerModel.find({ tenant_id: "test-tenant" });
      expect(customers).toHaveLength(2);
    });
  });

  // ============================================
  // E2E: FULL PIPELINE
  // ============================================

  describe("e2e: Customer Import Full Pipeline", () => {
    it("POST -> process -> GET status (all success)", async () => {
      // 1. POST to API route
      const postRes = await importCustomers(
        makeReq("POST", "http://localhost/api/b2b/customers/import/api", {
          customers: [
            { external_code: "E2E-001", customer_type: "business", email: "e2e1@example.com", company_name: "E2E Corp" },
            { external_code: "E2E-002", customer_type: "private", email: "e2e2@example.com", first_name: "Mario", last_name: "Rossi" },
            { external_code: "E2E-003", email: "e2e3@example.com" },
          ],
        }),
      );
      const postData = await postRes.json();
      expect(postRes.status).toBe(202);
      expect(postData.job_id).toBeDefined();

      // 2. Process through real worker using queued data
      const queuedData = queuedJobs[0].data;
      await processCustomerImportData(queuedData);

      // 3. GET status
      const statusRes = await getJobStatus(postData.job_id);
      const statusData = await statusRes.json();

      expect(statusRes.status).toBe(200);
      expect(statusData.success).toBe(true);
      expect(statusData.job.status).toBe("completed");
      expect(statusData.job.successful_rows).toBe(3);
      expect(statusData.job.failed_rows).toBe(0);
      expect(statusData.job.processed_rows).toBe(3);
      expect(statusData.job.completed_at).toBeDefined();

      // 4. Verify DB state
      const customers = await CustomerModel.find({ tenant_id: "test-tenant" }).sort({ external_code: 1 });
      expect(customers).toHaveLength(3);
      expect(customers[0].external_code).toBe("E2E-001");
      expect(customers[0].company_name).toBe("E2E Corp");
      expect(customers[1].external_code).toBe("E2E-002");
      expect(customers[1].first_name).toBe("Mario");
    });

    it("POST -> process -> GET status (mixed errors)", async () => {
      // All have external_code (passes API validation), but some have invalid legal_info (fails in worker)
      const postRes = await importCustomers(
        makeReq("POST", "http://localhost/api/b2b/customers/import/api", {
          customers: [
            { external_code: "E2E-OK-1", email: "ok1@example.com" },
            { external_code: "E2E-BAD-1", email: "bad1@example.com", legal_info: { vat_number: "INVALID" } },
            { external_code: "E2E-OK-2", email: "ok2@example.com" },
            { external_code: "E2E-BAD-2", email: "bad2@example.com", legal_info: { vat_number: "BAD" } },
          ],
        }),
      );
      const postData = await postRes.json();
      expect(postRes.status).toBe(202);

      // Process through worker
      await processCustomerImportData(queuedJobs[0].data);

      // GET status
      const statusRes = await getJobStatus(postData.job_id);
      const statusData = await statusRes.json();

      expect(statusData.job.status).toBe("completed");
      expect(statusData.job.successful_rows).toBe(2);
      expect(statusData.job.failed_rows).toBe(2);
      expect(statusData.job.import_errors).toHaveLength(2);
      expect(statusData.job.import_errors[0].row).toBe(2);
      expect(statusData.job.import_errors[0].error).toContain("legal info");
      expect(statusData.job.import_errors[1].row).toBe(4);
    });

    it("POST -> process -> tags + tag_overrides flow end-to-end", async () => {
      await seedTag("categoria-di-sconto", "sconto-45", "Sconto 45%");
      await seedTag("categoria-di-sconto", "sconto-50", "Sconto 50%");
      await seedTag("categoria-clienti", "idraulico", "Idraulico");

      const postRes = await importCustomers(
        makeReq("POST", "http://localhost/api/b2b/customers/import/api", {
          customers: [{
            external_code: "E2E-TAG-001",
            email: "e2etag@example.com",
            tags: ["categoria-di-sconto:sconto-45", "categoria-clienti:idraulico"],
            addresses: [{
              external_code: "E2E-ADDR",
              recipient_name: "Branch",
              street_address: "Via Test 1",
              city: "Roma",
              province: "RM",
              postal_code: "00100",
              tag_overrides: ["categoria-di-sconto:sconto-50"],
            }],
          }],
        }),
      );
      const postData = await postRes.json();

      await processCustomerImportData(queuedJobs[0].data);

      // Verify GET shows success
      const statusRes = await getJobStatus(postData.job_id);
      const statusData = await statusRes.json();
      expect(statusData.job.successful_rows).toBe(1);
      expect(statusData.job.failed_rows).toBe(0);

      // Verify DB state
      const customer = await CustomerModel.findOne({
        tenant_id: "test-tenant",
        external_code: "E2E-TAG-001",
      });
      expect(customer!.tags).toHaveLength(2);
      expect(customer!.tags.map((t: any) => t.full_tag)).toContain("categoria-di-sconto:sconto-45");
      expect(customer!.tags.map((t: any) => t.full_tag)).toContain("categoria-clienti:idraulico");
      expect(customer!.addresses[0].tag_overrides).toHaveLength(1);
      expect(customer!.addresses[0].tag_overrides[0].full_tag).toBe("categoria-di-sconto:sconto-50");
    });

    it("POST -> process -> replace mode replaces addresses end-to-end", async () => {
      // Pre-create customer with address
      await CustomerModel.create({
        customer_id: "cust-e2e-replace",
        external_code: "E2E-REPLACE",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "replace@example.com",
        tags: [],
        addresses: [{
          address_id: "old-addr",
          external_code: "OLD-ADDR",
          address_type: "delivery",
          recipient_name: "Old",
          street_address: "Old St",
          city: "OldCity",
          province: "OC",
          postal_code: "00000",
          country: "IT",
          is_default: true,
          tag_overrides: [],
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      const postRes = await importCustomers(
        makeReq("POST", "http://localhost/api/b2b/customers/import/api", {
          merge_mode: "replace",
          customers: [{
            external_code: "E2E-REPLACE",
            addresses: [{
              external_code: "NEW-ADDR",
              recipient_name: "New HQ",
              street_address: "New Street",
              city: "NewCity",
              province: "NC",
              postal_code: "11111",
            }],
          }],
        }),
      );
      const postData = await postRes.json();

      await processCustomerImportData(queuedJobs[0].data);

      const statusRes = await getJobStatus(postData.job_id);
      const statusData = await statusRes.json();
      expect(statusData.job.successful_rows).toBe(1);

      const customer = await CustomerModel.findOne({
        tenant_id: "test-tenant",
        external_code: "E2E-REPLACE",
      });
      expect(customer!.addresses).toHaveLength(1);
      expect(customer!.addresses[0].external_code).toBe("NEW-ADDR");
      expect(customer!.addresses[0].city).toBe("NewCity");
    });

    it("POST -> process -> partial merge preserves fields end-to-end", async () => {
      await CustomerModel.create({
        customer_id: "cust-e2e-partial",
        external_code: "E2E-PARTIAL",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "original@example.com",
        company_name: "Original Corp",
        phone: "+39 original",
        tags: [],
        addresses: [],
      });

      const postRes = await importCustomers(
        makeReq("POST", "http://localhost/api/b2b/customers/import/api", {
          merge_mode: "partial",
          customers: [{
            external_code: "E2E-PARTIAL",
            phone: "+39 updated",
          }],
        }),
      );
      const postData = await postRes.json();

      await processCustomerImportData(queuedJobs[0].data);

      const statusRes = await getJobStatus(postData.job_id);
      const statusData = await statusRes.json();
      expect(statusData.job.successful_rows).toBe(1);

      const customer = await CustomerModel.findOne({
        tenant_id: "test-tenant",
        external_code: "E2E-PARTIAL",
      });
      expect(customer!.phone).toBe("+39 updated");
      expect(customer!.email).toBe("original@example.com");
      expect(customer!.company_name).toBe("Original Corp");
    });

    it("POST -> process -> batch_metadata in GET response", async () => {
      const postRes = await importCustomers(
        makeReq("POST", "http://localhost/api/b2b/customers/import/api", {
          customers: [{ external_code: "E2E-BATCH", email: "batch@example.com" }],
          batch_metadata: {
            batch_id: "erp-sync-20260209",
            batch_part: 2,
            batch_total_parts: 5,
          },
        }),
      );
      const postData = await postRes.json();

      await processCustomerImportData(queuedJobs[0].data);

      const statusRes = await getJobStatus(postData.job_id);
      const statusData = await statusRes.json();

      expect(statusData.job.batch_id).toBe("erp-sync-20260209");
      expect(statusData.job.batch_part).toBe(2);
      expect(statusData.job.batch_total_parts).toBe(5);
    });

    it("GET returns 404 for non-existent job", async () => {
      const res = await getJobStatus("non-existent-job-id");
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain("not found");
    });
  });
});
