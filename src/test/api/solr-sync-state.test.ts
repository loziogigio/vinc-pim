/**
 * Solr Sync State Utilities Tests
 *
 * Tests the solr-sync-state utilities:
 * - buildNeedsIndexingFilter: generates Mongo filter for products needing Solr indexing
 * - markSolrIndexed: stamps solr_indexed_at without bumping updated_at
 *
 * Uses in-memory MongoDB via conftest helpers.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "@/test/conftest";
import { PIMProductSchema } from "@/lib/db/models/pim-product";
import {
  markSolrIndexed,
  buildNeedsIndexingFilter,
} from "@/lib/services/solr-sync-state";

const Model = () =>
  (mongoose.models.PIMProductSyncTest as any) ||
  mongoose.model("PIMProductSyncTest", PIMProductSchema);

beforeAll(async () => {
  await setupTestDatabase();
});
afterAll(async () => {
  await teardownTestDatabase();
});
beforeEach(async () => {
  await clearDatabase();
});

describe("buildNeedsIndexingFilter", () => {
  it("matches published+searchable+never-synced, scoped to channel", () => {
    const f = buildNeedsIndexingFilter("b2b");
    expect(f.isCurrent).toBe(true);
    expect(f.status).toBe("published");
    expect(f.include_faceting).toBe(true);
    expect(f.channels).toBe("b2b");
    // null OR stale-vs-updated_at
    expect(JSON.stringify(f)).toContain("solr_indexed_at");
  });

  it("omits channel filter when no channel given", () => {
    const f = buildNeedsIndexingFilter();
    expect("channels" in f).toBe(false);
  });
});

describe("markSolrIndexed", () => {
  it("sets solr_indexed_at WITHOUT bumping updated_at", async () => {
    const m = Model();
    await m.create({
      entity_code: "A1",
      sku: "A1",
      version: 1,
      isCurrent: true,
      isCurrentPublished: true,
      status: "published",
      channels: ["b2b"],
      include_faceting: true,
      min_score_threshold: 80,
      required_fields: [],
      source: {
        source_id: "test-src",
        source_name: "Test",
        imported_at: new Date(),
      },
      analytics: {
        views_30d: 0,
        clicks_30d: 0,
        add_to_cart_30d: 0,
        conversions_30d: 0,
        priority_score: 0,
      },
      locked_fields: [],
      manually_edited: false,
      completeness_score: 80,
      critical_issues: [],
      auto_publish_enabled: false,
      auto_publish_eligible: true,
      has_conflict: false,
      manually_edited_fields: [],
    });
    const before: any = await m.findOne({ entity_code: "A1" }).lean();
    expect(before.solr_indexed_at).toBeUndefined();

    await markSolrIndexed(m, ["A1"]);

    const after: any = await m.findOne({ entity_code: "A1" }).lean();
    expect(after.solr_indexed_at).toBeInstanceOf(Date);
    expect(new Date(after.updated_at).getTime()).toBe(
      new Date(before.updated_at).getTime()
    );
  });

  it("is a no-op for an empty list", async () => {
    const m = Model();
    await expect(markSolrIndexed(m, [])).resolves.toBeUndefined();
  });
});
