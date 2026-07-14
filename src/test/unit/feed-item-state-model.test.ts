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
import { FeedItemStateSchema } from "@/lib/db/models/feed-item-state";
import { FeedRunSchema } from "@/lib/db/models/feed-run";

let mongod: MongoMemoryServer;
let conn: mongoose.Connection;

vi.mock("@/lib/db/connection-pool", () => ({
  getPooledConnection: vi.fn(async () => conn),
}));

describe("FeedItemState + FeedRun models", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    conn = await mongoose.createConnection(mongod.getUri()).asPromise();
    conn.model("FeedItemState", FeedItemStateSchema);
    conn.model("FeedRun", FeedRunSchema);
    await conn.models.FeedItemState.createIndexes();
  }, 30000);

  afterAll(async () => {
    await conn.dropDatabase();
    await conn.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await conn.models.FeedItemState.deleteMany({});
    await conn.models.FeedRun.deleteMany({});
  });

  it("enforces one state row per (destination, entity_code)", async () => {
    await conn.models.FeedItemState.create({
      destination_id: "fd_1",
      entity_code: "SKU-1",
      content_hash: "h1",
      remote_status: "pushed",
    });
    await expect(
      conn.models.FeedItemState.create({
        destination_id: "fd_1",
        entity_code: "SKU-1",
        content_hash: "h2",
        remote_status: "pushed",
      }),
    ).rejects.toThrow(/duplicate key/);
  });

  it("creates a run with running status and zeroed counters", async () => {
    const run = await conn.models.FeedRun.create({
      run_id: "fr_1",
      destination_id: "fd_1",
      mode: "delta",
    });
    expect(run.status).toBe("running");
    expect(run.pushed).toBe(0);
    expect(run.started_at).toBeInstanceOf(Date);
  });
});
