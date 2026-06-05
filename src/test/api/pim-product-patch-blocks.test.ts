import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
const sessionRef: { value: Record<string, unknown> | null } = { value: null };
vi.mock("@/lib/auth/b2b-session", () => ({
  getB2BSession: vi.fn(async () => sessionRef.value ?? { isLoggedIn: false }),
}));
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "@/test/conftest";
import { connectWithModels } from "@/lib/db/connection";
import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/b2b/pim/products/[entity_code]/route";

const ctx = (entity_code: string) => ({ params: Promise.resolve({ entity_code }) });
async function seedProduct(entity_code: string) {
  const { PIMProduct } = await connectWithModels("vinc-test");
  await PIMProduct.create({ entity_code, sku: entity_code, version: 1, isCurrent: true });
}
function patchReq(body: unknown) {
  return new NextRequest("http://localhost", { method: "PATCH", body: JSON.stringify(body) });
}
const validBlocks = [{
  id: "blk_01", lang: "it", title: "Brevetti", section: 1, order: 0, columns: 2, is_active: true,
  elements: [
    { id: "e1", kind: "image", media: { url: "https://cdn.example/patent1.png", cdn_key: "k1" }, link: { href: "https://patents.example/1", new_tab: true }, description: "Descrizione 1" },
    { id: "e2", kind: "text", text: "Plain caption" },
  ],
}];

describe("PATCH /api/b2b/pim/products/[entity_code] — dynamic_blocks", () => {
  beforeAll(async () => { await setupTestDatabase(); }, 30000);
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); sessionRef.value = { isLoggedIn: true, tenantId: "test", userId: "u1" }; });

  it("accepts and persists valid dynamic_blocks (200)", async () => {
    await seedProduct("536914");
    const res = await PATCH(patchReq({ dynamic_blocks: validBlocks }), ctx("536914"));
    expect(res.status).toBe(200);
    const { PIMProduct } = await connectWithModels("vinc-test");
    const saved = await PIMProduct.findOne({ entity_code: "536914", isCurrent: true }).lean() as any;
    expect(saved.dynamic_blocks).toHaveLength(1);
    expect(saved.dynamic_blocks[0].title).toBe("Brevetti");
    expect(saved.dynamic_blocks[0].elements).toHaveLength(2);
  });

  it("rejects invalid dynamic_blocks with 400 + details", async () => {
    await seedProduct("536915");
    const badBlocks = [{ id: "blk_x", lang: "it", section: 9, order: 0, columns: 2, is_active: true,
      elements: [{ id: "e1", kind: "image", media: { url: "javascript:alert(1)" } }] }];
    const res = await PATCH(patchReq({ dynamic_blocks: badBlocks }), ctx("536915"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
    expect(Array.isArray(body.details)).toBe(true);
    expect(body.details.length).toBeGreaterThan(0);
    const { PIMProduct } = await connectWithModels("vinc-test");
    const saved = await PIMProduct.findOne({ entity_code: "536915", isCurrent: true }).lean() as any;
    expect(saved.dynamic_blocks ?? []).toHaveLength(0);
  });
});
