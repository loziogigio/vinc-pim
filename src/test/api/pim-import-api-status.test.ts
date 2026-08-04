/**
 * PIM API Import — publish status ownership
 *
 * Regression tests for the sync pipeline being able to publish but never unpublish:
 * with auto_publish_enabled on the source, an explicit `status` in the payload was
 * overwritten by the auto-publish gate, and a status-only payload was dropped as
 * "unchanged" because the content hash ignores status.
 *
 * Drives the real route handler against in-memory MongoDB.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "../conftest";

// ============================================
// MOCKS (module level, before the route import)
// ============================================

vi.mock("bullmq", () => ({
  Worker: class MockWorker {
    on = vi.fn();
    close = vi.fn();
  },
  Queue: class MockQueue {
    add = vi.fn();
  },
  Job: vi.fn(),
}));

vi.mock("@/lib/queue/queues", () => ({
  syncBulkQueue: { add: vi.fn(async () => undefined) },
}));

vi.mock("@/lib/db/connection", async () => {
  const { PIMProductModel } = await import("@/lib/db/models/pim-product");
  const { ImportSourceModel } = await import("@/lib/db/models/import-source");
  const { ImportJobModel } = await import("@/lib/db/models/import-job");
  const { LanguageModel } = await import("@/lib/db/models/language");
  const { BrandModel } = await import("@/lib/db/models/brand");
  const { CategoryModel } = await import("@/lib/db/models/category");
  const { ProductTypeModel } = await import("@/lib/db/models/product-type");
  return {
    connectToDatabase: vi.fn(async () => undefined),
    connectWithModels: vi.fn(async () => ({
      PIMProduct: PIMProductModel,
      ImportSource: ImportSourceModel,
      ImportJob: ImportJobModel,
      Language: LanguageModel,
      Brand: BrandModel,
      Category: CategoryModel,
      ProductType: ProductTypeModel,
    })),
  };
});

vi.mock("@/lib/auth/b2b-session", () => ({
  getB2BSession: vi.fn(async () => ({ isLoggedIn: true, tenantId: "test-tenant" })),
}));

vi.mock("@/lib/auth/api-key-auth", () => ({
  verifyAPIKeyFromRequest: vi.fn(async () => ({ authenticated: false })),
}));

vi.mock("@/lib/db/admin-connection", () => ({
  connectToAdminDatabase: vi.fn(async () => undefined),
}));

vi.mock("@/lib/db/models/admin-tenant", () => ({
  // No tenant doc → PIM versioning defaults ON, as in production.
  getTenantModel: vi.fn(async () => ({
    findOne: () => ({ select: () => ({ lean: async () => null }) }),
  })),
}));

vi.mock("@/lib/services/pim-import-rate-limit.service", () => ({
  checkImportRateLimit: vi.fn(async () => ({
    allowed: true,
    minute: { current: 1, limit: 100 },
    hour: { current: 1, limit: 1000 },
  })),
  acquireImportSlot: vi.fn(async () => ({
    acquired: true,
    release: vi.fn(async () => undefined),
  })),
}));

vi.mock("@/lib/pim/version-retention.service", () => ({
  capVersionsForProduct: vi.fn(async () => undefined),
}));

vi.mock("@/lib/services/pim-catalog-autoprovision.service", () => ({
  autoProvisionCatalogEntities: vi.fn(async () => ({
    brandsCreated: 0,
    productTypesCreated: 0,
    categoriesCreated: 0,
  })),
  resolveChannelCategoriesByExternalCode: vi.fn(async (_model: unknown, cats: unknown) => cats),
}));

const { POST } = await import("@/app/api/b2b/pim/import/api/route");
const { PIMProductModel } = await import("@/lib/db/models/pim-product");
const { ImportSourceModel } = await import("@/lib/db/models/import-source");

// ============================================
// HELPERS
// ============================================

const SOURCE_ID = "bms-core-sync-test";

/** Complete product: passes the required-fields gate, so auto-publish would publish it. */
const COMPLETE = { entity_code: "017840", sku: "017840", name: "Complete Product" };
/** Archive payload sent by prune-deleted.ts when a product leaves the source system. */
const ARCHIVE_FIELDS = {
  not_visible: true,
  quantity: 0,
  stock_status: "out_of_stock",
  channels: [] as string[],
};

async function importProducts(
  products: Record<string, unknown>[],
  merge_mode: "partial" | "replace" = "partial"
) {
  const req = new NextRequest("http://localhost:3000/api/b2b/pim/import/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source_id: SOURCE_ID, merge_mode, products }),
  });
  const res = await POST(req);
  const json = await res.json();
  expect(res.status).toBe(200);
  return json.summary as {
    successful: number;
    unchanged: number;
    failed: number;
    auto_published: number;
  };
}

async function currentProduct(entity_code: string) {
  return PIMProductModel.findOne({ entity_code, isCurrent: true }).lean() as any;
}

beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await clearDatabase();
  await ImportSourceModel.create({
    source_id: SOURCE_ID,
    source_name: "BMS Core Sync (test)",
    source_type: "api",
    auto_publish_enabled: true,
    min_score_threshold: 0,
    required_fields: ["sku", "name"],
    created_by: "test",
  });
});

describe("POST /api/b2b/pim/import/api — publish status", () => {
  it("auto-publishes when the payload states no status", async () => {
    const summary = await importProducts([COMPLETE]);

    expect(summary.successful).toBe(1);
    expect(summary.auto_published).toBe(1);
    const product = await currentProduct(COMPLETE.entity_code);
    expect(product.status).toBe("published");
    expect(product.isCurrentPublished).toBe(true);
  });

  it("leaves an incomplete product as draft (gate not passed, no status stated)", async () => {
    const summary = await importProducts([{ entity_code: "003400", sku: "003400" }]);

    expect(summary.auto_published).toBe(0);
    expect((await currentProduct("003400")).status).toBe("draft");
  });

  it("honours an explicit draft on a product the gate would publish", async () => {
    await importProducts([COMPLETE]);
    expect((await currentProduct(COMPLETE.entity_code)).status).toBe("published");

    // The archive payload, with a real content diff (quantity) as in the bug report.
    const summary = await importProducts([
      { ...COMPLETE, ...ARCHIVE_FIELDS, quantity: 1, status: "draft" },
    ]);

    expect(summary.successful).toBe(1);
    expect(summary.auto_published).toBe(0);
    const product = await currentProduct(COMPLETE.entity_code);
    expect(product.status).toBe("draft");
    expect(product.isCurrentPublished).toBe(false);
    expect(product.not_visible).toBe(true);
  });

  it("honours an explicit published on a product the gate would leave as draft", async () => {
    await importProducts([{ entity_code: "003400", sku: "003400" }]);

    await importProducts([{ entity_code: "003400", sku: "003400", quantity: 5, status: "published" }]);

    const product = await currentProduct("003400");
    expect(product.status).toBe("published");
    expect(product.isCurrentPublished).toBe(true);
  });

  it("writes a status-only change instead of skipping it as unchanged", async () => {
    // Reach steady state: the first partial re-import reshapes the stored hash,
    // after which an identical payload is genuinely "unchanged".
    const archivePayload = { ...COMPLETE, ...ARCHIVE_FIELDS };
    await importProducts([archivePayload]);
    await importProducts([archivePayload]);
    const steady = await importProducts([archivePayload]);
    expect(steady.unchanged).toBe(1);
    expect((await currentProduct(COMPLETE.entity_code)).status).toBe("published");

    // Same payload, status the only difference — must not be dropped.
    const summary = await importProducts([{ ...archivePayload, status: "draft" }]);

    expect(summary.unchanged).toBe(0);
    expect(summary.successful).toBe(1);
    const product = await currentProduct(COMPLETE.entity_code);
    expect(product.status).toBe("draft");
    expect(product.isCurrentPublished).toBe(false);
  });

  it("still skips a repeated archive once the status has landed (no churn)", async () => {
    const archivePayload = { ...COMPLETE, ...ARCHIVE_FIELDS, status: "draft" };
    await importProducts([archivePayload]);
    await importProducts([archivePayload]);

    const summary = await importProducts([archivePayload]);

    expect(summary.unchanged).toBe(1);
    expect(summary.successful).toBe(0);
    const product = await currentProduct(COMPLETE.entity_code);
    expect(product.status).toBe("draft");
    const versions = await PIMProductModel.countDocuments({ entity_code: COMPLETE.entity_code });
    expect(versions).toBeLessThanOrEqual(3);
  });

  it("honours an explicit status in replace mode too", async () => {
    await importProducts([COMPLETE], "replace");

    await importProducts([{ ...COMPLETE, quantity: 1, status: "draft" }], "replace");

    expect((await currentProduct(COMPLETE.entity_code)).status).toBe("draft");
  });

  it("falls back to auto-publish when the stated status is not a valid value", async () => {
    const summary = await importProducts([{ ...COMPLETE, status: "DRAFT" }]);

    expect(summary.auto_published).toBe(1);
    expect((await currentProduct(COMPLETE.entity_code)).status).toBe("published");
  });
});
