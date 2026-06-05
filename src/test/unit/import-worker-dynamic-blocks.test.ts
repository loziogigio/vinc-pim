/**
 * Import worker — dynamic_blocks handling (Task 5)
 * UPDATE: present->replace+strip · absent->no-op · invalid->warn+skip
 * CREATE: valid->flows through · invalid->drop+warn · absent->no-op
 * Pure helpers tested without Mongo/Redis.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("bullmq", () => ({
  Worker: class MockWorker { on = vi.fn(); close = vi.fn(); },
  Queue: class MockQueue { add = vi.fn(); },
  Job: vi.fn(),
}));
vi.mock("@/lib/queue/queues", () => ({ syncBulkQueue: { add: vi.fn() } }));
vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn(),
  connectToDatabase: vi.fn(),
  getPooledConnection: vi.fn(),
}));
vi.mock("@/lib/pim/parser", () => ({
  parseCSV: vi.fn(),
  parseExcel: vi.fn(),
  detectFileType: vi.fn(),
}));
vi.mock("@/lib/pim/scorer", () => ({
  calculateCompletenessScore: vi.fn(() => 0),
  findCriticalIssues: vi.fn(() => []),
}));
vi.mock("@/lib/pim/auto-publish", () => ({
  checkAutoPublishEligibility: vi.fn(() => ({ eligible: false, reason: "test" })),
  mergeWithLockedFields: vi.fn((p: any, d: any) => d),
}));
vi.mock("@/lib/pim/conflict-resolver", () => ({
  detectConflicts: vi.fn(() => ({ hasConflicts: false, conflictData: {}, mergedData: {} })),
}));
vi.mock("@/lib/sync/marketplace-sync", () => ({
  syncProductToSolr: vi.fn(),
}));

import {
  applyDynamicBlocksToUpdate,
  sanitizeDynamicBlocksForCreate,
} from "@/lib/queue/import-worker";
import type { DynamicBlock } from "@/lib/types/dynamic-blocks";

const validBlock = (): DynamicBlock => ({
  id: "blk_01", lang: "it", title: "Brevetti", section: 1, order: 0, columns: 2, is_active: true,
  elements: [
    { id: "e1", kind: "image", media: { url: "https://cdn.example/patent1.png", cdn_key: "k1" },
      link: { href: "https://patents.example/1", new_tab: true }, description: "Descrizione 1" },
  ],
});

describe("import-worker dynamic_blocks — UPDATE path", () => {
  it("present + valid -> replaces on updateDoc and strips from safeProductData", () => {
    const blocks = [validBlock()];
    const updateDoc: Record<string, any> = {};
    const safeProductData: Record<string, any> = { dynamic_blocks: blocks, name: "X" };
    const warnings: any[] = [];
    applyDynamicBlocksToUpdate(updateDoc, safeProductData, warnings, "536914", 1);
    expect(updateDoc.dynamic_blocks).toEqual(blocks);
    expect("dynamic_blocks" in safeProductData).toBe(false);
    expect(warnings).toHaveLength(0);
  });

  it("absent -> no-op: updateDoc and safeProductData untouched (existing blocks preserved)", () => {
    const updateDoc: Record<string, any> = { name: "X" };
    const safeProductData: Record<string, any> = { name: "X" };
    const warnings: any[] = [];
    applyDynamicBlocksToUpdate(updateDoc, safeProductData, warnings, "536914", 1);
    expect("dynamic_blocks" in updateDoc).toBe(false);
    expect("dynamic_blocks" in safeProductData).toBe(false);
    expect(warnings).toHaveLength(0);
  });

  it("present + invalid -> pushes a warning, skips the field, never throws", () => {
    const bad = [{ ...validBlock(), section: 9 as any }];
    const updateDoc: Record<string, any> = {};
    const safeProductData: Record<string, any> = { dynamic_blocks: bad };
    const warnings: any[] = [];
    expect(() => applyDynamicBlocksToUpdate(updateDoc, safeProductData, warnings, "536914", 7)).not.toThrow();
    expect("dynamic_blocks" in updateDoc).toBe(false);
    expect("dynamic_blocks" in safeProductData).toBe(false);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ row: 7, entity_code: "536914", severity: "warning", field: "dynamic_blocks" });
    expect(warnings[0].error).toContain("dynamic_blocks");
  });
});

describe("import-worker dynamic_blocks — CREATE path", () => {
  it("valid -> leaves the field on the create payload, no warning", () => {
    const blocks = [validBlock()];
    const safeProductData: Record<string, any> = { dynamic_blocks: blocks, name: "X" };
    const warnings: any[] = [];
    sanitizeDynamicBlocksForCreate(safeProductData, warnings, "536914", 1);
    expect(safeProductData.dynamic_blocks).toEqual(blocks);
    expect(warnings).toHaveLength(0);
  });

  it("invalid -> drops the field from the create payload + warning, never throws", () => {
    const bad = [{ ...validBlock(), columns: 99 as any }];
    const safeProductData: Record<string, any> = { dynamic_blocks: bad, name: "X" };
    const warnings: any[] = [];
    expect(() => sanitizeDynamicBlocksForCreate(safeProductData, warnings, "536914", 3)).not.toThrow();
    expect("dynamic_blocks" in safeProductData).toBe(false);
    expect(safeProductData.name).toBe("X");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ row: 3, entity_code: "536914", severity: "warning", field: "dynamic_blocks" });
  });

  it("absent -> no-op, no warning", () => {
    const safeProductData: Record<string, any> = { name: "X" };
    const warnings: any[] = [];
    sanitizeDynamicBlocksForCreate(safeProductData, warnings, "536914", 1);
    expect("dynamic_blocks" in safeProductData).toBe(false);
    expect(warnings).toHaveLength(0);
  });
});
