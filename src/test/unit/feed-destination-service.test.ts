import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { FeedDestinationSchema } from "@/lib/db/models/feed-destination";
import { FeedRunSchema } from "@/lib/db/models/feed-run";
import { FeedItemStateSchema } from "@/lib/db/models/feed-item-state";
import { SECRET_MASK } from "@/lib/data-models/redact-secrets";

let mongod: MongoMemoryServer;
let conn: mongoose.Connection;

vi.mock("@/lib/db/connection-pool", () => ({
  getPooledConnection: vi.fn(async () => conn),
}));
vi.mock("@/lib/queue/feed-sync-schedules", () => ({
  upsertFeedSchedules: vi.fn(async () => {}),
  removeFeedSchedules: vi.fn(async () => {}),
}));

const svc = await import("@/lib/services/feed-destination.service");
const T = "vinc-test";

describe("feed-destination.service", () => {
  beforeAll(async () => {
    process.env.SESSION_SECRET = "test-secret-at-least-32-characters!!";
    mongod = await MongoMemoryServer.create();
    conn = await mongoose.createConnection(mongod.getUri()).asPromise();
    conn.model("FeedDestination", FeedDestinationSchema);
    conn.model("FeedRun", FeedRunSchema);
    conn.model("FeedItemState", FeedItemStateSchema);
  }, 30000);

  afterAll(async () => {
    await conn.dropDatabase();
    await conn.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    for (const m of ["FeedDestination", "FeedRun", "FeedItemState"]) {
      await conn.models[m].deleteMany({});
    }
  });

  it("creates a meta destination encrypting the token and masking reads", async () => {
    const created = await svc.createDestination(T, "test", {
      type: "meta_catalog", name: "Meta IT", channel: "default", lang: "it",
      currency: "EUR", product_url_template: "https://x/p/{slug}",
      meta_catalog_id: "cat1", meta_system_user_token: "SUPER-SECRET",
    });
    expect(created.destination_id).toMatch(/^fd_/);
    expect(created.meta_system_user_token).toBe(SECRET_MASK);
    expect(JSON.stringify(created)).not.toContain("SUPER-SECRET");
    expect(created).not.toHaveProperty("meta_system_user_token_encrypted");

    const raw = await conn.models.FeedDestination.findOne({}).lean();
    expect(raw.meta_system_user_token_encrypted).toBeTruthy();
    expect(raw.meta_system_user_token_encrypted).not.toContain("SUPER-SECRET");
  });

  it("generates a feed_token for trovaprezzi and regenerates it on demand", async () => {
    const created = await svc.createDestination(T, "test", {
      type: "trovaprezzi", name: "TP", channel: "default", lang: "it",
      currency: "EUR", product_url_template: "https://x/p/{slug}",
    });
    expect(String(created.feed_token).length).toBeGreaterThan(20);
    const newTok = await svc.regenerateFeedToken(T, String(created.destination_id));
    expect(newTok).not.toBe(created.feed_token);
  });

  it("update preserves stored secret when the mask comes back", async () => {
    const created = await svc.createDestination(T, "test", {
      type: "meta_catalog", name: "Meta", channel: "default", lang: "it",
      currency: "EUR", product_url_template: "https://x/p/{slug}",
      meta_catalog_id: "cat1", meta_system_user_token: "SECRET-1",
    });
    const before = await conn.models.FeedDestination.findOne({}).lean();
    await svc.updateDestination(T, "test", String(created.destination_id), {
      name: "Meta renamed", meta_system_user_token: SECRET_MASK,
    });
    const after = await conn.models.FeedDestination.findOne({}).lean();
    expect(after.name).toBe("Meta renamed");
    expect(after.meta_system_user_token_encrypted).toBe(before.meta_system_user_token_encrypted);
  });

  it("delete removes destination, states, runs", async () => {
    const created = await svc.createDestination(T, "test", {
      type: "trovaprezzi", name: "TP", channel: "default", lang: "it",
      currency: "EUR", product_url_template: "https://x/p/{slug}",
    });
    const id = String(created.destination_id);
    await conn.models.FeedItemState.create({ destination_id: id, entity_code: "A", content_hash: "h", remote_status: "pushed" });
    await conn.models.FeedRun.create({ run_id: "fr_x", destination_id: id, mode: "manual" });
    expect(await svc.deleteDestination(T, id)).toBe(true);
    expect(await conn.models.FeedDestination.countDocuments({})).toBe(0);
    expect(await conn.models.FeedItemState.countDocuments({})).toBe(0);
    expect(await conn.models.FeedRun.countDocuments({})).toBe(0);
  });

  it("rejects an invalid delta_interval_minutes on create (90 is neither 5-59 nor a multiple of 60)", async () => {
    await expect(
      svc.createDestination(T, "test", {
        type: "trovaprezzi", name: "TP", channel: "default", lang: "it",
        currency: "EUR", product_url_template: "https://x/p/{slug}",
        delta_interval_minutes: 90,
      })
    ).rejects.toThrow("delta_interval_minutes must be 5-59 or a multiple of 60 (max 1440)");
  });

  it("accepts delta_interval_minutes in the 5-59 range and multiples of 60", async () => {
    const a = await svc.createDestination(T, "test", {
      type: "trovaprezzi", name: "TP45", channel: "default", lang: "it",
      currency: "EUR", product_url_template: "https://x/p/{slug}",
      delta_interval_minutes: 45,
    });
    expect(a.delta_interval_minutes).toBe(45);

    const b = await svc.createDestination(T, "test", {
      type: "trovaprezzi", name: "TP120", channel: "default", lang: "it",
      currency: "EUR", product_url_template: "https://x/p/{slug}",
      delta_interval_minutes: 120,
    });
    expect(b.delta_interval_minutes).toBe(120);
  });

  it("rejects an invalid delta_interval_minutes on update too", async () => {
    const created = await svc.createDestination(T, "test", {
      type: "trovaprezzi", name: "TP", channel: "default", lang: "it",
      currency: "EUR", product_url_template: "https://x/p/{slug}",
    });
    await expect(
      svc.updateDestination(T, "test", String(created.destination_id), {
        delta_interval_minutes: 90,
      })
    ).rejects.toThrow("delta_interval_minutes must be 5-59 or a multiple of 60 (max 1440)");
  });

  it("rejects zero and negative delta_interval_minutes (0 and -60 are not valid multiples)", async () => {
    const base = {
      type: "trovaprezzi" as const, name: "TP", channel: "default", lang: "it",
      currency: "EUR", product_url_template: "https://x/p/{slug}",
    };
    await expect(
      svc.createDestination(T, "test", { ...base, delta_interval_minutes: 0 })
    ).rejects.toThrow("delta_interval_minutes must be 5-59 or a multiple of 60 (max 1440)");
    await expect(
      svc.createDestination(T, "test", { ...base, delta_interval_minutes: -60 })
    ).rejects.toThrow("delta_interval_minutes must be 5-59 or a multiple of 60 (max 1440)");
  });

  it("update ignores protected/unknown fields (mass assignment blocked)", async () => {
    const created = await svc.createDestination(T, "test", {
      type: "meta_catalog", name: "Meta", channel: "default", lang: "it",
      currency: "EUR", product_url_template: "https://x/p/{slug}",
      meta_catalog_id: "cat1", meta_system_user_token: "SECRET-1",
    });
    const id = String(created.destination_id);
    const before = await conn.models.FeedDestination.findOne({}).lean();

    await svc.updateDestination(T, "test", id, {
      name: "Meta renamed",
      destination_id: "fd_evil",
      feed_token: "stolen",
      meta_system_user_token_encrypted: "raw",
      type: "google_merchant",
    } as Parameters<typeof svc.updateDestination>[3]);

    const after = await conn.models.FeedDestination.findOne({}).lean();
    expect(after.name).toBe("Meta renamed"); // allowed change applied
    expect(after.destination_id).toBe(before.destination_id); // not fd_evil
    expect(after.feed_token).toBe(before.feed_token); // not "stolen"
    expect(after.type).toBe("meta_catalog"); // immutable after create
    expect(after.meta_system_user_token_encrypted).toBe(
      before.meta_system_user_token_encrypted
    ); // ciphertext not overwritten with raw value
  });

  it("rejects a google_merchant create missing google_data_source", async () => {
    await expect(
      svc.createDestination(T, "test", {
        type: "google_merchant", name: "Google", channel: "default", lang: "it",
        currency: "EUR", product_url_template: "https://x/p/{slug}",
        google_merchant_account_id: "123",
        google_service_account_json: '{"type":"service_account"}',
        // google_data_source intentionally omitted
      })
    ).rejects.toThrow(/google_merchant destination requires/);
  });

  it("rejects a meta_catalog create missing meta_system_user_token", async () => {
    await expect(
      svc.createDestination(T, "test", {
        type: "meta_catalog", name: "Meta", channel: "default", lang: "it",
        currency: "EUR", product_url_template: "https://x/p/{slug}",
        meta_catalog_id: "cat1",
        // meta_system_user_token intentionally omitted
      })
    ).rejects.toThrow(/meta_catalog destination requires/);
  });

  it("does not require google/meta credentials for a trovaprezzi create", async () => {
    const created = await svc.createDestination(T, "test", {
      type: "trovaprezzi", name: "TP", channel: "default", lang: "it",
      currency: "EUR", product_url_template: "https://x/p/{slug}",
    });
    expect(created.destination_id).toMatch(/^fd_/);
  });

  it("create does not persist unknown extra keys", async () => {
    await svc.createDestination(T, "test", {
      type: "trovaprezzi", name: "TP", channel: "default", lang: "it",
      currency: "EUR", product_url_template: "https://x/p/{slug}",
      injected_field: "nope",
    } as Parameters<typeof svc.createDestination>[2]);
    const raw = await conn.models.FeedDestination.findOne({}).lean();
    expect(raw).not.toHaveProperty("injected_field");
  });
});
