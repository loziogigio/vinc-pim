/**
 * Likes API Integration Tests
 *
 * Tests for add, remove, toggle, status, bulk status,
 * user likes, popular, trending, and analytics.
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
import { ProductLikeSchema, LikeStatsSchema } from "@/lib/db/models/product-like";

// Create test models
const ProductLikeModel =
  mongoose.models.ProductLike || mongoose.model("ProductLike", ProductLikeSchema);
const LikeStatsModel =
  mongoose.models.LikeStats || mongoose.model("LikeStats", LikeStatsSchema);

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
      ProductLike: ProductLikeModel,
      LikeStats: LikeStatsModel,
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

import { POST as addLikeRoute, DELETE as removeLikeRoute } from "@/app/api/b2b/likes/route";
import { POST as toggleLikeRoute } from "@/app/api/b2b/likes/toggle/route";
import { GET as getLikeStatusRoute } from "@/app/api/b2b/likes/status/[sku]/route";
import { POST as bulkStatusRoute } from "@/app/api/b2b/likes/status/bulk/route";
import { GET as getUserLikesRoute } from "@/app/api/b2b/likes/user/route";
import { GET as getPopularRoute } from "@/app/api/b2b/likes/popular/route";
import { GET as getTrendingRoute } from "@/app/api/b2b/likes/trending/route";
import { GET as getAnalyticsRoute } from "@/app/api/b2b/likes/analytics/route";

// ============================================
// TESTS
// ============================================

describe("api: Likes", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  }, 30_000);

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  // --- Add Like ---

  it("should add a like (POST /api/b2b/likes)", async () => {
    const req = new NextRequest("http://localhost/api/b2b/likes", {
      method: "POST",
      body: JSON.stringify({ sku: "PROD-001" }),
    });

    const res = await addLikeRoute(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.sku).toBe("PROD-001");
    expect(body.data.is_active).toBe(true);
    expect(body.data.total_likes).toBe(1);
  });

  it("should return existing like on duplicate add", async () => {
    const req1 = new NextRequest("http://localhost/api/b2b/likes", {
      method: "POST",
      body: JSON.stringify({ sku: "PROD-001" }),
    });
    await addLikeRoute(req1);

    const req2 = new NextRequest("http://localhost/api/b2b/likes", {
      method: "POST",
      body: JSON.stringify({ sku: "PROD-001" }),
    });
    const res = await addLikeRoute(req2);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.data.total_likes).toBe(1); // Not incremented
  });

  it("should reject add without sku", async () => {
    const req = new NextRequest("http://localhost/api/b2b/likes", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await addLikeRoute(req);
    expect(res.status).toBe(400);
  });

  // --- Remove Like ---

  it("should remove a like (DELETE /api/b2b/likes)", async () => {
    // First add
    const addReq = new NextRequest("http://localhost/api/b2b/likes", {
      method: "POST",
      body: JSON.stringify({ sku: "PROD-002" }),
    });
    await addLikeRoute(addReq);

    // Then remove
    const delReq = new NextRequest("http://localhost/api/b2b/likes", {
      method: "DELETE",
      body: JSON.stringify({ sku: "PROD-002" }),
    });
    const res = await removeLikeRoute(delReq);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.removed).toBe(true);
    expect(body.data.total_likes).toBe(0);
  });

  it("should return 404 when removing non-existent like", async () => {
    const req = new NextRequest("http://localhost/api/b2b/likes", {
      method: "DELETE",
      body: JSON.stringify({ sku: "NONEXISTENT" }),
    });

    const res = await removeLikeRoute(req);
    expect(res.status).toBe(404);
  });

  // --- Toggle ---

  it("should toggle like (like -> unlike -> like)", async () => {
    // First toggle: like
    const req1 = new NextRequest("http://localhost/api/b2b/likes/toggle", {
      method: "POST",
      body: JSON.stringify({ sku: "PROD-003" }),
    });
    const res1 = await toggleLikeRoute(req1);
    const body1 = await res1.json();
    expect(body1.data.action).toBe("liked");
    expect(body1.data.is_liked).toBe(true);

    // Second toggle: unlike
    const req2 = new NextRequest("http://localhost/api/b2b/likes/toggle", {
      method: "POST",
      body: JSON.stringify({ sku: "PROD-003" }),
    });
    const res2 = await toggleLikeRoute(req2);
    const body2 = await res2.json();
    expect(body2.data.action).toBe("unliked");
    expect(body2.data.is_liked).toBe(false);

    // Third toggle: like again
    const req3 = new NextRequest("http://localhost/api/b2b/likes/toggle", {
      method: "POST",
      body: JSON.stringify({ sku: "PROD-003" }),
    });
    const res3 = await toggleLikeRoute(req3);
    const body3 = await res3.json();
    expect(body3.data.action).toBe("liked");
    expect(body3.data.is_liked).toBe(true);
  });

  // --- Status ---

  it("should get like status (GET /api/b2b/likes/status/[sku])", async () => {
    // Add a like first
    const addReq = new NextRequest("http://localhost/api/b2b/likes", {
      method: "POST",
      body: JSON.stringify({ sku: "PROD-004" }),
    });
    await addLikeRoute(addReq);

    const req = new NextRequest("http://localhost/api/b2b/likes/status/PROD-004");
    const res = await getLikeStatusRoute(req, createParams({ sku: "PROD-004" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.is_liked).toBe(true);
    expect(body.data.total_likes).toBe(1);
  });

  // --- Bulk Status ---

  it("should get bulk like status", async () => {
    // Add some likes
    for (const sku of ["BULK-A", "BULK-B"]) {
      const req = new NextRequest("http://localhost/api/b2b/likes", {
        method: "POST",
        body: JSON.stringify({ sku }),
      });
      await addLikeRoute(req);
    }

    const req = new NextRequest("http://localhost/api/b2b/likes/status/bulk", {
      method: "POST",
      body: JSON.stringify({ skus: ["BULK-A", "BULK-B", "BULK-C"] }),
    });
    const res = await bulkStatusRoute(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(3);
    expect(body.data[0].is_liked).toBe(true);
    expect(body.data[1].is_liked).toBe(true);
    expect(body.data[2].is_liked).toBe(false);
  });

  // --- User Likes ---

  it("should get user likes paginated", async () => {
    // Add several likes
    for (const sku of ["UL-1", "UL-2", "UL-3"]) {
      const req = new NextRequest("http://localhost/api/b2b/likes", {
        method: "POST",
        body: JSON.stringify({ sku }),
      });
      await addLikeRoute(req);
    }

    const req = new NextRequest("http://localhost/api/b2b/likes/user?page=1&limit=2");
    const res = await getUserLikesRoute(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.likes).toHaveLength(2);
    expect(body.data.total_count).toBe(3);
    expect(body.data.has_next).toBe(true);
  });

  // --- Popular ---

  it("should get popular products", async () => {
    const addReq = new NextRequest("http://localhost/api/b2b/likes", {
      method: "POST",
      body: JSON.stringify({ sku: "POP-1" }),
    });
    await addLikeRoute(addReq);

    const req = new NextRequest("http://localhost/api/b2b/likes/popular?limit=10&days=30");
    const res = await getPopularRoute(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  // --- Trending ---

  it("should get trending products", async () => {
    const addReq = new NextRequest("http://localhost/api/b2b/likes", {
      method: "POST",
      body: JSON.stringify({ sku: "TREND-1" }),
    });
    await addLikeRoute(addReq);

    const req = new NextRequest("http://localhost/api/b2b/likes/trending?period=7d&limit=10");
    const res = await getTrendingRoute(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.period).toBe("7d");
    expect(Array.isArray(body.data.products)).toBe(true);
  });

  // --- Analytics ---

  it("should get analytics summary", async () => {
    const addReq = new NextRequest("http://localhost/api/b2b/likes", {
      method: "POST",
      body: JSON.stringify({ sku: "ANALYTICS-1" }),
    });
    await addLikeRoute(addReq);

    const req = new NextRequest("http://localhost/api/b2b/likes/analytics?period=30d");
    const res = await getAnalyticsRoute(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.period).toBe("30d");
    expect(body.data.total_likes).toBeGreaterThanOrEqual(0);
    expect(body.data.likes_in_period).toBeGreaterThanOrEqual(0);
  });
});
