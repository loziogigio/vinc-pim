/**
 * Reminders API Integration Tests
 *
 * Tests for create, cancel, toggle, status, bulk status,
 * user reminders, stats, and expire.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
  createParams,
} from "../conftest";
import { ProductReminderSchema } from "@/lib/db/models/product-reminder";

// Create test model
const ProductReminderModel =
  mongoose.models.ProductReminder ||
  mongoose.model("ProductReminder", ProductReminderSchema);

// ============================================
// MOCKS
// ============================================

vi.mock("@/lib/auth/tenant-auth", () => ({
  requireTenantAuth: vi.fn(() =>
    Promise.resolve({
      success: true,
      tenantId: "test-tenant",
      tenantDb: "vinc-test-tenant",
      userId: "test-user-123",
    })
  ),
}));

vi.mock("@/lib/db/model-registry", () => ({
  connectWithModels: vi.fn(() =>
    Promise.resolve({
      ProductReminder: ProductReminderModel,
    })
  ),
}));

vi.mock("@/lib/cache/redis-client", () => {
  const store: Record<string, string> = {};
  return {
    getRedis: vi.fn(() => ({
      get: vi.fn((key: string) => Promise.resolve(store[key] || null)),
      setex: vi.fn((key: string, _ttl: number, value: string) => {
        store[key] = value;
        return Promise.resolve("OK");
      }),
      del: vi.fn((...keys: string[]) => {
        for (const k of keys) delete store[k];
        return Promise.resolve(keys.length);
      }),
    })),
  };
});

// ============================================
// ROUTE IMPORTS — after mocks
// ============================================

import { POST as createReminderRoute, DELETE as cancelReminderRoute } from "@/app/api/b2b/reminders/route";
import { POST as toggleReminderRoute } from "@/app/api/b2b/reminders/toggle/route";
import { GET as getReminderStatusRoute } from "@/app/api/b2b/reminders/status/[sku]/route";
import { POST as bulkStatusRoute } from "@/app/api/b2b/reminders/status/bulk/route";
import { GET as getUserRemindersRoute } from "@/app/api/b2b/reminders/user/route";
import { GET as getReminderStatsRoute } from "@/app/api/b2b/reminders/stats/[sku]/route";
import { POST as expireRoute } from "@/app/api/b2b/reminders/expire/route";

// ============================================
// TESTS
// ============================================

describe("api: Reminders", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  }, 30_000);

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  // --- Create Reminder ---

  it("should create a reminder (POST /api/b2b/reminders)", async () => {
    const req = new NextRequest("http://localhost/api/b2b/reminders", {
      method: "POST",
      body: JSON.stringify({ sku: "REM-001", email: "user@test.com" }),
    });

    const res = await createReminderRoute(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.sku).toBe("REM-001");
    expect(body.data.status).toBe("active");
    expect(body.data.email).toBe("user@test.com");
  });

  it("should return existing reminder on duplicate create", async () => {
    const req1 = new NextRequest("http://localhost/api/b2b/reminders", {
      method: "POST",
      body: JSON.stringify({ sku: "REM-001" }),
    });
    await createReminderRoute(req1);

    const req2 = new NextRequest("http://localhost/api/b2b/reminders", {
      method: "POST",
      body: JSON.stringify({ sku: "REM-001" }),
    });
    const res = await createReminderRoute(req2);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.data.status).toBe("active");
  });

  it("should reject create without sku", async () => {
    const req = new NextRequest("http://localhost/api/b2b/reminders", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await createReminderRoute(req);
    expect(res.status).toBe(400);
  });

  // --- Cancel Reminder ---

  it("should cancel a reminder (DELETE /api/b2b/reminders)", async () => {
    // Create first
    const createReq = new NextRequest("http://localhost/api/b2b/reminders", {
      method: "POST",
      body: JSON.stringify({ sku: "REM-002" }),
    });
    await createReminderRoute(createReq);

    // Cancel
    const cancelReq = new NextRequest("http://localhost/api/b2b/reminders", {
      method: "DELETE",
      body: JSON.stringify({ sku: "REM-002" }),
    });
    const res = await cancelReminderRoute(cancelReq);
    expect(res.status).toBe(200);
  });

  it("should return 404 when cancelling non-existent reminder", async () => {
    const req = new NextRequest("http://localhost/api/b2b/reminders", {
      method: "DELETE",
      body: JSON.stringify({ sku: "NONEXISTENT" }),
    });

    const res = await cancelReminderRoute(req);
    expect(res.status).toBe(404);
  });

  // --- Toggle ---

  it("should toggle reminder (create -> cancel -> create)", async () => {
    // First toggle: create
    const req1 = new NextRequest("http://localhost/api/b2b/reminders/toggle", {
      method: "POST",
      body: JSON.stringify({ sku: "REM-003" }),
    });
    const res1 = await toggleReminderRoute(req1);
    const body1 = await res1.json();
    expect(body1.data.action).toBe("created");
    expect(body1.data.has_active_reminder).toBe(true);

    // Second toggle: cancel
    const req2 = new NextRequest("http://localhost/api/b2b/reminders/toggle", {
      method: "POST",
      body: JSON.stringify({ sku: "REM-003" }),
    });
    const res2 = await toggleReminderRoute(req2);
    const body2 = await res2.json();
    expect(body2.data.action).toBe("cancelled");
    expect(body2.data.has_active_reminder).toBe(false);

    // Third toggle: create again
    const req3 = new NextRequest("http://localhost/api/b2b/reminders/toggle", {
      method: "POST",
      body: JSON.stringify({ sku: "REM-003" }),
    });
    const res3 = await toggleReminderRoute(req3);
    const body3 = await res3.json();
    expect(body3.data.action).toBe("created");
    expect(body3.data.has_active_reminder).toBe(true);
  });

  // --- Status ---

  it("should get reminder status (GET /api/b2b/reminders/status/[sku])", async () => {
    // Create first
    const createReq = new NextRequest("http://localhost/api/b2b/reminders", {
      method: "POST",
      body: JSON.stringify({ sku: "REM-004" }),
    });
    await createReminderRoute(createReq);

    const req = new NextRequest("http://localhost/api/b2b/reminders/status/REM-004");
    const res = await getReminderStatusRoute(req, createParams({ sku: "REM-004" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.has_active_reminder).toBe(true);
    expect(body.data.status).toBe("active");
  });

  // --- Bulk Status ---

  it("should get bulk reminder status", async () => {
    // Create reminders for some SKUs
    for (const sku of ["BULK-R1", "BULK-R2"]) {
      const req = new NextRequest("http://localhost/api/b2b/reminders", {
        method: "POST",
        body: JSON.stringify({ sku }),
      });
      await createReminderRoute(req);
    }

    const req = new NextRequest("http://localhost/api/b2b/reminders/status/bulk", {
      method: "POST",
      body: JSON.stringify({ skus: ["BULK-R1", "BULK-R2", "BULK-R3"] }),
    });
    const res = await bulkStatusRoute(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(3);
    expect(body.data[0].has_active_reminder).toBe(true);
    expect(body.data[1].has_active_reminder).toBe(true);
    expect(body.data[2].has_active_reminder).toBe(false);
  });

  // --- User Reminders ---

  it("should get user reminders paginated", async () => {
    for (const sku of ["UR-1", "UR-2", "UR-3"]) {
      const req = new NextRequest("http://localhost/api/b2b/reminders", {
        method: "POST",
        body: JSON.stringify({ sku }),
      });
      await createReminderRoute(req);
    }

    const req = new NextRequest("http://localhost/api/b2b/reminders/user?page=1&limit=2");
    const res = await getUserRemindersRoute(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.reminders).toHaveLength(2);
    expect(body.data.total_count).toBe(3);
    expect(body.data.has_next).toBe(true);
  });

  // --- Product Stats ---

  it("should get reminder stats for a product", async () => {
    const createReq = new NextRequest("http://localhost/api/b2b/reminders", {
      method: "POST",
      body: JSON.stringify({ sku: "STATS-1" }),
    });
    await createReminderRoute(createReq);

    const req = new NextRequest("http://localhost/api/b2b/reminders/stats/STATS-1");
    const res = await getReminderStatsRoute(req, createParams({ sku: "STATS-1" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.sku).toBe("STATS-1");
    expect(body.data.active_count).toBeGreaterThanOrEqual(0);
  });

  // --- Expire ---

  it("should expire old reminders", async () => {
    // Create a reminder that's already expired
    await ProductReminderModel.create({
      tenant_id: "test-tenant",
      user_id: "test-user-123",
      sku: "EXPIRE-1",
      status: "active",
      is_active: true,
      expires_at: new Date(Date.now() - 86400000), // Yesterday
    });

    const req = new NextRequest("http://localhost/api/b2b/reminders/expire", {
      method: "POST",
    });
    const res = await expireRoute(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.expired_count).toBe(1);

    // Verify it was actually expired
    const doc = await ProductReminderModel.findOne({ sku: "EXPIRE-1" }).lean();
    expect((doc as { status: string }).status).toBe("expired");
    expect((doc as { is_active: boolean }).is_active).toBe(false);
  });
});
