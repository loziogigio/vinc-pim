import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

// In-memory connection wired into connectWithModels via the pool mock.
let mongod: MongoMemoryServer;
let conn: mongoose.Connection;

vi.mock("@/lib/db/connection-pool", () => ({
  getPooledConnection: vi.fn(async () => conn),
}));
vi.mock("@/lib/db/build-guard", () => ({
  assertNotBuildPhase: vi.fn(),
}));

// Force the Mongo fallback path: keep Solr disabled so resolveViaSearch returns null.
vi.mock("@/config/project.config", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/config/project.config")>();
  return { ...original, isSolrEnabled: vi.fn(() => false) };
});

const { connectWithModels } = await import("@/lib/db/connection");
const { resolveProductBySlug } =
  await import("@/lib/services/b2b-product-resolver.service");

const TEST_DB = "vinc-resolve-product-test";

async function seedProduct(doc: Record<string, unknown>) {
  const { PIMProduct } = await connectWithModels(TEST_DB);
  await PIMProduct.create({
    entity_code: doc.entity_code ?? doc.sku,
    sku: doc.sku,
    status: "published",
    isCurrent: true,
    isCurrentPublished: true,
    version: 1,
    quantity: 0,
    sold: 0,
    unit: "pcs",
    ...doc,
  });
}

describe("resolveProductBySlug (Mongo fallback path)", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    conn = await mongoose
      .createConnection(mongod.getUri(), { dbName: TEST_DB })
      .asPromise();
  }, 30000);

  afterAll(async () => {
    await conn.dropDatabase();
    await conn.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    const { PIMProduct } = await connectWithModels(TEST_DB);
    await PIMProduct.deleteMany({});
  });

  it("resolves a published product by exact locale slug", async () => {
    await seedProduct({
      sku: "SKU-1",
      slug: { it: "trapano-battente", en: "hammer-drill" },
      name: { it: "Trapano", en: "Drill" },
      category: { category_id: "leaf", path: ["root", "mid"] },
    });

    const res = await resolveProductBySlug(TEST_DB, "trapano-battente", "it");
    expect(res.found).toBe(true);
    if (res.found) {
      expect(res.sku).toBe("SKU-1");
      expect(res.name).toBe("Trapano");
      expect(res.slug).toBe("trapano-battente");
      expect(res.parentSku).toBeNull();
      expect(res.categoryAncestors).toEqual(["root", "mid", "leaf"]);
    }
  });

  it("returns parentSku for a variant (child) product", async () => {
    await seedProduct({
      sku: "CHILD-1",
      parent_sku: "PARENT-1",
      slug: { it: "variante-rossa" },
      name: { it: "Variante Rossa" },
    });

    const res = await resolveProductBySlug(TEST_DB, "variante-rossa", "it");
    expect(res.found).toBe(true);
    if (res.found) expect(res.parentSku).toBe("PARENT-1");
  });

  it("returns found:false for an unknown slug", async () => {
    await seedProduct({
      sku: "SKU-2",
      slug: { it: "esiste" },
      name: { it: "X" },
    });
    const res = await resolveProductBySlug(TEST_DB, "non-esiste", "it");
    expect(res.found).toBe(false);
  });

  it("resolves only the requested locale's slug, not other locales", async () => {
    // The sitemap emits per-locale URLs (`slug[locale] || sku`), so a slug that
    // exists only in 'en' is never advertised for 'it'. It resolves under 'en'
    // (exact locale) or via SKU — but not cross-locale (no unbounded scan).
    await seedProduct({
      sku: "SKU-3",
      slug: { en: "english-only-slug" },
      name: { it: "Nome IT", en: "Name EN" },
    });

    expect(
      (await resolveProductBySlug(TEST_DB, "english-only-slug", "it")).found,
    ).toBe(false);

    const byEn = await resolveProductBySlug(TEST_DB, "english-only-slug", "en");
    expect(byEn.found).toBe(true);
    if (byEn.found) expect(byEn.sku).toBe("SKU-3");

    const bySku = await resolveProductBySlug(TEST_DB, "SKU-3", "it");
    expect(bySku.found).toBe(true);
    if (bySku.found) expect(bySku.sku).toBe("SKU-3");
  });

  it("does not resolve a draft (unpublished) product", async () => {
    const { PIMProduct } = await connectWithModels(TEST_DB);
    await PIMProduct.create({
      entity_code: "DRAFT-1",
      sku: "DRAFT-1",
      status: "draft",
      isCurrent: true,
      version: 1,
      quantity: 0,
      sold: 0,
      unit: "pcs",
      slug: { it: "bozza" },
      name: { it: "Bozza" },
    });

    const res = await resolveProductBySlug(TEST_DB, "bozza", "it");
    expect(res.found).toBe(false);
  });

  it("returns found:false for an empty slug", async () => {
    const res = await resolveProductBySlug(TEST_DB, "  ", "it");
    expect(res.found).toBe(false);
  });
});
