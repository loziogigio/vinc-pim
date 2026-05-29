import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "@/test/conftest";
import { PIMProductSchema } from "@/lib/db/models/pim-product";
import { BatchSyncLogSchema } from "@/lib/db/models/batch-sync-log";
import { createConsolidationLog, runConsolidation } from "@/lib/services/solr-consolidation.service";

const PModel = () =>
  (mongoose.models.PIMProductJobTest as any) || mongoose.model("PIMProductJobTest", PIMProductSchema);
const LogModel = () =>
  (mongoose.models.BatchSyncLogJobTest as any) || mongoose.model("BatchSyncLogJobTest", BatchSyncLogSchema);

beforeAll(async () => { await setupTestDatabase(); });
afterAll(async () => { await teardownTestDatabase(); });
beforeEach(async () => { await clearDatabase(); });

describe("consolidation job lifecycle", () => {
  it("creates a running log then marks it completed with the result", async () => {
    const Log = LogModel();
    const P = PModel();
    await P.create({
      entity_code: "J1", sku: "J1", version: 1, isCurrent: true, isCurrentPublished: true,
      status: "published", channels: ["b2b"], include_faceting: true, min_score_threshold: 80, required_fields: [],
      source: { source_id: "s", source_name: "S", imported_at: new Date() },
      analytics: { views_30d: 0, clicks_30d: 0, add_to_cart_30d: 0, conversions_30d: 0, priority_score: 0 },
      locked_fields: [], manually_edited: false,
    });

    const { job_id } = await createConsolidationLog(Log, {
      startedBy: "tester", operation: "reindex", channel: "b2b",
    });
    const running: any = await Log.findOne({ job_id }).lean();
    expect(running.status).toBe("running");

    const adapter = {
      bulkIndexProducts: vi.fn(async (products: any[]) => {
        const codes = products.map((p) => p.entity_code);
        return { success: codes.length, failed: 0, errors: [], succeeded: codes, failedItems: [] };
      }),
      fetchAllEntityCodes: vi.fn(async () => []),
      deleteByIds: vi.fn(async () => {}),
    };

    await runConsolidation(Log, job_id, { model: P, adapter: adapter as any, channel: "b2b" });

    const done: any = await Log.findOne({ job_id }).lean();
    expect(done.status).toBe("completed");
    expect(done.resync_result.indexed).toBe(1);
  });

  it("marks the log failed when consolidation throws", async () => {
    const Log = LogModel();
    const P = PModel();
    const { job_id } = await createConsolidationLog(Log, { startedBy: "t", operation: "remove-stale", channel: "b2b" });
    const adapter = {
      bulkIndexProducts: vi.fn(),
      fetchAllEntityCodes: vi.fn(async () => { throw new Error("solr down"); }),
      deleteByIds: vi.fn(),
    };
    await runConsolidation(Log, job_id, { model: P, adapter: adapter as any, channel: "b2b", removeStale: true });
    const failed: any = await Log.findOne({ job_id }).lean();
    expect(failed.status).toBe("failed");
    expect(failed.error_message).toContain("solr down");
  });
});
