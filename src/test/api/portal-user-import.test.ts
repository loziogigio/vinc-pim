/**
 * Portal User Import API + Worker Tests
 *
 * Tests the bulk portal user import API route and worker logic:
 * - API route validation (empty array, missing username, max batch)
 * - Worker: create new users with bcrypt hashing, customer_access
 * - Worker: replace mode, partial merge mode
 * - Worker: duplicate email handling, error collection, progress tracking
 * - E2E: POST API -> worker processing -> GET status -> verify DB
 *
 * Uses in-memory MongoDB with direct route handler invocation.
 * Worker tests call the real processPortalUserImportData (no duplicated logic).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
} from "../conftest";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

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
  const { PortalUserModel } = await import("@/lib/db/models/portal-user");
  const { ImportJobModel } = await import("@/lib/db/models/import-job");
  const mongoose = await import("mongoose");
  return {
    connectToDatabase: vi.fn(() => Promise.resolve()),
    connectWithModels: vi.fn(() =>
      Promise.resolve({
        PortalUser: PortalUserModel,
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
  portalUserImportQueue: {
    add: vi.fn((name: string, data: any) => {
      queuedJobs.push({ name, data });
      return Promise.resolve({ id: "mock-bullmq-id" });
    }),
  },
}));

// ============================================
// IMPORTS (after mocks)
// ============================================

import { POST as importPortalUsers } from "@/app/api/b2b/portal-users/import/api/route";
import { GET as getImportJobStatus } from "@/app/api/b2b/portal-users/import/api/[job_id]/route";
import { processPortalUserImportData } from "@/lib/queue/portal-user-import-worker";
import { PortalUserModel } from "@/lib/db/models/portal-user";
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

async function createImportJob(jobId: string, totalRows: number) {
  return ImportJobModel.create({
    job_id: jobId,
    job_type: "portal_user_import",
    source_id: "portal-user-import-api",
    status: "pending",
    total_rows: totalRows,
  });
}

async function getJobStatus(jobId: string) {
  const req = makeReq("GET", `http://localhost/api/b2b/portal-users/import/api/${jobId}`);
  return getImportJobStatus(req, { params: Promise.resolve({ job_id: jobId }) });
}

// ============================================
// TESTS
// ============================================

describe("integration: Portal User Import API", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    queuedJobs.length = 0;
  });

  // ============================================
  // API ROUTE VALIDATION
  // ============================================

  describe("POST /api/b2b/portal-users/import/api — Validation", () => {
    it("should accept valid import request and return 202", async () => {
      const res = await importPortalUsers(
        makeReq("POST", "http://localhost/api/b2b/portal-users/import/api", {
          users: [
            { username: "mario.rossi", email: "mario@example.com", password: "securePass1" },
            { username: "luigi.verdi", email: "luigi@example.com", password: "securePass2" },
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

    it("should create ImportJob document with job_type portal_user_import", async () => {
      await importPortalUsers(
        makeReq("POST", "http://localhost/api/b2b/portal-users/import/api", {
          users: [{ username: "test.user", email: "test@example.com", password: "securePass1" }],
        }),
      );

      const jobs = await ImportJobModel.find({ job_type: "portal_user_import" });
      expect(jobs).toHaveLength(1);
      expect(jobs[0].status).toBe("pending");
      expect(jobs[0].total_rows).toBe(1);
    });

    it("should queue job to BullMQ", async () => {
      await importPortalUsers(
        makeReq("POST", "http://localhost/api/b2b/portal-users/import/api", {
          users: [{ username: "test.user", email: "test@example.com", password: "securePass1" }],
          merge_mode: "partial",
        }),
      );

      expect(queuedJobs).toHaveLength(1);
      expect(queuedJobs[0].name).toBe("portal-user-import");
      expect(queuedJobs[0].data.merge_mode).toBe("partial");
      expect(queuedJobs[0].data.tenant_id).toBe("test-tenant");
      expect(queuedJobs[0].data.users).toHaveLength(1);
    });

    it("should reject empty users array", async () => {
      const res = await importPortalUsers(
        makeReq("POST", "http://localhost/api/b2b/portal-users/import/api", {
          users: [],
        }),
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("empty");
    });

    it("should reject missing users array", async () => {
      const res = await importPortalUsers(
        makeReq("POST", "http://localhost/api/b2b/portal-users/import/api", {}),
      );

      expect(res.status).toBe(400);
    });

    it("should reject user without username", async () => {
      const res = await importPortalUsers(
        makeReq("POST", "http://localhost/api/b2b/portal-users/import/api", {
          users: [
            { username: "valid.user", email: "valid@example.com", password: "securePass1" },
            { email: "no-username@example.com", password: "securePass2" }, // Missing username
          ],
        }),
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("index 1");
      expect(data.error).toContain("username");
    });

    it("should reject exceeding max batch size", async () => {
      const users = Array.from({ length: 5001 }, (_, i) => ({
        username: `user-${i}`,
        email: `u${i}@test.com`,
        password: "securePass1",
      }));

      const res = await importPortalUsers(
        makeReq("POST", "http://localhost/api/b2b/portal-users/import/api", {
          users,
        }),
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("5000");
    });

    it("should reject invalid merge_mode", async () => {
      const res = await importPortalUsers(
        makeReq("POST", "http://localhost/api/b2b/portal-users/import/api", {
          users: [{ username: "test", email: "t@test.com", password: "securePass1" }],
          merge_mode: "invalid",
        }),
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("merge_mode");
    });

    it("should pass batch_metadata to ImportJob", async () => {
      await importPortalUsers(
        makeReq("POST", "http://localhost/api/b2b/portal-users/import/api", {
          users: [{ username: "test", email: "t@test.com", password: "securePass1" }],
          batch_metadata: {
            batch_id: "erp-sync-001",
            batch_part: 1,
            batch_total_parts: 3,
            batch_total_items: 300,
          },
        }),
      );

      const job = await ImportJobModel.findOne({ job_type: "portal_user_import" });
      expect(job).toBeDefined();
      expect(job!.batch_id).toBe("erp-sync-001");
      expect(job!.batch_part).toBe(1);
      expect(job!.batch_total_parts).toBe(3);
    });
  });

  // ============================================
  // WORKER LOGIC — CREATE
  // ============================================

  describe("Worker — Create New Portal Users", () => {
    it("should create new user with bcrypt-hashed password", async () => {
      await createImportJob("test-create-1", 1);

      const result = await processPortalUserImportData({
        job_id: "test-create-1",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        users: [{
          username: "mario.rossi",
          email: "mario@example.com",
          password: "securePass123",
        }],
      });

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(0);

      const user = await PortalUserModel.findOne({
        tenant_id: "test-tenant",
        username: "mario.rossi",
      });
      expect(user).toBeDefined();
      expect(user!.email).toBe("mario@example.com");

      // Verify password was hashed with bcrypt
      const passwordMatch = await bcrypt.compare("securePass123", user!.password_hash);
      expect(passwordMatch).toBe(true);
    });

    it("should create user with customer_access", async () => {
      await createImportJob("test-create-access", 1);

      await processPortalUserImportData({
        job_id: "test-create-access",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        users: [{
          username: "access.user",
          email: "access@example.com",
          password: "securePass123",
          customer_access: [
            { customer_id: "cust_abc123", address_access: "all" },
            { customer_id: "cust_def456", address_access: ["addr_001", "addr_002"] },
          ],
        }],
      });

      const user = await PortalUserModel.findOne({
        tenant_id: "test-tenant",
        username: "access.user",
      });
      expect(user!.customer_access).toHaveLength(2);
      expect(user!.customer_access[0].customer_id).toBe("cust_abc123");
      expect(user!.customer_access[0].address_access).toBe("all");
      expect(user!.customer_access[1].customer_id).toBe("cust_def456");
      expect(user!.customer_access[1].address_access).toEqual(["addr_001", "addr_002"]);
    });

    it("should set is_active to true by default", async () => {
      await createImportJob("test-create-active", 1);

      await processPortalUserImportData({
        job_id: "test-create-active",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        users: [{
          username: "default.active",
          email: "active@example.com",
          password: "securePass123",
        }],
      });

      const user = await PortalUserModel.findOne({
        tenant_id: "test-tenant",
        username: "default.active",
      });
      expect(user!.is_active).toBe(true);
    });

    it("should generate portal_user_id with PU- prefix", async () => {
      await createImportJob("test-create-id", 1);

      await processPortalUserImportData({
        job_id: "test-create-id",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        users: [{
          username: "id.test",
          email: "id@example.com",
          password: "securePass123",
        }],
      });

      const user = await PortalUserModel.findOne({
        tenant_id: "test-tenant",
        username: "id.test",
      });
      expect(user!.portal_user_id).toMatch(/^PU-/);
      expect(user!.portal_user_id.length).toBeGreaterThan(3);
    });

    it("should normalize username and email to lowercase", async () => {
      await createImportJob("test-create-normalize", 1);

      await processPortalUserImportData({
        job_id: "test-create-normalize",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        users: [{
          username: "Mario.ROSSI",
          email: "Mario@EXAMPLE.com",
          password: "securePass123",
        }],
      });

      const user = await PortalUserModel.findOne({
        tenant_id: "test-tenant",
        username: "mario.rossi",
      });
      expect(user).toBeDefined();
      expect(user!.email).toBe("mario@example.com");
    });

    it("should fail if password is missing for new user", async () => {
      await createImportJob("test-create-no-pass", 1);

      const result = await processPortalUserImportData({
        job_id: "test-create-no-pass",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        users: [{
          username: "no.password",
          email: "nopass@example.com",
        }],
      });

      expect(result.failed).toBe(1);

      const job = await ImportJobModel.findOne({ job_id: "test-create-no-pass" });
      expect(job!.import_errors[0].error).toContain("Password is required");
    });

  });

  // ============================================
  // WORKER LOGIC — REPLACE MODE
  // ============================================

  describe("Worker — Replace Mode", () => {
    it("should update existing user fields", async () => {
      await PortalUserModel.create({
        portal_user_id: "PU-existing1",
        tenant_id: "test-tenant",
        username: "existing.user",
        email: "old@example.com",
        password_hash: await bcrypt.hash("oldPassword1", 10),
        customer_access: [],
        is_active: true,
      });
      await createImportJob("test-replace-1", 1);

      await processPortalUserImportData({
        job_id: "test-replace-1",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        users: [{
          username: "existing.user",
          email: "new@example.com",
          is_active: false,
        }],
      });

      const updated = await PortalUserModel.findOne({
        tenant_id: "test-tenant",
        username: "existing.user",
      });
      expect(updated!.email).toBe("new@example.com");
      expect(updated!.is_active).toBe(false);
    });

    it("should update password (re-hash)", async () => {
      const oldHash = await bcrypt.hash("oldPassword1", 10);
      await PortalUserModel.create({
        portal_user_id: "PU-rehash1",
        tenant_id: "test-tenant",
        username: "rehash.user",
        email: "rehash@example.com",
        password_hash: oldHash,
        customer_access: [],
        is_active: true,
      });
      await createImportJob("test-replace-pass", 1);

      await processPortalUserImportData({
        job_id: "test-replace-pass",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        users: [{
          username: "rehash.user",
          email: "rehash@example.com",
          password: "newSecurePass123",
        }],
      });

      const updated = await PortalUserModel.findOne({
        tenant_id: "test-tenant",
        username: "rehash.user",
      });
      // Old password should not match
      const oldMatch = await bcrypt.compare("oldPassword1", updated!.password_hash);
      expect(oldMatch).toBe(false);
      // New password should match
      const newMatch = await bcrypt.compare("newSecurePass123", updated!.password_hash);
      expect(newMatch).toBe(true);
    });

    it("should replace customer_access entirely", async () => {
      await PortalUserModel.create({
        portal_user_id: "PU-access1",
        tenant_id: "test-tenant",
        username: "access.replace",
        email: "access@example.com",
        password_hash: await bcrypt.hash("securePass1", 10),
        customer_access: [
          { customer_id: "old_cust_1", address_access: "all" },
        ],
        is_active: true,
      });
      await createImportJob("test-replace-access", 1);

      await processPortalUserImportData({
        job_id: "test-replace-access",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        users: [{
          username: "access.replace",
          email: "access@example.com",
          customer_access: [
            { customer_id: "new_cust_1", address_access: "all" },
            { customer_id: "new_cust_2", address_access: ["addr_1"] },
          ],
        }],
      });

      const updated = await PortalUserModel.findOne({
        tenant_id: "test-tenant",
        username: "access.replace",
      });
      expect(updated!.customer_access).toHaveLength(2);
      expect(updated!.customer_access[0].customer_id).toBe("new_cust_1");
      expect(updated!.customer_access[1].customer_id).toBe("new_cust_2");
    });

    it("should not modify password_hash when password not provided", async () => {
      const originalHash = await bcrypt.hash("originalPass1", 10);
      await PortalUserModel.create({
        portal_user_id: "PU-nopass1",
        tenant_id: "test-tenant",
        username: "nopass.update",
        email: "nopass@example.com",
        password_hash: originalHash,
        customer_access: [],
        is_active: true,
      });
      await createImportJob("test-replace-nopass", 1);

      await processPortalUserImportData({
        job_id: "test-replace-nopass",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        users: [{
          username: "nopass.update",
          email: "updated@example.com",
          // No password provided
        }],
      });

      const updated = await PortalUserModel.findOne({
        tenant_id: "test-tenant",
        username: "nopass.update",
      });
      // Password hash should remain the same
      expect(updated!.password_hash).toBe(originalHash);
      expect(updated!.email).toBe("updated@example.com");
    });
  });

  // ============================================
  // WORKER LOGIC — PARTIAL MERGE
  // ============================================

  describe("Worker — Partial Merge Mode", () => {
    it("should only update provided fields", async () => {
      await PortalUserModel.create({
        portal_user_id: "PU-partial1",
        tenant_id: "test-tenant",
        username: "partial.user",
        email: "original@example.com",
        password_hash: await bcrypt.hash("securePass1", 10),
        customer_access: [
          { customer_id: "cust_1", address_access: "all" },
        ],
        is_active: true,
      });
      await createImportJob("test-partial-1", 1);

      await processPortalUserImportData({
        job_id: "test-partial-1",
        tenant_id: "test-tenant",
        merge_mode: "partial",
        users: [{
          username: "partial.user",
          email: "updated@example.com", // Only update email
        }],
      });

      const updated = await PortalUserModel.findOne({
        tenant_id: "test-tenant",
        username: "partial.user",
      });
      expect(updated!.email).toBe("updated@example.com");
      // customer_access should remain unchanged
      expect(updated!.customer_access).toHaveLength(1);
      expect(updated!.customer_access[0].customer_id).toBe("cust_1");
      expect(updated!.is_active).toBe(true);
    });

    it("should preserve existing customer_access when not provided", async () => {
      await PortalUserModel.create({
        portal_user_id: "PU-partial2",
        tenant_id: "test-tenant",
        username: "partial.access",
        email: "paccess@example.com",
        password_hash: await bcrypt.hash("securePass1", 10),
        customer_access: [
          { customer_id: "cust_keep_1", address_access: "all" },
          { customer_id: "cust_keep_2", address_access: ["addr_a"] },
        ],
        is_active: true,
      });
      await createImportJob("test-partial-access", 1);

      await processPortalUserImportData({
        job_id: "test-partial-access",
        tenant_id: "test-tenant",
        merge_mode: "partial",
        users: [{
          username: "partial.access",
          email: "paccess@example.com",
          is_active: false,
          // customer_access NOT provided — should be preserved
        }],
      });

      const updated = await PortalUserModel.findOne({
        tenant_id: "test-tenant",
        username: "partial.access",
      });
      expect(updated!.is_active).toBe(false);
      expect(updated!.customer_access).toHaveLength(2);
      expect(updated!.customer_access[0].customer_id).toBe("cust_keep_1");
      expect(updated!.customer_access[1].customer_id).toBe("cust_keep_2");
    });

    it("should update password without affecting other fields", async () => {
      await PortalUserModel.create({
        portal_user_id: "PU-partial3",
        tenant_id: "test-tenant",
        username: "partial.pass",
        email: "ppass@example.com",
        password_hash: await bcrypt.hash("oldPassword1", 10),
        customer_access: [{ customer_id: "cust_x", address_access: "all" }],
        is_active: true,
      });
      await createImportJob("test-partial-pass", 1);

      await processPortalUserImportData({
        job_id: "test-partial-pass",
        tenant_id: "test-tenant",
        merge_mode: "partial",
        users: [{
          username: "partial.pass",
          email: "ppass@example.com",
          password: "newSecurePass123",
        }],
      });

      const updated = await PortalUserModel.findOne({
        tenant_id: "test-tenant",
        username: "partial.pass",
      });
      const newMatch = await bcrypt.compare("newSecurePass123", updated!.password_hash);
      expect(newMatch).toBe(true);
      // Other fields preserved
      expect(updated!.customer_access).toHaveLength(1);
      expect(updated!.is_active).toBe(true);
    });
  });

  // ============================================
  // WORKER LOGIC — DUPLICATE HANDLING
  // ============================================

  describe("Worker — Duplicate Handling", () => {
    it("should handle email conflict gracefully (record error, continue batch)", async () => {
      // Create two existing users with different usernames
      await PortalUserModel.create({
        portal_user_id: "PU-dup1",
        tenant_id: "test-tenant",
        username: "user.one",
        email: "taken@example.com",
        password_hash: await bcrypt.hash("securePass1", 10),
        customer_access: [],
        is_active: true,
      });
      await createImportJob("test-dup-email", 2);

      const result = await processPortalUserImportData({
        job_id: "test-dup-email",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        users: [
          {
            username: "new.user",
            email: "taken@example.com", // Conflicts with user.one
            password: "securePass123",
          },
          {
            username: "good.user",
            email: "unique@example.com", // No conflict
            password: "securePass123",
          },
        ],
      });

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);

      const job = await ImportJobModel.findOne({ job_id: "test-dup-email" });
      expect(job!.import_errors).toHaveLength(1);
      expect(job!.import_errors[0].error).toContain("Email already used");
    });

    it("should update same username on re-import (idempotent)", async () => {
      await createImportJob("test-idempotent-1", 1);

      // First import: creates user
      await processPortalUserImportData({
        job_id: "test-idempotent-1",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        users: [{
          username: "idempotent.user",
          email: "idem@example.com",
          password: "securePass123",
        }],
      });

      let user = await PortalUserModel.findOne({
        tenant_id: "test-tenant",
        username: "idempotent.user",
      });
      expect(user).toBeDefined();
      expect(user!.email).toBe("idem@example.com");

      // Second import: updates same user
      await createImportJob("test-idempotent-2", 1);
      await processPortalUserImportData({
        job_id: "test-idempotent-2",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        users: [{
          username: "idempotent.user",
          email: "idem-updated@example.com",
        }],
      });

      user = await PortalUserModel.findOne({
        tenant_id: "test-tenant",
        username: "idempotent.user",
      });
      expect(user!.email).toBe("idem-updated@example.com");

      // Should still be only one user with this username
      const count = await PortalUserModel.countDocuments({
        tenant_id: "test-tenant",
        username: "idempotent.user",
      });
      expect(count).toBe(1);
    });
  });

  // ============================================
  // WORKER LOGIC — ERROR HANDLING & PROGRESS
  // ============================================

  describe("Worker — Error Handling and Progress", () => {
    it("should collect errors for invalid rows", async () => {
      await createImportJob("test-errors", 3);

      const result = await processPortalUserImportData({
        job_id: "test-errors",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        users: [
          { username: "good.user", email: "good@example.com", password: "securePass1" },
          { username: "", email: "nousername@example.com", password: "securePass1" } as any, // Empty username
          { username: "good2.user", email: "good2@example.com", password: "securePass1" },
        ],
      });

      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);

      const job = await ImportJobModel.findOne({ job_id: "test-errors" });
      expect(job!.import_errors).toHaveLength(1);
      expect(job!.import_errors[0].row).toBe(2);
      expect(job!.import_errors[0].error).toContain("username");
    });

    it("should track progress in ImportJob document", async () => {
      await createImportJob("test-progress", 2);

      await processPortalUserImportData({
        job_id: "test-progress",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        users: [
          { username: "prog.user1", email: "p1@example.com", password: "securePass1" },
          { username: "prog.user2", email: "p2@example.com", password: "securePass2" },
        ],
      });

      const job = await ImportJobModel.findOne({ job_id: "test-progress" });
      expect(job!.status).toBe("completed");
      expect(job!.processed_rows).toBe(2);
      expect(job!.successful_rows).toBe(2);
      expect(job!.failed_rows).toBe(0);
      expect(job!.completed_at).toBeDefined();
    });

    it("should handle batch of mixed valid and invalid users", async () => {
      await createImportJob("test-mixed", 4);

      const result = await processPortalUserImportData({
        job_id: "test-mixed",
        tenant_id: "test-tenant",
        merge_mode: "replace",
        users: [
          { username: "mix.ok1", email: "ok1@example.com", password: "securePass1" },
          { username: "mix.nopass", email: "nopass@example.com" }, // Missing password for new user
          { username: "mix.ok2", email: "ok2@example.com", password: "securePass2" },
          { username: "mix.noemail", email: "", password: "securePass3" }, // Missing email
        ],
      });

      expect(result.processed).toBe(4);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(2);

      const users = await PortalUserModel.find({ tenant_id: "test-tenant" });
      expect(users).toHaveLength(2);
    });
  });

  // ============================================
  // E2E: FULL PIPELINE
  // ============================================

  describe("e2e: Portal User Import Full Pipeline", () => {
    it("POST -> process -> GET status (all success)", async () => {
      // 1. POST to API route
      const postRes = await importPortalUsers(
        makeReq("POST", "http://localhost/api/b2b/portal-users/import/api", {
          users: [
            { username: "e2e.user1", email: "e2e1@example.com", password: "securePass1" },
            { username: "e2e.user2", email: "e2e2@example.com", password: "securePass2",
              customer_access: [{ customer_id: "cust_1", address_access: "all" }] },
            { username: "e2e.user3", email: "e2e3@example.com", password: "securePass3" },
          ],
        }),
      );
      const postData = await postRes.json();
      expect(postRes.status).toBe(202);
      expect(postData.job_id).toBeDefined();

      // 2. Process through real worker using queued data
      const queuedData = queuedJobs[0].data;
      await processPortalUserImportData(queuedData);

      // 3. GET status
      const statusRes = await getJobStatus(postData.job_id);
      const statusData = await statusRes.json();

      expect(statusRes.status).toBe(200);
      expect(statusData.success).toBe(true);
      expect(statusData.job.status).toBe("completed");
      expect(statusData.job.successful_rows).toBe(3);
      expect(statusData.job.failed_rows).toBe(0);
      expect(statusData.job.completed_at).toBeDefined();

      // 4. Verify DB state
      const users = await PortalUserModel.find({ tenant_id: "test-tenant" }).sort({ username: 1 });
      expect(users).toHaveLength(3);
      expect(users[0].username).toBe("e2e.user1");
      expect(users[1].username).toBe("e2e.user2");
      expect(users[1].customer_access).toHaveLength(1);
      expect(users[1].customer_access[0].customer_id).toBe("cust_1");
    });

    it("POST -> process -> GET status (mixed errors)", async () => {
      const postRes = await importPortalUsers(
        makeReq("POST", "http://localhost/api/b2b/portal-users/import/api", {
          users: [
            { username: "e2e.ok1", email: "ok1@example.com", password: "securePass1" },
            { username: "e2e.nopass", email: "nopass@example.com" }, // Missing password
            { username: "e2e.ok2", email: "ok2@example.com", password: "securePass2" },
            { username: "e2e.noemail", email: "", password: "securePass3" }, // Missing email
          ],
        }),
      );
      const postData = await postRes.json();
      expect(postRes.status).toBe(202);

      await processPortalUserImportData(queuedJobs[0].data);

      const statusRes = await getJobStatus(postData.job_id);
      const statusData = await statusRes.json();

      expect(statusData.job.status).toBe("completed");
      expect(statusData.job.successful_rows).toBe(2);
      expect(statusData.job.failed_rows).toBe(2);
      expect(statusData.job.import_errors).toHaveLength(2);
      expect(statusData.job.import_errors[0].error).toContain("Password is required");
      expect(statusData.job.import_errors[1].error).toContain("Missing email");
    });

    it("POST -> process -> GET with batch_metadata", async () => {
      const postRes = await importPortalUsers(
        makeReq("POST", "http://localhost/api/b2b/portal-users/import/api", {
          users: [{ username: "e2e.batch", email: "batch@example.com", password: "securePass1" }],
          batch_metadata: {
            batch_id: "erp-sync-20260209",
            batch_part: 2,
            batch_total_parts: 5,
          },
        }),
      );
      const postData = await postRes.json();

      await processPortalUserImportData(queuedJobs[0].data);

      const statusRes = await getJobStatus(postData.job_id);
      const statusData = await statusRes.json();

      expect(statusData.job.batch_id).toBe("erp-sync-20260209");
      expect(statusData.job.batch_part).toBe(2);
      expect(statusData.job.batch_total_parts).toBe(5);
    });

    it("POST -> process -> verify bcrypt password hashing end-to-end", async () => {
      const postRes = await importPortalUsers(
        makeReq("POST", "http://localhost/api/b2b/portal-users/import/api", {
          users: [
            { username: "e2e.hash1", email: "hash1@example.com", password: "mySecurePassword1" },
            { username: "e2e.hash2", email: "hash2@example.com", password: "anotherSecure99" },
          ],
        }),
      );
      const postData = await postRes.json();
      expect(postRes.status).toBe(202);

      await processPortalUserImportData(queuedJobs[0].data);

      const statusRes = await getJobStatus(postData.job_id);
      const statusData = await statusRes.json();
      expect(statusData.job.successful_rows).toBe(2);

      // Verify passwords are properly hashed (not stored plain)
      const user1 = await PortalUserModel.findOne({ tenant_id: "test-tenant", username: "e2e.hash1" });
      const user2 = await PortalUserModel.findOne({ tenant_id: "test-tenant", username: "e2e.hash2" });

      expect(user1!.password_hash).not.toBe("mySecurePassword1");
      expect(user1!.password_hash).toMatch(/^\$2[aby]\$/); // bcrypt prefix
      expect(await bcrypt.compare("mySecurePassword1", user1!.password_hash)).toBe(true);
      expect(await bcrypt.compare("wrongPassword", user1!.password_hash)).toBe(false);

      expect(await bcrypt.compare("anotherSecure99", user2!.password_hash)).toBe(true);
    });

    it("POST -> process -> replace mode updates existing user end-to-end", async () => {
      // Pre-create user
      await PortalUserModel.create({
        portal_user_id: "PU-e2e-replace",
        tenant_id: "test-tenant",
        username: "e2e.existing",
        email: "old@example.com",
        password_hash: await bcrypt.hash("oldPassword1", 10),
        customer_access: [{ customer_id: "old_cust", address_access: "all" }],
        is_active: true,
      });

      const postRes = await importPortalUsers(
        makeReq("POST", "http://localhost/api/b2b/portal-users/import/api", {
          merge_mode: "replace",
          users: [{
            username: "e2e.existing",
            email: "new@example.com",
            password: "newSecurePass1",
            customer_access: [
              { customer_id: "new_cust_1", address_access: "all" },
              { customer_id: "new_cust_2", address_access: ["addr_x"] },
            ],
            is_active: false,
          }],
        }),
      );
      const postData = await postRes.json();

      await processPortalUserImportData(queuedJobs[0].data);

      // Verify GET status
      const statusRes = await getJobStatus(postData.job_id);
      const statusData = await statusRes.json();
      expect(statusData.job.successful_rows).toBe(1);
      expect(statusData.job.failed_rows).toBe(0);

      // Verify DB state
      const user = await PortalUserModel.findOne({ tenant_id: "test-tenant", username: "e2e.existing" });
      expect(user!.email).toBe("new@example.com");
      expect(user!.is_active).toBe(false);
      expect(user!.customer_access).toHaveLength(2);
      expect(user!.customer_access[0].customer_id).toBe("new_cust_1");
      expect(user!.customer_access[1].address_access).toEqual(["addr_x"]);

      // Verify new password, old password invalid
      expect(await bcrypt.compare("newSecurePass1", user!.password_hash)).toBe(true);
      expect(await bcrypt.compare("oldPassword1", user!.password_hash)).toBe(false);

      // Should still be only one user
      const count = await PortalUserModel.countDocuments({ tenant_id: "test-tenant", username: "e2e.existing" });
      expect(count).toBe(1);
    });

    it("POST -> process -> partial merge preserves untouched fields end-to-end", async () => {
      // Pre-create user with all fields
      await PortalUserModel.create({
        portal_user_id: "PU-e2e-partial",
        tenant_id: "test-tenant",
        username: "e2e.partial",
        email: "original@example.com",
        password_hash: await bcrypt.hash("originalPass1", 10),
        customer_access: [
          { customer_id: "keep_cust_1", address_access: "all" },
          { customer_id: "keep_cust_2", address_access: ["addr_1"] },
        ],
        is_active: true,
      });

      // Only update email via partial merge
      const postRes = await importPortalUsers(
        makeReq("POST", "http://localhost/api/b2b/portal-users/import/api", {
          merge_mode: "partial",
          users: [{
            username: "e2e.partial",
            email: "updated@example.com",
            // No password, no customer_access, no is_active
          }],
        }),
      );
      const postData = await postRes.json();

      await processPortalUserImportData(queuedJobs[0].data);

      const statusRes = await getJobStatus(postData.job_id);
      const statusData = await statusRes.json();
      expect(statusData.job.successful_rows).toBe(1);

      const user = await PortalUserModel.findOne({ tenant_id: "test-tenant", username: "e2e.partial" });
      // Email updated
      expect(user!.email).toBe("updated@example.com");
      // Everything else preserved
      expect(user!.is_active).toBe(true);
      expect(user!.customer_access).toHaveLength(2);
      expect(user!.customer_access[0].customer_id).toBe("keep_cust_1");
      expect(await bcrypt.compare("originalPass1", user!.password_hash)).toBe(true);
    });

    it("POST -> process -> duplicate email conflict reported in GET status", async () => {
      // Pre-create user owning the email
      await PortalUserModel.create({
        portal_user_id: "PU-e2e-dup",
        tenant_id: "test-tenant",
        username: "email.owner",
        email: "taken@example.com",
        password_hash: await bcrypt.hash("securePass1", 10),
        customer_access: [],
        is_active: true,
      });

      const postRes = await importPortalUsers(
        makeReq("POST", "http://localhost/api/b2b/portal-users/import/api", {
          users: [
            { username: "e2e.dup.ok", email: "unique@example.com", password: "securePass1" },
            { username: "e2e.dup.conflict", email: "taken@example.com", password: "securePass2" },
            { username: "e2e.dup.ok2", email: "unique2@example.com", password: "securePass3" },
          ],
        }),
      );
      const postData = await postRes.json();

      await processPortalUserImportData(queuedJobs[0].data);

      const statusRes = await getJobStatus(postData.job_id);
      const statusData = await statusRes.json();

      expect(statusData.job.successful_rows).toBe(2);
      expect(statusData.job.failed_rows).toBe(1);
      expect(statusData.job.import_errors).toHaveLength(1);
      expect(statusData.job.import_errors[0].entity_code).toBe("e2e.dup.conflict");
      expect(statusData.job.import_errors[0].error).toContain("Email already used");
    });

    it("POST -> process -> idempotent re-import same username end-to-end", async () => {
      // First import: create user
      const postRes1 = await importPortalUsers(
        makeReq("POST", "http://localhost/api/b2b/portal-users/import/api", {
          users: [{
            username: "e2e.idempotent",
            email: "idem@example.com",
            password: "securePass123",
            customer_access: [{ customer_id: "cust_v1", address_access: "all" }],
          }],
        }),
      );
      const postData1 = await postRes1.json();
      await processPortalUserImportData(queuedJobs[0].data);

      let statusData = await (await getJobStatus(postData1.job_id)).json();
      expect(statusData.job.successful_rows).toBe(1);

      // Second import: update same user
      queuedJobs.length = 0;
      const postRes2 = await importPortalUsers(
        makeReq("POST", "http://localhost/api/b2b/portal-users/import/api", {
          merge_mode: "replace",
          users: [{
            username: "e2e.idempotent",
            email: "idem-v2@example.com",
            customer_access: [
              { customer_id: "cust_v2_a", address_access: "all" },
              { customer_id: "cust_v2_b", address_access: ["addr_1"] },
            ],
          }],
        }),
      );
      const postData2 = await postRes2.json();
      await processPortalUserImportData(queuedJobs[0].data);

      statusData = await (await getJobStatus(postData2.job_id)).json();
      expect(statusData.job.successful_rows).toBe(1);

      // Verify final state
      const user = await PortalUserModel.findOne({ tenant_id: "test-tenant", username: "e2e.idempotent" });
      expect(user!.email).toBe("idem-v2@example.com");
      expect(user!.customer_access).toHaveLength(2);
      expect(user!.customer_access[0].customer_id).toBe("cust_v2_a");

      // Original password still works (wasn't changed in second import)
      expect(await bcrypt.compare("securePass123", user!.password_hash)).toBe(true);

      // Still only one user
      const count = await PortalUserModel.countDocuments({ tenant_id: "test-tenant", username: "e2e.idempotent" });
      expect(count).toBe(1);
    });

    it("GET returns 404 for non-existent job", async () => {
      const res = await getJobStatus("non-existent-job-id");
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain("not found");
    });

    it("POST -> process -> short passwords are accepted and hashed correctly", async () => {
      const postRes = await importPortalUsers(
        makeReq("POST", "http://localhost/api/b2b/portal-users/import/api", {
          users: [
            { username: "e2e.short1", email: "short1@example.com", password: "ab" },
            { username: "e2e.short2", email: "short2@example.com", password: "x" },
            { username: "e2e.short3", email: "short3@example.com", password: "1234" },
          ],
        }),
      );
      const postData = await postRes.json();
      expect(postRes.status).toBe(202);

      await processPortalUserImportData(queuedJobs[0].data);

      const statusRes = await getJobStatus(postData.job_id);
      const statusData = await statusRes.json();

      expect(statusData.job.status).toBe("completed");
      expect(statusData.job.successful_rows).toBe(3);
      expect(statusData.job.failed_rows).toBe(0);

      // Verify all short passwords are properly bcrypt-hashed
      const user1 = await PortalUserModel.findOne({ tenant_id: "test-tenant", username: "e2e.short1" });
      const user2 = await PortalUserModel.findOne({ tenant_id: "test-tenant", username: "e2e.short2" });
      const user3 = await PortalUserModel.findOne({ tenant_id: "test-tenant", username: "e2e.short3" });

      expect(user1!.password_hash).toMatch(/^\$2[aby]\$/);
      expect(await bcrypt.compare("ab", user1!.password_hash)).toBe(true);
      expect(await bcrypt.compare("x", user2!.password_hash)).toBe(true);
      expect(await bcrypt.compare("1234", user3!.password_hash)).toBe(true);
    });

    it("POST -> process -> massive import with short passwords", async () => {
      const userCount = 200;
      const users = Array.from({ length: userCount }, (_, i) => ({
        username: `mass.user${String(i).padStart(4, "0")}`,
        email: `mass${i}@example.com`,
        password: String(i % 10), // single-digit passwords
        customer_access: i % 3 === 0
          ? [{ customer_id: `cust_${i}`, address_access: "all" as const }]
          : [],
        is_active: i % 5 !== 0,
      }));

      const postRes = await importPortalUsers(
        makeReq("POST", "http://localhost/api/b2b/portal-users/import/api", { users }),
      );
      const postData = await postRes.json();
      expect(postRes.status).toBe(202);

      await processPortalUserImportData(queuedJobs[0].data);

      // Verify GET status
      const statusRes = await getJobStatus(postData.job_id);
      const statusData = await statusRes.json();

      expect(statusData.job.status).toBe("completed");
      expect(statusData.job.successful_rows).toBe(userCount);
      expect(statusData.job.failed_rows).toBe(0);
      expect(statusData.job.completed_at).toBeDefined();
      expect(statusData.job.duration_seconds).toBeGreaterThanOrEqual(0);

      // Verify DB count
      const dbUsers = await PortalUserModel.countDocuments({ tenant_id: "test-tenant" });
      expect(dbUsers).toBe(userCount);

      // Spot-check a few users
      const user0 = await PortalUserModel.findOne({ tenant_id: "test-tenant", username: "mass.user0000" });
      expect(user0).toBeDefined();
      expect(user0!.email).toBe("mass0@example.com");
      expect(user0!.is_active).toBe(false); // 0 % 5 === 0
      expect(user0!.customer_access).toHaveLength(1); // 0 % 3 === 0
      expect(await bcrypt.compare("0", user0!.password_hash)).toBe(true);

      const user99 = await PortalUserModel.findOne({ tenant_id: "test-tenant", username: "mass.user0099" });
      expect(user99).toBeDefined();
      expect(user99!.email).toBe("mass99@example.com");
      expect(user99!.is_active).toBe(true); // 99 % 5 !== 0
      expect(user99!.customer_access).toHaveLength(1); // 99 % 3 === 0
      expect(await bcrypt.compare("9", user99!.password_hash)).toBe(true); // 99 % 10

      const user150 = await PortalUserModel.findOne({ tenant_id: "test-tenant", username: "mass.user0150" });
      expect(user150).toBeDefined();
      expect(user150!.is_active).toBe(false); // 150 % 5 === 0
      expect(user150!.customer_access).toHaveLength(1); // 150 % 3 === 0
      expect(await bcrypt.compare("0", user150!.password_hash)).toBe(true); // 150 % 10
    }, 120_000);
  });
});
