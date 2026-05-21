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

let mongod: MongoMemoryServer;
let conn: mongoose.Connection;

vi.mock("@/lib/db/connection-pool", () => ({
  getPooledConnection: vi.fn(async () => conn),
}));
vi.mock("@/lib/db/build-guard", () => ({
  assertNotBuildPhase: vi.fn(),
}));

const { connectWithModels } = await import("@/lib/db/connection");
const { buildB2BSitemapData, __test } =
  await import("@/lib/services/b2b-sitemap.service");

const TEST_DB = "vinc-b2b-sitemap-test";
const HOST = "portal.example.com";

async function seed() {
  const { B2BPortal, PIMProduct, Category, B2BPage, Language } =
    await connectWithModels(TEST_DB);

  // Note: isDefault is left false to avoid the Language pre("save") hook, which
  // references the globally-registered model (unconnected in tests). The sitemap
  // service only reads `code` + `isEnabled`.
  await Language.create([
    {
      code: "it",
      name: "Italian",
      nativeName: "Italiano",
      isDefault: false,
      isEnabled: true,
    },
    {
      code: "en",
      name: "English",
      nativeName: "English",
      isDefault: false,
      isEnabled: true,
    },
  ]);

  await B2BPortal.create({
    slug: "default",
    name: "Main",
    channel: "b2b",
    settings: { default_language: "it" },
    seo_config: { category_root: { default: "categorie", en: "products" } },
  });

  await PIMProduct.create({
    entity_code: "P1",
    sku: "SKU-1",
    status: "published",
    isCurrent: true,
    version: 1,
    quantity: 0,
    sold: 0,
    unit: "pcs",
    channels: ["b2b"],
    slug: { it: "trapano", en: "drill" },
    name: { it: "Trapano", en: "Drill" },
  });

  await Category.create({
    category_id: "cat-leaf",
    name: "Utensili",
    slug: "utensili",
    level: 1,
    path: ["cat-root"],
    is_active: true,
  });
  await Category.create({
    category_id: "cat-root",
    name: "Root",
    slug: "root",
    level: 0,
    path: [],
    is_active: true,
  });

  await B2BPage.create({
    portal_slug: "default",
    slug: "about",
    title: "About",
    status: "active",
    show_in_nav: true,
  });
}

describe("buildB2BSitemapData", () => {
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
    const { B2BPortal, PIMProduct, Category, B2BPage, Language } =
      await connectWithModels(TEST_DB);
    await Promise.all([
      B2BPortal.deleteMany({}),
      PIMProduct.deleteMany({}),
      Category.deleteMany({}),
      B2BPage.deleteMany({}),
      Language.deleteMany({}),
    ]);
  });

  it("emits baseUrl and enabled langs", async () => {
    await seed();
    const data = await buildB2BSitemapData(TEST_DB, HOST);
    expect(data.baseUrl).toBe(`https://${HOST}`);
    expect(data.langs.sort()).toEqual(["en", "it"]);
  });

  it("emits products as flat slug URLs per locale", async () => {
    await seed();
    const data = await buildB2BSitemapData(TEST_DB, HOST);
    const products = data.entries.filter((e) => e.type === "product");
    const locs = products.map((p) => p.loc);
    expect(locs).toContain("/it/trapano");
    expect(locs).toContain("/en/drill");
    // flat (no /products/ segment)
    expect(locs.every((l) => !l.includes("/products/"))).toBe(true);
    // lastmod is the product's updated_at (managed by mongoose timestamps): a valid ISO string.
    expect(typeof products[0].lastmod).toBe("string");
    expect(new Date(products[0].lastmod as string).toString()).not.toBe(
      "Invalid Date",
    );
  });

  it("emits categories under the per-locale category root with hierarchical path", async () => {
    await seed();
    const data = await buildB2BSitemapData(TEST_DB, HOST);
    const cats = data.entries
      .filter((e) => e.type === "category")
      .map((c) => c.loc);
    // Uses default root 'categorie', en overridden to 'products'. The synthetic
    // tree root (`cat-root`, empty path) is FLATTENED out, so its child sits
    // directly under the URL root — no `/categorie/root/...` doubling.
    expect(cats).toContain("/it/categorie/utensili");
    expect(cats).toContain("/en/products/utensili");
    // Synthetic root must not leak into any path; it only yields the landing.
    expect(cats.some((l) => l.includes("/root"))).toBe(false);
    expect(cats).toContain("/it/categorie");
    expect(cats).toContain("/en/products");
  });

  it("emits CMS pages and static routes", async () => {
    await seed();
    const data = await buildB2BSitemapData(TEST_DB, HOST);
    const pages = data.entries
      .filter((e) => e.type === "page")
      .map((p) => p.loc);
    expect(pages).toContain("/it/about");

    const statics = data.entries
      .filter((e) => e.type === "static")
      .map((s) => s.loc);
    expect(statics).toContain("/it");
    expect(statics).toContain("/it/search");
    expect(statics).toContain("/en/search");
  });

  it("falls back to portal default language when no Language docs exist", async () => {
    const { B2BPortal } = await connectWithModels(TEST_DB);
    await B2BPortal.create({
      slug: "default",
      name: "Main",
      channel: "b2b",
      settings: { default_language: "sk" },
    });
    const data = await buildB2BSitemapData(TEST_DB, HOST);
    expect(data.langs).toEqual(["sk"]);
  });

  describe("categoryRootForLocale", () => {
    it("defaults to 'categorie'", () => {
      expect(__test.categoryRootForLocale(undefined, "it")).toBe("categorie");
    });
    it("uses per-locale override", () => {
      expect(
        __test.categoryRootForLocale(
          { category_root: { it: "prodotti" } },
          "it",
        ),
      ).toBe("prodotti");
    });
    it("uses default override for unlisted locales", () => {
      expect(
        __test.categoryRootForLocale(
          { category_root: { default: "catalogo", it: "prodotti" } },
          "en",
        ),
      ).toBe("catalogo");
    });
  });
});
