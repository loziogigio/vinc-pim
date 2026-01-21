/**
 * Correlations API Integration Tests
 *
 * Tests for product correlation CRUD operations and stats.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
  CorrelationFactory,
  PIMProductFactory,
  createParams,
} from "../conftest";

// Mock connection - must be before imports
vi.mock("@/lib/db/connection", async () => {
  const { ProductCorrelationModel } = await import("@/lib/db/models/product-correlation");
  const { PIMProductModel } = await import("@/lib/db/models/pim-product");
  const { ImportJobModel } = await import("@/lib/db/models/import-job");
  const mongoose = await import("mongoose");
  return {
    connectToDatabase: vi.fn(() => Promise.resolve()),
    connectWithModels: vi.fn(() =>
      Promise.resolve({
        ProductCorrelation: ProductCorrelationModel,
        PIMProduct: PIMProductModel,
        ImportJob: ImportJobModel,
      })
    ),
    getPooledConnection: vi.fn(() => Promise.resolve(mongoose.default.connection)),
  };
});

// Mock session auth
vi.mock("@/lib/auth/b2b-session", () => ({
  getB2BSession: vi.fn(() =>
    Promise.resolve({
      isLoggedIn: true,
      userId: "test-user",
      tenantId: "test-tenant",
    })
  ),
}));

// Mock API key auth to bypass real API key verification
vi.mock("@/lib/auth/api-key-auth", () => ({
  verifyAPIKeyFromRequest: vi.fn(() =>
    Promise.resolve({
      authenticated: true,
      tenantId: "test-tenant",
      tenantDb: "vinc-test-tenant",
      keyId: "test-api-key",
    })
  ),
}));

// Import after mocks
import {
  GET as listCorrelations,
  POST as createCorrelation,
} from "@/app/api/b2b/correlations/route";
import {
  GET as getCorrelation,
  PATCH as updateCorrelation,
  DELETE as deleteCorrelation,
} from "@/app/api/b2b/correlations/[id]/route";
import { GET as getStats } from "@/app/api/b2b/correlations/stats/route";
import { ProductCorrelationModel } from "@/lib/db/models/product-correlation";
import { PIMProductModel } from "@/lib/db/models/pim-product";

// ============================================
// TEST SETUP
// ============================================

describe("integration: Correlations API", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  // ============================================
  // POST /api/b2b/correlations - Create Correlation
  // ============================================

  describe("POST /api/b2b/correlations", () => {
    it("should create correlation with valid payload", async () => {
      /**
       * Test creating a correlation between two existing products.
       * Verifies correlation_id generation and target_product enrichment.
       */
      // Arrange - Create source and target products
      const sourceProduct = PIMProductFactory.createPayload({ entity_code: "SOURCE-001" });
      const targetProduct = PIMProductFactory.createPayload({ entity_code: "TARGET-001" });
      await PIMProductModel.create(sourceProduct);
      await PIMProductModel.create(targetProduct);

      const payload = {
        source_entity_code: "SOURCE-001",
        target_entity_code: "TARGET-001",
        correlation_type: "related",
        is_bidirectional: false,
      };

      const req = new NextRequest("http://localhost/api/b2b/correlations", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
        },
      });

      // Act
      const res = await createCorrelation(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.correlations).toHaveLength(1);
      expect(data.correlations[0].correlation_id).toBeDefined();
      expect(data.correlations[0].source_entity_code).toBe("SOURCE-001");
      expect(data.correlations[0].target_entity_code).toBe("TARGET-001");
      expect(data.correlations[0].target_product).toBeDefined();
      expect(data.correlations[0].target_product.entity_code).toBe("TARGET-001");
    });

    it("should create bidirectional correlations", async () => {
      /**
       * Test creating bidirectional correlation creates both A→B and B→A.
       */
      // Arrange
      const sourceProduct = PIMProductFactory.createPayload({ entity_code: "BIDIR-A" });
      const targetProduct = PIMProductFactory.createPayload({ entity_code: "BIDIR-B" });
      await PIMProductModel.create(sourceProduct);
      await PIMProductModel.create(targetProduct);

      const payload = {
        source_entity_code: "BIDIR-A",
        target_entity_code: "BIDIR-B",
        is_bidirectional: true,
      };

      const req = new NextRequest("http://localhost/api/b2b/correlations", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
        },
      });

      // Act
      const res = await createCorrelation(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.correlations).toHaveLength(2);
      expect(data.message).toBe("Created 2 correlation(s)");

      // Verify both directions
      const forwardCorr = data.correlations.find(
        (c: { source_entity_code: string }) => c.source_entity_code === "BIDIR-A"
      );
      const reverseCorr = data.correlations.find(
        (c: { source_entity_code: string }) => c.source_entity_code === "BIDIR-B"
      );

      expect(forwardCorr).toBeDefined();
      expect(reverseCorr).toBeDefined();
      expect(forwardCorr.is_bidirectional).toBe(true);
      expect(reverseCorr.is_bidirectional).toBe(true);
    });

    it("should return 400 when source_entity_code is missing", async () => {
      /**
       * Test validation: source_entity_code is required.
       */
      // Arrange
      const req = new NextRequest("http://localhost/api/b2b/correlations", {
        method: "POST",
        body: JSON.stringify({ target_entity_code: "TARGET-001" }),
        headers: { "Content-Type": "application/json" },
      });

      // Act
      const res = await createCorrelation(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(400);
      expect(data.error).toContain("source_entity_code");
    });

    it("should return 400 when target_entity_code is missing", async () => {
      /**
       * Test validation: target_entity_code is required.
       */
      // Arrange
      const req = new NextRequest("http://localhost/api/b2b/correlations", {
        method: "POST",
        body: JSON.stringify({ source_entity_code: "SOURCE-001" }),
        headers: { "Content-Type": "application/json" },
      });

      // Act
      const res = await createCorrelation(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(400);
      expect(data.error).toContain("target_entity_code");
    });

    it("should return 400 for self-correlation", async () => {
      /**
       * Test that a product cannot correlate to itself.
       */
      // Arrange
      const product = PIMProductFactory.createPayload({ entity_code: "SELF-001" });
      await PIMProductModel.create(product);

      const req = new NextRequest("http://localhost/api/b2b/correlations", {
        method: "POST",
        body: JSON.stringify({
          source_entity_code: "SELF-001",
          target_entity_code: "SELF-001",
        }),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
        },
      });

      // Act
      const res = await createCorrelation(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(400);
      expect(data.error).toContain("Cannot create correlation to the same product");
    });

    it("should return 400 for invalid correlation_type", async () => {
      /**
       * Test validation: correlation_type must be a valid type.
       */
      // Arrange
      const sourceProduct = PIMProductFactory.createPayload({ entity_code: "TYPE-A" });
      const targetProduct = PIMProductFactory.createPayload({ entity_code: "TYPE-B" });
      await PIMProductModel.create(sourceProduct);
      await PIMProductModel.create(targetProduct);

      const req = new NextRequest("http://localhost/api/b2b/correlations", {
        method: "POST",
        body: JSON.stringify({
          source_entity_code: "TYPE-A",
          target_entity_code: "TYPE-B",
          correlation_type: "invalid_type",
        }),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
        },
      });

      // Act
      const res = await createCorrelation(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(400);
      expect(data.error).toContain("Invalid correlation_type");
    });

    it("should return 404 for non-existent source product", async () => {
      /**
       * Test that source product must exist.
       */
      // Arrange - Only create target product
      const targetProduct = PIMProductFactory.createPayload({ entity_code: "EXISTS-001" });
      await PIMProductModel.create(targetProduct);

      const req = new NextRequest("http://localhost/api/b2b/correlations", {
        method: "POST",
        body: JSON.stringify({
          source_entity_code: "NOTEXISTS-001",
          target_entity_code: "EXISTS-001",
        }),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
        },
      });

      // Act
      const res = await createCorrelation(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(404);
      expect(data.error).toContain("Source product not found");
    });

    it("should return 404 for non-existent target product", async () => {
      /**
       * Test that target product must exist.
       */
      // Arrange - Only create source product
      const sourceProduct = PIMProductFactory.createPayload({ entity_code: "EXISTS-002" });
      await PIMProductModel.create(sourceProduct);

      const req = new NextRequest("http://localhost/api/b2b/correlations", {
        method: "POST",
        body: JSON.stringify({
          source_entity_code: "EXISTS-002",
          target_entity_code: "NOTEXISTS-002",
        }),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
        },
      });

      // Act
      const res = await createCorrelation(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(404);
      expect(data.error).toContain("Target product not found");
    });

    it("should return 409 for duplicate correlation", async () => {
      /**
       * Test that duplicate correlations are rejected.
       */
      // Arrange
      const sourceProduct = PIMProductFactory.createPayload({ entity_code: "DUP-A" });
      const targetProduct = PIMProductFactory.createPayload({ entity_code: "DUP-B" });
      await PIMProductModel.create(sourceProduct);
      await PIMProductModel.create(targetProduct);

      // Create first correlation
      const req1 = new NextRequest("http://localhost/api/b2b/correlations", {
        method: "POST",
        body: JSON.stringify({
          source_entity_code: "DUP-A",
          target_entity_code: "DUP-B",
        }),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
        },
      });
      await createCorrelation(req1);

      // Try to create duplicate
      const req2 = new NextRequest("http://localhost/api/b2b/correlations", {
        method: "POST",
        body: JSON.stringify({
          source_entity_code: "DUP-A",
          target_entity_code: "DUP-B",
        }),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
        },
      });

      // Act
      const res = await createCorrelation(req2);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(409);
      expect(data.error).toContain("Correlation already exists");
    });

    it("should enrich target_product with cover image", async () => {
      /**
       * Test that target_product is enriched with cover image URL.
       */
      // Arrange
      const sourceProduct = PIMProductFactory.createPayload({ entity_code: "IMG-A" });
      const targetProduct = PIMProductFactory.createPayload({
        entity_code: "IMG-B",
        images: [
          { cdn_key: "images/cover.jpg", url: "https://example.com/cover.jpg", is_cover: true, position: 0 },
          { cdn_key: "images/not-cover.jpg", url: "https://example.com/not-cover.jpg", is_cover: false, position: 1 },
        ],
      });
      await PIMProductModel.create(sourceProduct);
      await PIMProductModel.create(targetProduct);

      const req = new NextRequest("http://localhost/api/b2b/correlations", {
        method: "POST",
        body: JSON.stringify({
          source_entity_code: "IMG-A",
          target_entity_code: "IMG-B",
        }),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
        },
      });

      // Act
      const res = await createCorrelation(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.correlations[0].target_product.cover_image_url).toBe(
        "https://example.com/cover.jpg"
      );
    });
  });

  // ============================================
  // GET /api/b2b/correlations - List Correlations
  // ============================================

  describe("GET /api/b2b/correlations", () => {
    it("should list correlations with pagination", async () => {
      /**
       * Test listing correlations with default pagination.
       */
      // Arrange - Create 3 correlations
      for (let i = 0; i < 3; i++) {
        await ProductCorrelationModel.create(
          CorrelationFactory.createDocument({
            source_entity_code: `LIST-SRC-${i}`,
            target_entity_code: `LIST-TGT-${i}`,
          })
        );
      }

      const req = new NextRequest("http://localhost/api/b2b/correlations", {
        headers: { "x-auth-method": "api-key" },
      });

      // Act
      const res = await listCorrelations(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.correlations).toHaveLength(3);
      expect(data.pagination.total).toBe(3);
      expect(data.pagination.page).toBe(1);
    });

    it("should filter by source_entity_code", async () => {
      /**
       * Test filtering correlations by source product.
       */
      // Arrange
      await ProductCorrelationModel.create(
        CorrelationFactory.createDocument({ source_entity_code: "FILTER-SRC-1" })
      );
      await ProductCorrelationModel.create(
        CorrelationFactory.createDocument({ source_entity_code: "FILTER-SRC-2" })
      );

      const req = new NextRequest(
        "http://localhost/api/b2b/correlations?source_entity_code=FILTER-SRC-1",
        { headers: { "x-auth-method": "api-key" } }
      );

      // Act
      const res = await listCorrelations(req);
      const data = await res.json();

      // Assert
      expect(data.correlations).toHaveLength(1);
      expect(data.correlations[0].source_entity_code).toBe("FILTER-SRC-1");
    });

    it("should filter by target_entity_code", async () => {
      /**
       * Test filtering correlations by target product.
       */
      // Arrange
      await ProductCorrelationModel.create(
        CorrelationFactory.createDocument({ target_entity_code: "FILTER-TGT-1" })
      );
      await ProductCorrelationModel.create(
        CorrelationFactory.createDocument({ target_entity_code: "FILTER-TGT-2" })
      );

      const req = new NextRequest(
        "http://localhost/api/b2b/correlations?target_entity_code=FILTER-TGT-1",
        { headers: { "x-auth-method": "api-key" } }
      );

      // Act
      const res = await listCorrelations(req);
      const data = await res.json();

      // Assert
      expect(data.correlations).toHaveLength(1);
      expect(data.correlations[0].target_entity_code).toBe("FILTER-TGT-1");
    });

    it("should filter by correlation_type", async () => {
      /**
       * Test filtering correlations by type.
       * Note: Only "related" type is supported in Phase 1.
       */
      // Arrange - Create correlations with "related" type (default)
      await ProductCorrelationModel.create(
        CorrelationFactory.createDocument({
          source_entity_code: "TYPE-SRC-1",
          correlation_type: "related",
        })
      );
      await ProductCorrelationModel.create(
        CorrelationFactory.createDocument({
          source_entity_code: "TYPE-SRC-2",
          correlation_type: "related",
        })
      );

      const req = new NextRequest(
        "http://localhost/api/b2b/correlations?correlation_type=related",
        { headers: { "x-auth-method": "api-key" } }
      );

      // Act
      const res = await listCorrelations(req);
      const data = await res.json();

      // Assert
      expect(data.correlations).toHaveLength(2);
      expect(data.correlations[0].correlation_type).toBe("related");
      expect(data.correlations[1].correlation_type).toBe("related");
    });

    it("should only return active correlations", async () => {
      /**
       * Test that inactive correlations are not returned.
       */
      // Arrange
      await ProductCorrelationModel.create(
        CorrelationFactory.createDocument({ is_active: true })
      );
      await ProductCorrelationModel.create(
        CorrelationFactory.createDocument({ is_active: false })
      );

      const req = new NextRequest("http://localhost/api/b2b/correlations", {
        headers: { "x-auth-method": "api-key" },
      });

      // Act
      const res = await listCorrelations(req);
      const data = await res.json();

      // Assert
      expect(data.correlations).toHaveLength(1);
      expect(data.correlations[0].is_active).toBe(true);
    });

    it("should paginate correctly", async () => {
      /**
       * Test pagination with custom page and limit.
       */
      // Arrange - Create 5 correlations
      for (let i = 0; i < 5; i++) {
        await ProductCorrelationModel.create(
          CorrelationFactory.createDocument({
            source_entity_code: `PAGE-${i}`,
            position: i,
          })
        );
      }

      const req = new NextRequest(
        "http://localhost/api/b2b/correlations?page=2&limit=2",
        { headers: { "x-auth-method": "api-key" } }
      );

      // Act
      const res = await listCorrelations(req);
      const data = await res.json();

      // Assert
      expect(data.correlations).toHaveLength(2);
      expect(data.pagination.page).toBe(2);
      expect(data.pagination.limit).toBe(2);
      expect(data.pagination.total).toBe(5);
      expect(data.pagination.totalPages).toBe(3);
    });
  });

  // ============================================
  // GET /api/b2b/correlations/[id] - Get Correlation
  // ============================================

  describe("GET /api/b2b/correlations/[id]", () => {
    it("should get correlation by id", async () => {
      /**
       * Test fetching a single correlation.
       */
      // Arrange
      const correlation = await ProductCorrelationModel.create(
        CorrelationFactory.createDocument({ correlation_id: "get-test-001" })
      );

      const req = new NextRequest("http://localhost/api/b2b/correlations/get-test-001");
      const params = createParams({ id: "get-test-001" });

      // Act
      const res = await getCorrelation(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.correlation.correlation_id).toBe("get-test-001");
    });

    it("should return 404 for non-existent correlation", async () => {
      /**
       * Test 404 for invalid correlation_id.
       */
      // Arrange
      const req = new NextRequest("http://localhost/api/b2b/correlations/nonexistent");
      const params = createParams({ id: "nonexistent" });

      // Act
      const res = await getCorrelation(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(404);
      expect(data.error).toContain("not found");
    });
  });

  // ============================================
  // PATCH /api/b2b/correlations/[id] - Update
  // ============================================

  describe("PATCH /api/b2b/correlations/[id]", () => {
    it("should update correlation position", async () => {
      /**
       * Test updating correlation position.
       */
      // Arrange
      await ProductCorrelationModel.create(
        CorrelationFactory.createDocument({
          correlation_id: "upd-pos-001",
          position: 0,
        })
      );

      const req = new NextRequest("http://localhost/api/b2b/correlations/upd-pos-001", {
        method: "PATCH",
        body: JSON.stringify({ position: 5 }),
        headers: { "Content-Type": "application/json" },
      });
      const params = createParams({ id: "upd-pos-001" });

      // Act
      const res = await updateCorrelation(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.correlation.position).toBe(5);
    });

    it("should update correlation is_active status", async () => {
      /**
       * Test updating correlation active status.
       */
      // Arrange
      await ProductCorrelationModel.create(
        CorrelationFactory.createDocument({
          correlation_id: "upd-active-001",
          is_active: true,
        })
      );

      const req = new NextRequest("http://localhost/api/b2b/correlations/upd-active-001", {
        method: "PATCH",
        body: JSON.stringify({ is_active: false }),
        headers: { "Content-Type": "application/json" },
      });
      const params = createParams({ id: "upd-active-001" });

      // Act
      const res = await updateCorrelation(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.correlation.is_active).toBe(false);
    });

    it("should return 400 for no valid fields", async () => {
      /**
       * Test that invalid fields are rejected.
       */
      // Arrange
      await ProductCorrelationModel.create(
        CorrelationFactory.createDocument({ correlation_id: "upd-invalid-001" })
      );

      const req = new NextRequest("http://localhost/api/b2b/correlations/upd-invalid-001", {
        method: "PATCH",
        body: JSON.stringify({ invalid_field: "value" }),
        headers: { "Content-Type": "application/json" },
      });
      const params = createParams({ id: "upd-invalid-001" });

      // Act
      const res = await updateCorrelation(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(400);
      expect(data.error).toContain("No valid fields");
    });

    it("should return 404 for non-existent correlation", async () => {
      /**
       * Test 404 when updating non-existent correlation.
       */
      // Arrange
      const req = new NextRequest("http://localhost/api/b2b/correlations/nonexistent", {
        method: "PATCH",
        body: JSON.stringify({ position: 1 }),
        headers: { "Content-Type": "application/json" },
      });
      const params = createParams({ id: "nonexistent" });

      // Act
      const res = await updateCorrelation(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(404);
      expect(data.error).toContain("not found");
    });
  });

  // ============================================
  // DELETE /api/b2b/correlations/[id] - Delete
  // ============================================

  describe("DELETE /api/b2b/correlations/[id]", () => {
    it("should delete correlation", async () => {
      /**
       * Test deleting a correlation.
       */
      // Arrange
      await ProductCorrelationModel.create(
        CorrelationFactory.createDocument({ correlation_id: "del-test-001" })
      );

      const req = new NextRequest("http://localhost/api/b2b/correlations/del-test-001");
      const params = createParams({ id: "del-test-001" });

      // Act
      const res = await deleteCorrelation(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.deletedCount).toBe(1);

      // Verify deletion
      const deleted = await ProductCorrelationModel.findOne({
        correlation_id: "del-test-001",
      });
      expect(deleted).toBeNull();
    });

    it("should delete bidirectional correlations together", async () => {
      /**
       * Test that deleting a bidirectional correlation also deletes the reverse.
       */
      // Arrange - Create bidirectional pair
      await ProductCorrelationModel.create(
        CorrelationFactory.createDocument({
          correlation_id: "del-bidir-001",
          source_entity_code: "DEL-A",
          target_entity_code: "DEL-B",
          is_bidirectional: true,
        })
      );
      await ProductCorrelationModel.create(
        CorrelationFactory.createDocument({
          correlation_id: "del-bidir-002",
          source_entity_code: "DEL-B",
          target_entity_code: "DEL-A",
          is_bidirectional: true,
        })
      );

      const req = new NextRequest("http://localhost/api/b2b/correlations/del-bidir-001");
      const params = createParams({ id: "del-bidir-001" });

      // Act
      const res = await deleteCorrelation(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.deletedCount).toBe(2);

      // Verify both are deleted
      const remaining = await ProductCorrelationModel.countDocuments({
        correlation_id: { $in: ["del-bidir-001", "del-bidir-002"] },
      });
      expect(remaining).toBe(0);
    });

    it("should return 404 for non-existent correlation", async () => {
      /**
       * Test 404 when deleting non-existent correlation.
       */
      // Arrange
      const req = new NextRequest("http://localhost/api/b2b/correlations/nonexistent");
      const params = createParams({ id: "nonexistent" });

      // Act
      const res = await deleteCorrelation(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(404);
      expect(data.error).toContain("not found");
    });
  });

  // ============================================
  // GET /api/b2b/correlations/stats - Statistics
  // ============================================

  describe("GET /api/b2b/correlations/stats", () => {
    it("should return correlation statistics", async () => {
      /**
       * Test fetching correlation statistics for dashboard.
       * Note: Only "related" type is supported in Phase 1.
       */
      // Arrange - Create correlations with different sources
      await ProductCorrelationModel.create(
        CorrelationFactory.createDocument({
          source_entity_code: "STATS-A",
          target_entity_code: "STATS-TGT-1",
          correlation_type: "related",
        })
      );
      await ProductCorrelationModel.create(
        CorrelationFactory.createDocument({
          source_entity_code: "STATS-A",
          target_entity_code: "STATS-TGT-2",
          correlation_type: "related",
        })
      );
      await ProductCorrelationModel.create(
        CorrelationFactory.createDocument({
          source_entity_code: "STATS-B",
          target_entity_code: "STATS-TGT-3",
          correlation_type: "related",
        })
      );

      const req = new NextRequest("http://localhost/api/b2b/correlations/stats", {
        headers: { "x-auth-method": "api-key" },
      });

      // Act
      const res = await getStats(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.stats.total_correlations).toBe(3);
      expect(data.stats.products_with_correlations).toBe(2); // STATS-A and STATS-B
      expect(data.stats.by_type.related).toBe(3);
    });

    it("should exclude inactive correlations from stats", async () => {
      /**
       * Test that inactive correlations are not counted in stats.
       */
      // Arrange
      await ProductCorrelationModel.create(
        CorrelationFactory.createDocument({ is_active: true })
      );
      await ProductCorrelationModel.create(
        CorrelationFactory.createDocument({ is_active: false })
      );

      const req = new NextRequest("http://localhost/api/b2b/correlations/stats", {
        headers: { "x-auth-method": "api-key" },
      });

      // Act
      const res = await getStats(req);
      const data = await res.json();

      // Assert
      expect(data.stats.total_correlations).toBe(1);
    });

    it("should return zero stats when no correlations exist", async () => {
      /**
       * Test stats with empty database.
       */
      // Arrange - no correlations

      const req = new NextRequest("http://localhost/api/b2b/correlations/stats", {
        headers: { "x-auth-method": "api-key" },
      });

      // Act
      const res = await getStats(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.stats.total_correlations).toBe(0);
      expect(data.stats.products_with_correlations).toBe(0);
      expect(data.stats.by_type.related).toBe(0);
    });
  });

  // ============================================
  // POST /api/b2b/correlations/bulk - Bulk Import
  // ============================================

  describe("POST /api/b2b/correlations/bulk", () => {
    // Import the bulk handler
    let bulkImport: (req: NextRequest) => Promise<Response>;

    beforeAll(async () => {
      const bulkModule = await import("@/app/api/b2b/correlations/bulk/route");
      bulkImport = bulkModule.POST;
    });

    it("should bulk import multiple correlations", async () => {
      /**
       * Test bulk importing multiple correlations in one request.
       */
      // Arrange - Create products
      await PIMProductModel.create(PIMProductFactory.createPayload({ entity_code: "BULK-A" }));
      await PIMProductModel.create(PIMProductFactory.createPayload({ entity_code: "BULK-B" }));
      await PIMProductModel.create(PIMProductFactory.createPayload({ entity_code: "BULK-C" }));

      const req = new NextRequest("http://localhost/api/b2b/correlations/bulk", {
        method: "POST",
        body: JSON.stringify({
          correlations: [
            { source_entity_code: "BULK-A", target_entity_code: "BULK-B" },
            { source_entity_code: "BULK-A", target_entity_code: "BULK-C" },
          ],
        }),
        headers: { "Content-Type": "application/json", "x-auth-method": "api-key" },
      });

      // Act
      const res = await bulkImport(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.result.created).toBe(2);
      expect(data.result.failed).toBe(0);

      // Verify in database
      const correlations = await ProductCorrelationModel.find({ source_entity_code: "BULK-A" });
      expect(correlations).toHaveLength(2);
    });

    it("should handle bidirectional correlations in bulk", async () => {
      /**
       * Test bulk importing bidirectional correlations.
       */
      // Arrange
      await PIMProductModel.create(PIMProductFactory.createPayload({ entity_code: "BIDIR-A" }));
      await PIMProductModel.create(PIMProductFactory.createPayload({ entity_code: "BIDIR-B" }));

      const req = new NextRequest("http://localhost/api/b2b/correlations/bulk", {
        method: "POST",
        body: JSON.stringify({
          correlations: [
            { source_entity_code: "BIDIR-A", target_entity_code: "BIDIR-B", is_bidirectional: true },
          ],
        }),
        headers: { "Content-Type": "application/json", "x-auth-method": "api-key" },
      });

      // Act
      const res = await bulkImport(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.result.created).toBe(2); // Both directions

      // Verify both directions exist
      const forward = await ProductCorrelationModel.findOne({
        source_entity_code: "BIDIR-A",
        target_entity_code: "BIDIR-B",
      });
      const reverse = await ProductCorrelationModel.findOne({
        source_entity_code: "BIDIR-B",
        target_entity_code: "BIDIR-A",
      });
      expect(forward).not.toBeNull();
      expect(reverse).not.toBeNull();
    });

    it("should skip self-correlations in bulk", async () => {
      /**
       * Test that self-correlations are skipped.
       */
      // Arrange
      await PIMProductModel.create(PIMProductFactory.createPayload({ entity_code: "SELF-A" }));

      const req = new NextRequest("http://localhost/api/b2b/correlations/bulk", {
        method: "POST",
        body: JSON.stringify({
          correlations: [
            { source_entity_code: "SELF-A", target_entity_code: "SELF-A" },
          ],
        }),
        headers: { "Content-Type": "application/json", "x-auth-method": "api-key" },
      });

      // Act
      const res = await bulkImport(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.result.created).toBe(0);
      expect(data.result.skipped).toBe(1);
    });

    it("should report errors for missing products", async () => {
      /**
       * Test error reporting when products don't exist.
       */
      // Arrange - Only create source product
      await PIMProductModel.create(PIMProductFactory.createPayload({ entity_code: "EXISTS-A" }));

      const req = new NextRequest("http://localhost/api/b2b/correlations/bulk", {
        method: "POST",
        body: JSON.stringify({
          correlations: [
            { source_entity_code: "EXISTS-A", target_entity_code: "NOT-EXISTS" },
          ],
        }),
        headers: { "Content-Type": "application/json", "x-auth-method": "api-key" },
      });

      // Act
      const res = await bulkImport(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.result.created).toBe(0);
      expect(data.result.failed).toBe(1);
      expect(data.result.errors).toHaveLength(1);
      expect(data.result.errors[0].error).toContain("Target product not found");
    });

    it("should use replace sync_mode to clear existing correlations", async () => {
      /**
       * Test replace mode deletes existing correlations first.
       */
      // Arrange - Create existing correlation
      await ProductCorrelationModel.create(
        CorrelationFactory.createDocument({
          source_entity_code: "REPLACE-OLD",
          target_entity_code: "REPLACE-TGT",
          correlation_type: "related",
        })
      );

      // Create new products
      await PIMProductModel.create(PIMProductFactory.createPayload({ entity_code: "REPLACE-NEW" }));
      await PIMProductModel.create(PIMProductFactory.createPayload({ entity_code: "REPLACE-TGT2" }));

      const req = new NextRequest("http://localhost/api/b2b/correlations/bulk", {
        method: "POST",
        body: JSON.stringify({
          correlations: [
            { source_entity_code: "REPLACE-NEW", target_entity_code: "REPLACE-TGT2" },
          ],
          sync_mode: "replace",
        }),
        headers: { "Content-Type": "application/json", "x-auth-method": "api-key" },
      });

      // Act
      const res = await bulkImport(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.result.created).toBe(1);

      // Old correlation should be deleted
      const oldCorrelation = await ProductCorrelationModel.findOne({
        source_entity_code: "REPLACE-OLD",
      });
      expect(oldCorrelation).toBeNull();

      // New correlation should exist
      const newCorrelation = await ProductCorrelationModel.findOne({
        source_entity_code: "REPLACE-NEW",
      });
      expect(newCorrelation).not.toBeNull();
    });

    it("should reject empty correlations array", async () => {
      /**
       * Test validation for empty array.
       */
      const req = new NextRequest("http://localhost/api/b2b/correlations/bulk", {
        method: "POST",
        body: JSON.stringify({ correlations: [] }),
        headers: { "Content-Type": "application/json", "x-auth-method": "api-key" },
      });

      // Act
      const res = await bulkImport(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(400);
      expect(data.error).toContain("correlations array is required");
    });

    it("should reject invalid sync_mode", async () => {
      /**
       * Test validation for invalid sync mode.
       */
      const req = new NextRequest("http://localhost/api/b2b/correlations/bulk", {
        method: "POST",
        body: JSON.stringify({
          correlations: [{ source_entity_code: "A", target_entity_code: "B" }],
          sync_mode: "invalid",
        }),
        headers: { "Content-Type": "application/json", "x-auth-method": "api-key" },
      });

      // Act
      const res = await bulkImport(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(400);
      expect(data.error).toContain("sync_mode must be");
    });

    it("should enrich with product data in bulk", async () => {
      /**
       * Test that bulk import enriches correlations with product data.
       */
      // Arrange
      await PIMProductModel.create(PIMProductFactory.createPayload({
        entity_code: "ENRICH-A",
        name: { it: "Prodotto A" },
        images: [{ cdn_key: "a.jpg", url: "https://cdn.example.com/a.jpg", is_cover: true, position: 0 }],
      }));
      await PIMProductModel.create(PIMProductFactory.createPayload({
        entity_code: "ENRICH-B",
        name: { it: "Prodotto B" },
        images: [{ cdn_key: "b.jpg", url: "https://cdn.example.com/b.jpg", is_cover: true, position: 0 }],
      }));

      const req = new NextRequest("http://localhost/api/b2b/correlations/bulk", {
        method: "POST",
        body: JSON.stringify({
          correlations: [
            { source_entity_code: "ENRICH-A", target_entity_code: "ENRICH-B" },
          ],
        }),
        headers: { "Content-Type": "application/json", "x-auth-method": "api-key" },
      });

      // Act
      const res = await bulkImport(req);
      await res.json();

      // Assert - Check database for enriched data
      const correlation = await ProductCorrelationModel.findOne({
        source_entity_code: "ENRICH-A",
        target_entity_code: "ENRICH-B",
      });

      expect(correlation).not.toBeNull();
      expect(correlation!.source_product.name.it).toBe("Prodotto A");
      expect(correlation!.source_product.cover_image_url).toBe("https://cdn.example.com/a.jpg");
      expect(correlation!.target_product.name.it).toBe("Prodotto B");
      expect(correlation!.target_product.cover_image_url).toBe("https://cdn.example.com/b.jpg");
    });
  });
});
