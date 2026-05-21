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
const { buildSeoConfig, getSeoConfig } =
  await import("@/lib/services/b2b-seo-config.service");

const TEST_DB = "vinc-seo-config-test";
const HOST = "shop.example.com";

describe("buildSeoConfig (pure)", () => {
  it("returns safe defaults when no config present", () => {
    const cfg = buildSeoConfig(undefined, HOST);
    expect(cfg.categoryRoot.default).toBe("categorie");
    expect(cfg.robots.noindex).toBe(false);
    expect(cfg.robots.allow).toEqual(["/"]);
    expect(cfg.robots.disallow).toContain("/api/");
    expect(cfg.robots.disallow).toContain("/checkout/");
    expect(cfg.robots.sitemapUrl).toBe(`https://${HOST}/sitemap.xml`);
  });

  it("preserves per-locale category roots and defaults the rest", () => {
    const cfg = buildSeoConfig(
      {
        category_root: { default: "categorie", it: "prodotti", en: "products" },
      },
      HOST,
    );
    expect(cfg.categoryRoot.default).toBe("categorie");
    expect(cfg.categoryRoot.it).toBe("prodotti");
    expect(cfg.categoryRoot.en).toBe("products");
  });

  it("falls back categoryRoot.default to 'categorie' when blank/missing", () => {
    const cfg = buildSeoConfig({ category_root: { it: "prodotti" } }, HOST);
    expect(cfg.categoryRoot.default).toBe("categorie");
    expect(cfg.categoryRoot.it).toBe("prodotti");
  });

  it("emits Disallow:/ and clears allow when noindex is true", () => {
    const cfg = buildSeoConfig({ robots: { noindex: true } }, HOST);
    expect(cfg.robots.noindex).toBe(true);
    expect(cfg.robots.disallow).toEqual(["/"]);
    expect(cfg.robots.allow).toEqual([]);
  });

  it("honours custom allow/disallow when provided", () => {
    const cfg = buildSeoConfig(
      { robots: { allow: ["/it/"], disallow: ["/secret/"] } },
      HOST,
    );
    expect(cfg.robots.allow).toEqual(["/it/"]);
    expect(cfg.robots.disallow).toEqual(["/secret/"]);
  });
});

describe("getSeoConfig (DB-backed)", () => {
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
    const { B2BPortal } = await connectWithModels(TEST_DB);
    await B2BPortal.deleteMany({});
  });

  it("returns defaults when the portal has no seo_config", async () => {
    const { B2BPortal } = await connectWithModels(TEST_DB);
    await B2BPortal.create({ slug: "default", name: "Main", channel: "b2b" });

    const cfg = await getSeoConfig(TEST_DB, HOST);
    expect(cfg.categoryRoot.default).toBe("categorie");
    expect(cfg.robots.noindex).toBe(false);
  });

  it("reads the portal's stored seo_config", async () => {
    const { B2BPortal } = await connectWithModels(TEST_DB);
    await B2BPortal.create({
      slug: "default",
      name: "Main",
      channel: "b2b",
      seo_config: {
        category_root: { default: "categorie", it: "prodotti" },
        robots: { noindex: false, disallow: ["/api/", "/account/"] },
      },
    });

    const cfg = await getSeoConfig(TEST_DB, HOST);
    expect(cfg.categoryRoot.it).toBe("prodotti");
    expect(cfg.robots.disallow).toEqual(["/api/", "/account/"]);
  });

  it("returns defaults when the portal is missing entirely", async () => {
    const cfg = await getSeoConfig(TEST_DB, HOST);
    expect(cfg.categoryRoot.default).toBe("categorie");
  });
});
