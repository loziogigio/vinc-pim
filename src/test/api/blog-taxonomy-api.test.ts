import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { setupTestDatabase, teardownTestDatabase, clearDatabase, createParams } from "../conftest";
import { BlogCategorySchema } from "@/lib/db/models/blog-category";
import { BlogTagSchema } from "@/lib/db/models/blog-tag";
import { BlogPostSchema } from "@/lib/db/models/blog-post";

const BlogCategory = mongoose.models.BlogCategory || mongoose.model("BlogCategory", BlogCategorySchema);
const BlogTag = mongoose.models.BlogTag || mongoose.model("BlogTag", BlogTagSchema);
const BlogPost = mongoose.models.BlogPost || mongoose.model("BlogPost", BlogPostSchema);

vi.mock("@/lib/auth/tenant-auth", () => ({
  requireTenantAuth: vi.fn(() => Promise.resolve({ success: true, tenantId: "t", tenantDb: "vinc-test-tenant", userId: "u1" })),
}));
vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn(() => Promise.resolve({ BlogCategory, BlogTag, BlogPost })),
}));

import { GET as listCats, POST as createCat } from "@/app/api/b2b/blog/categories/route";
import { PATCH as patchCat, DELETE as delCat } from "@/app/api/b2b/blog/categories/[id]/route";
import { GET as listTags, POST as createTag } from "@/app/api/b2b/blog/tags/route";
import { NextRequest } from "next/server";

function makeReq(url: string, opts?: { method?: string; body?: unknown }) {
  const { method = "GET", body } = opts || {};
  return new NextRequest(`http://localhost${url}`, {
    method, body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "Content-Type": "application/json" } : undefined,
  });
}

describe("integration: Blog Taxonomy API", () => {
  beforeAll(async () => { await setupTestDatabase(); });
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); vi.clearAllMocks(); });

  it("creates, lists, updates and deletes a category", async () => {
    const created = await (await createCat(makeReq("/c", { method: "POST", body: { name: { en: "News" } } }))).json();
    const id = created.data.category_id;
    expect((await (await listCats(makeReq("/c"))).json()).data.items).toHaveLength(1);
    const patched = await patchCat(makeReq(`/c/${id}`, { method: "PATCH", body: { display_order: 3 } }), createParams({ id }));
    expect((await patched.json()).data.display_order).toBe(3);
    const del = await delCat(makeReq(`/c/${id}`, { method: "DELETE" }), createParams({ id }));
    expect((await del.json()).success).toBe(true);
  });

  it("creates and lists a tag", async () => {
    await createTag(makeReq("/t", { method: "POST", body: { name: "Promo" } }));
    expect((await (await listTags(makeReq("/t"))).json()).data.items).toHaveLength(1);
  });
});
