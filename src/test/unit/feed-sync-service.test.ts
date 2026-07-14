import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { FeedDestinationSchema } from "@/lib/db/models/feed-destination";
import { FeedRunSchema } from "@/lib/db/models/feed-run";
import { FeedItemStateSchema } from "@/lib/db/models/feed-item-state";
import { PIMProductSchema } from "@/lib/db/models/pim-product";

let mongod: MongoMemoryServer;
let conn: mongoose.Connection;

vi.mock("@/lib/db/connection-pool", () => ({
  getPooledConnection: vi.fn(async () => conn),
}));
vi.mock("@/lib/db/build-guard", () => ({ assertNotBuildPhase: vi.fn() }));
vi.mock("@/lib/notifications/send.service", () => ({
  sendNotification: vi.fn(async () => ({ success: true })),
}));
// buildClient() decrypts stored credentials before constructing the client;
// the fixtures store plaintext, so make decrypt a pass-through.
vi.mock("@/lib/utils/encryption", () => ({
  encrypt: vi.fn((s: string) => s),
  decrypt: vi.fn((s: string) => s),
}));

// Mock the Meta client so no HTTP happens; capture pushes.
const pushMock = vi.fn();
const deleteMock = vi.fn();
vi.mock("@/lib/feeds/clients/meta-client", () => ({
  MetaCatalogClient: class {
    pushProducts = pushMock;
    deleteProducts = deleteMock;
  },
}));

const { runFeedSync, buildProductScope } = await import(
  "@/lib/feeds/feed-sync.service"
);

const T_DB = "vinc-test";

function productDoc(code: string, overrides: Record<string, unknown> = {}) {
  return {
    entity_code: code, sku: code, version: 1,
    isCurrent: true, isCurrentPublished: true, status: "published",
    name: { it: `Prodotto ${code}` }, slug: { it: code.toLowerCase() },
    channels: ["default"], quantity: 3, sold: 0, unit: "pcs",
    pricing: { list: 10, currency: "EUR" },
    ...overrides,
  };
}

async function makeDestination(overrides: Record<string, unknown> = {}) {
  return conn.models.FeedDestination.create({
    destination_id: "fd_meta1", type: "meta_catalog", name: "Meta",
    channel: "default", lang: "it", currency: "EUR",
    product_url_template: "https://x/p/{slug}",
    meta_catalog_id: "cat1",
    meta_system_user_token_encrypted: "irrelevant-mocked",
    ...overrides,
  });
}

describe("feed-sync.service", () => {
  beforeAll(async () => {
    process.env.SESSION_SECRET = "test-secret-at-least-32-characters!!";
    mongod = await MongoMemoryServer.create();
    conn = await mongoose.createConnection(mongod.getUri()).asPromise();
    conn.model("FeedDestination", FeedDestinationSchema);
    conn.model("FeedRun", FeedRunSchema);
    conn.model("FeedItemState", FeedItemStateSchema);
    conn.model("PIMProduct", PIMProductSchema);
  }, 30000);

  afterAll(async () => {
    await conn.dropDatabase();
    await conn.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    pushMock.mockReset();
    deleteMock.mockReset();
    for (const m of ["FeedDestination", "FeedRun", "FeedItemState", "PIMProduct"]) {
      await conn.models[m].deleteMany({});
    }
  });

  it("buildProductScope always pins the SCD-2 live filter", () => {
    const scope = buildProductScope({ channel: "default", in_stock_only: true, brand_labels: ["Deodato"], category_ids: ["c1"] });
    expect(scope.isCurrent).toBe(true);
    expect(scope.status).toBe("published");
    expect(scope.not_visible).toEqual({ $ne: true });
    expect(scope.$or).toEqual([
      { channels: "default" },
      { "channel_categories.channel_code": "default" },
    ]);
    expect(scope["brand.label"]).toEqual({ $in: ["Deodato"] });
    expect(scope["category.category_id"]).toEqual({ $in: ["c1"] });
    expect(scope.quantity).toEqual({ $gt: 0 });
  });

  it("full sync pushes all representable products and records states", async () => {
    await makeDestination();
    await conn.models.PIMProduct.create([
      productDoc("A-1"),
      productDoc("A-2"),
      productDoc("OLD-VERSION", { isCurrent: false }), // must be ignored
      productDoc("NO-PRICE", { pricing: { list: 0, currency: "EUR" } }), // skipped
    ]);
    pushMock.mockResolvedValueOnce([
      { entity_code: "A-1", ok: true },
      { entity_code: "A-2", ok: false, error: "Invalid image" },
    ]);

    const summary = await runFeedSync(T_DB, "test", "fd_meta1", "full");

    expect(summary.scanned).toBe(3); // A-1, A-2, NO-PRICE (not OLD-VERSION)
    expect(summary.pushed).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.status).toBe("partial");

    const stateA1 = await conn.models.FeedItemState.findOne({ entity_code: "A-1" }).lean();
    expect(stateA1.remote_status).toBe("pushed");
    const stateA2 = await conn.models.FeedItemState.findOne({ entity_code: "A-2" }).lean();
    expect(stateA2.remote_status).toBe("error");
    expect(stateA2.last_error).toContain("Invalid image");

    const run = await conn.models.FeedRun.findOne({ run_id: summary.run_id }).lean();
    expect(run.status).toBe("partial");
    expect(run.finished_at).toBeInstanceOf(Date);
  });

  it("delta sync skips unchanged items and deletes vanished ones only on full", async () => {
    await makeDestination();
    await conn.models.PIMProduct.create([productDoc("A-1")]);
    pushMock.mockResolvedValue([{ entity_code: "A-1", ok: true }]);

    const first = await runFeedSync(T_DB, "test", "fd_meta1", "full");
    expect(first.pushed).toBe(1);

    // Unchanged product -> delta skips, no push call
    pushMock.mockClear();
    const second = await runFeedSync(T_DB, "test", "fd_meta1", "delta");
    expect(second.pushed).toBe(0);
    expect(second.skipped).toBe(1);
    expect(pushMock).not.toHaveBeenCalled();

    // Product disappears -> full sync deletes remotely
    await conn.models.PIMProduct.deleteMany({ entity_code: "A-1" });
    deleteMock.mockResolvedValueOnce([{ entity_code: "A-1", ok: true }]);
    const third = await runFeedSync(T_DB, "test", "fd_meta1", "full");
    expect(third.deleted).toBe(1);
    const state = await conn.models.FeedItemState.findOne({ entity_code: "A-1" }).lean();
    expect(state.remote_status).toBe("deleted");
  });

  it("trovaprezzi destinations mark items pushed without any client", async () => {
    await makeDestination({ destination_id: "fd_tp", type: "trovaprezzi", name: "TP", feed_token: "tok" });
    await conn.models.PIMProduct.create([productDoc("A-1")]);
    const summary = await runFeedSync(T_DB, "test", "fd_tp", "full");
    expect(summary.pushed).toBe(1);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("clears status_message when a later run recovers", async () => {
    await makeDestination();
    await conn.models.PIMProduct.create([productDoc("A-1")]);

    // Run 1: every push fails -> run "failed", destination error + message.
    pushMock.mockResolvedValueOnce([
      { entity_code: "A-1", ok: false, error: "Catalog offline" },
    ]);
    const bad = await runFeedSync(T_DB, "test", "fd_meta1", "full");
    expect(bad.status).toBe("failed");
    const errored = await conn.models.FeedDestination.findOne({ destination_id: "fd_meta1" }).lean();
    expect(errored.status).toBe("error");
    expect(errored.status_message).toBe("Catalog offline");

    // Run 2: push succeeds -> destination back to active, message cleared.
    pushMock.mockResolvedValueOnce([{ entity_code: "A-1", ok: true }]);
    const good = await runFeedSync(T_DB, "test", "fd_meta1", "full");
    expect(good.status).toBe("success");
    const recovered = await conn.models.FeedDestination.findOne({ destination_id: "fd_meta1" }).lean();
    expect(recovered.status).toBe("active");
    expect(recovered.status_message ?? null).toBeNull();
  });

  it("records an error item state when a remote deletion fails", async () => {
    await makeDestination();
    await conn.models.PIMProduct.create([productDoc("A-1")]);
    pushMock.mockResolvedValue([{ entity_code: "A-1", ok: true }]);
    await runFeedSync(T_DB, "test", "fd_meta1", "full");

    // Product vanishes but the remote delete fails.
    await conn.models.PIMProduct.deleteMany({ entity_code: "A-1" });
    deleteMock.mockResolvedValueOnce([
      { entity_code: "A-1", ok: false, error: "Remote 500" },
    ]);
    const summary = await runFeedSync(T_DB, "test", "fd_meta1", "full");
    expect(summary.failed).toBe(1);
    expect(summary.deleted).toBe(0);

    const state = await conn.models.FeedItemState.findOne({ entity_code: "A-1" }).lean();
    expect(state.remote_status).toBe("error");
    expect(state.last_error).toContain("Remote 500");
  });

  it("mass-deletion guard blocks deletions when most tracked items vanish at once", async () => {
    await makeDestination();
    // 60 previously-pushed items tracked, but the product scan comes back
    // empty (e.g. a bad channel filter) — every one of them "vanishes".
    const states = Array.from({ length: 60 }, (_, i) => ({
      destination_id: "fd_meta1",
      entity_code: `A-${i}`,
      content_hash: "h",
      remote_status: "pushed" as const,
    }));
    await conn.models.FeedItemState.create(states);

    const summary = await runFeedSync(T_DB, "test", "fd_meta1", "full");

    expect(deleteMock).not.toHaveBeenCalled();
    expect(summary.deleted).toBe(0);
    expect(summary.status).toBe("failed");

    const run = await conn.models.FeedRun.findOne({ run_id: summary.run_id }).lean();
    expect(run.error_summary).toContain("mass-deletion guard");

    const stillPushed = await conn.models.FeedItemState.findOne({ entity_code: "A-0" }).lean();
    expect(stillPushed.remote_status).toBe("pushed"); // untouched, not marked deleted
  });

  it("mass-deletion guard is bypassed via FEEDS_ALLOW_MASS_DELETE=1", async () => {
    vi.stubEnv("FEEDS_ALLOW_MASS_DELETE", "1");
    try {
      await makeDestination();
      const states = Array.from({ length: 60 }, (_, i) => ({
        destination_id: "fd_meta1",
        entity_code: `A-${i}`,
        content_hash: "h",
        remote_status: "pushed" as const,
      }));
      await conn.models.FeedItemState.create(states);
      deleteMock.mockImplementation(async (codes: string[]) =>
        codes.map((c) => ({ entity_code: c, ok: true }))
      );

      const summary = await runFeedSync(T_DB, "test", "fd_meta1", "full");

      expect(deleteMock).toHaveBeenCalled();
      expect(summary.deleted).toBe(60);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("run concurrency guard skips starting a new run while one is already running", async () => {
    await makeDestination();
    await conn.models.PIMProduct.create([productDoc("A-1")]);
    await conn.models.FeedRun.create({
      run_id: "fr_inflight", destination_id: "fd_meta1", mode: "delta",
      status: "running", started_at: new Date(),
    });

    const summary = await runFeedSync(T_DB, "test", "fd_meta1", "full");

    expect(summary.run_id).toBe("");
    expect(pushMock).not.toHaveBeenCalled();
    const runCount = await conn.models.FeedRun.countDocuments({ destination_id: "fd_meta1" });
    expect(runCount).toBe(1); // only the pre-seeded in-flight run — no new one created
  });

  it("deletes previously-pushed products that become unrepresentable", async () => {
    await makeDestination();
    await conn.models.PIMProduct.create([productDoc("A-1")]);
    pushMock.mockResolvedValue([{ entity_code: "A-1", ok: true }]);
    await runFeedSync(T_DB, "test", "fd_meta1", "full");

    // Price drops to 0 -> buildFeedProduct returns null -> no longer feedable.
    await conn.models.PIMProduct.updateOne(
      { entity_code: "A-1" },
      { $set: { "pricing.list": 0 } }
    );
    deleteMock.mockResolvedValueOnce([{ entity_code: "A-1", ok: true }]);
    const summary = await runFeedSync(T_DB, "test", "fd_meta1", "full");

    expect(deleteMock).toHaveBeenCalledWith(["A-1"]);
    expect(summary.deleted).toBe(1);
    expect(summary.skipped).toBe(1);
    const state = await conn.models.FeedItemState.findOne({ entity_code: "A-1" }).lean();
    expect(state.remote_status).toBe("deleted");
  });
});
