import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

const { sessionRef, uploadMock } = vi.hoisted(() => {
  const sessionRef: { value: Record<string, unknown> | null } = { value: null };
  const uploadMock = vi.fn(async (_config: unknown, _files: unknown, folder: string) => ({
    successful: [{ url: `https://cdn.example/${folder}/asset.png`, key: `${folder}/asset.png`, fileName: "asset.png", fileType: "image/png", mediaType: "document", sizeBytes: 123 }],
    failed: [],
  }));
  return { sessionRef, uploadMock };
});

vi.mock("@/lib/auth/b2b-session", () => ({ getB2BSession: vi.fn(async () => sessionRef.value ?? { isLoggedIn: false }) }));
vi.mock("@/lib/services/cdn-config", () => ({
  getCdnConfig: vi.fn(async () => ({ cdnUrl: "https://cdn.example", bucketRegion: "eu-1", bucketName: "bucket", cdnKey: "key", cdnSecret: "secret" })),
}));
vi.mock("vinc-cdn", () => ({ uploadMultipleMedia: uploadMock }));

import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "@/test/conftest";
import { connectWithModels } from "@/lib/db/connection";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/b2b/pim/products/[entity_code]/blocks/media/route";

const ctx = (entity_code: string) => ({ params: Promise.resolve({ entity_code }) });
async function seedProduct(entity_code: string) {
  const { PIMProduct } = await connectWithModels("vinc-test");
  await PIMProduct.create({ entity_code, sku: entity_code, version: 1, isCurrent: true, images: [], media: [] });
}
function uploadReq() {
  const fd = new FormData();
  fd.append("media", new File([new Uint8Array([1, 2, 3])], "asset.png", { type: "image/png" }));
  return new NextRequest("http://localhost", { method: "POST", body: fd });
}

describe("POST /api/b2b/pim/products/[entity_code]/blocks/media", () => {
  beforeAll(async () => { await setupTestDatabase(); }, 30000);
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); sessionRef.value = { isLoggedIn: true, tenantId: "test", userId: "u1" }; uploadMock.mockClear(); });

  it("uploads under products/{entity_code}/blocks and returns the descriptor", async () => {
    await seedProduct("536914");
    const res = await POST(uploadReq(), ctx("536914"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ url: "https://cdn.example/products/536914/blocks/asset.png", cdn_key: "products/536914/blocks/asset.png", is_external_link: false });
    expect(uploadMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), "products/536914/blocks");
  });
  it("does NOT mutate product.images / product.media", async () => {
    await seedProduct("536914");
    await POST(uploadReq(), ctx("536914"));
    const { PIMProduct } = await connectWithModels("vinc-test");
    const saved = await PIMProduct.findOne({ entity_code: "536914", isCurrent: true }).lean() as any;
    expect(saved.images ?? []).toHaveLength(0);
    expect(saved.media ?? []).toHaveLength(0);
  });
  it("returns 401 when unauthenticated", async () => {
    sessionRef.value = null;
    const res = await POST(uploadReq(), ctx("536914"));
    expect(res.status).toBe(401);
  });
  it("returns 400 when no file is provided", async () => {
    await seedProduct("536914");
    const res = await POST(new NextRequest("http://localhost", { method: "POST", body: new FormData() }), ctx("536914"));
    expect(res.status).toBe(400);
  });
});
